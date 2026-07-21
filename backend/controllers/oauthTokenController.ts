import type { Request, Response } from 'express';
import {
    signMcpToken,
    signMcpRefreshToken,
    verifyMcpRefreshToken,
} from '../lib/mcpToken.js';
import { consumeAuthCode } from '../lib/authCodeStore.js';
import { verifyPkceS256 } from '../lib/pkce.js';
import {
    storeToken,
    findAndVerifyToken,
    rotateToken,
    revokeToken,
} from '../lib/mcpRefreshToken.js';

// Access token lifetime (mirrors '1h' in lib/mcpToken.ts) expressed in seconds
// for the OAuth `expires_in` field.
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 60 * 60; // 1h
// Refresh token lifetime (mirrors '30d' in lib/mcpToken.ts) for the stored
// expiresAt (also drives the Mongo TTL index).
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
// The refresh token itself does not persist scope, so refreshed tokens report
// the full supported scope set.
const DEFAULT_SCOPE = 'mcp:read mcp:write';

type OAuthErrorCode =
    | 'invalid_request'
    | 'invalid_grant'
    | 'unsupported_grant_type'
    | 'invalid_client'
    | 'server_error';

// All token responses (success and error) MUST be uncacheable.
function noStore(res: Response): void {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
}

// error_description is deliberately generic — never leak internal details.
function tokenError(
    res: Response,
    status: number,
    error: OAuthErrorCode,
    description: string,
): void {
    noStore(res);
    res.status(status).json({ error, error_description: description });
}

interface TokenSuccess {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    scope: string;
}

function sendTokens(res: Response, body: TokenSuccess): void {
    noStore(res);
    res.status(200).json(body);
}

/**
 * POST /api/mcp/token — public-client token endpoint (no client auth).
 * Branches on grant_type. Body is application/x-www-form-urlencoded.
 */
export async function handleToken(req: Request, res: Response): Promise<void> {
    const grantType = req.body?.grant_type;

    if (!grantType) {
        tokenError(res, 400, 'invalid_request', 'grant_type is required');
        return;
    }

    if (grantType === 'authorization_code') {
        await handleAuthorizationCodeGrant(req, res);
        return;
    }

    if (grantType === 'refresh_token') {
        await handleRefreshTokenGrant(req, res);
        return;
    }

    tokenError(res, 400, 'unsupported_grant_type', `Unsupported grant_type: ${String(grantType)}`);
}

// ─── Grant 1: authorization_code ─────────────────────────────────────────────
async function handleAuthorizationCodeGrant(req: Request, res: Response): Promise<void> {
    const { code, redirect_uri, client_id, code_verifier } = req.body ?? {};

    if (!code || !redirect_uri || !client_id || !code_verifier) {
        tokenError(res, 400, 'invalid_request', 'Missing required parameters');
        return;
    }

    // Atomically consume the code (single-use). Done BEFORE any validation so a
    // failed/mismatched attempt still burns the code and cannot be retried.
    let payload;
    try {
        payload = await consumeAuthCode(code);
    } catch (err) {
        console.error('[oauth/token] consumeAuthCode error:', err);
        tokenError(res, 400, 'server_error', 'Unable to process authorization code');
        return;
    }

    if (!payload) {
        tokenError(res, 400, 'invalid_grant', 'Authorization code is invalid or expired');
        return;
    }

    // Binding: client_id and redirect_uri must exactly match what was stored.
    if (payload.clientId !== client_id || payload.redirectUri !== redirect_uri) {
        tokenError(res, 400, 'invalid_grant', 'Authorization code binding mismatch');
        return;
    }

    // PKCE: BASE64URL(SHA256(code_verifier)) must match the stored challenge.
    if (!verifyPkceS256(code_verifier, payload.codeChallenge)) {
        tokenError(res, 400, 'invalid_grant', 'PKCE verification failed');
        return;
    }

    try {
        // First connection for this code: sign a pair and CREATE a new record.
        const scope = payload.scope || DEFAULT_SCOPE;
        const { body, refreshToken } = buildTokenResponse(payload.userId, client_id, scope);
        await storeToken({
            userId: payload.userId,
            clientId: client_id,
            rawToken: refreshToken,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
            scope,
        });
        sendTokens(res, body);
    } catch (err) {
        console.error('[oauth/token] issue (code grant) error:', err);
        tokenError(res, 400, 'server_error', 'Unable to issue tokens');
    }
}

// ─── Grant 2: refresh_token (rotating) ───────────────────────────────────────
async function handleRefreshTokenGrant(req: Request, res: Response): Promise<void> {
    const { refresh_token, client_id } = req.body ?? {};

    if (!refresh_token || !client_id) {
        tokenError(res, 400, 'invalid_request', 'Missing required parameters');
        return;
    }

    // Signature + expiry check.
    let payload;
    try {
        payload = verifyMcpRefreshToken(refresh_token);
    } catch {
        tokenError(res, 400, 'invalid_grant', 'Refresh token is invalid or expired');
        return;
    }

    // The client presenting the token must match the one it was issued to.
    if (payload.clientId !== client_id) {
        tokenError(res, 400, 'invalid_grant', 'Refresh token client mismatch');
        return;
    }

    try {
        // Hashed, constant-time DB lookup. Absent → revoked or already rotated.
        const existing = await findAndVerifyToken({
            userId: payload.userId,
            rawToken: refresh_token,
        });
        if (!existing) {
            tokenError(res, 400, 'invalid_grant', 'Refresh token has been revoked');
            return;
        }

        // ROTATE IN PLACE: sign a fresh pair carrying the originally-granted
        // scope, then update the existing record's hash + lastUsedAt in a single
        // write. This preserves createdAt (connection-established time) and, by
        // matching on the old hash, atomically rejects a reused/raced token —
        // rotateToken returns false when the record was already rotated.
        const grantedScope = existing.scope || DEFAULT_SCOPE;
        const { body, refreshToken } = buildTokenResponse(payload.userId, client_id, grantedScope);
        const rotated = await rotateToken({
            oldTokenHash: existing.tokenHash,
            newRawToken: refreshToken,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        });
        if (!rotated) {
            tokenError(res, 400, 'invalid_grant', 'Refresh token has been revoked');
            return;
        }

        sendTokens(res, body);
    } catch (err) {
        console.error('[oauth/token] refresh grant error:', err);
        tokenError(res, 400, 'server_error', 'Unable to refresh tokens');
    }
}

// ─── Shared: sign an access + refresh token pair and build the response body ──
// Signing only — persistence (create vs. in-place rotate) is the caller's job.
function buildTokenResponse(
    userId: string,
    clientId: string,
    scope: string,
): { body: TokenSuccess; refreshToken: string } {
    const accessToken = signMcpToken({ userId });
    const refreshToken = signMcpRefreshToken({ userId, clientId });

    return {
        refreshToken,
        body: {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
            refresh_token: refreshToken,
            scope,
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mcp/revoke — RFC 7009 token revocation
//
// Powers "Disconnect" in Claude. Only refresh tokens are stateful and thus
// revocable; stateless access-token JWTs cannot be revoked (they simply expire
// within 1h). Per RFC 7009 the endpoint returns 200 for any token value —
// valid, invalid, unknown, already revoked, or an access token — so it can't be
// used as an oracle to probe which tokens are valid.
// ─────────────────────────────────────────────────────────────────────────────
export async function revokeTokenEndpoint(req: Request, res: Response): Promise<void> {
    noStore(res);

    const token = req.body?.token;

    // A completely absent `token` parameter is a malformed request (RFC 7009
    // §2.1 → invalid_request). This is distinct from an unknown/invalid token
    // value and leaks nothing about token validity.
    if (!token) {
        res.status(400).json({ error: 'invalid_request', error_description: 'token parameter is required' });
        return;
    }

    // token_type_hint is only an optimization hint and is non-authoritative, so
    // we ignore it: attempting refresh-token verification is harmless for an
    // access token (it simply fails and we no-op).
    try {
        let payload = null;
        try {
            payload = verifyMcpRefreshToken(token);
        } catch {
            payload = null; // access token or garbage → nothing stateful to revoke
        }

        if (payload) {
            const existing = await findAndVerifyToken({ userId: payload.userId, rawToken: token });
            if (existing) {
                await revokeToken(existing.tokenHash);
            }
        }
    } catch (err) {
        // Never log the token itself. Swallow errors — the response is 200
        // regardless so revocation can't be used to probe validity.
        console.error('[oauth/revoke] error during revocation');
        void err;
    }

    res.status(200).end();
}
