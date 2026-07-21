// Self-contained env — token signing reads these lazily.
process.env.MCP_TOKEN_SECRET = 'test-mcp-secret-do-not-use-in-production-x1';
process.env.MCP_BASE_URL = 'https://test-mcp.example.com';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Redis-backed store (mocked — no live Redis in unit tests)
vi.mock('../../lib/authCodeStore.js', () => ({
    consumeAuthCode: vi.fn(),
}));
// Mongo-backed refresh-token helpers (mocked — no live Mongo)
vi.mock('../../lib/mcpRefreshToken.js', () => ({
    storeToken: vi.fn(),
    findAndVerifyToken: vi.fn(),
    rotateToken: vi.fn(),
    revokeToken: vi.fn(),
}));

import { handleToken } from '../../controllers/oauthTokenController.js';
import { consumeAuthCode } from '../../lib/authCodeStore.js';
import { storeToken, findAndVerifyToken, rotateToken, revokeToken } from '../../lib/mcpRefreshToken.js';
import { computeS256Challenge } from '../../lib/pkce.js';
import { signMcpRefreshToken } from '../../lib/mcpToken.js';

// Minimal app mounting only the token endpoint with the urlencoded parser.
const app = express();
app.post('/token', express.urlencoded({ extended: true }), handleToken);

const post = (body: Record<string, string>) =>
    request(app).post('/token').type('form').send(body);

const CLIENT_ID = 'mcp_client_test';
const REDIRECT_URI = 'https://claude.ai/callback';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = computeS256Challenge(VERIFIER);

beforeEach(() => {
    vi.mocked(consumeAuthCode).mockReset();
    vi.mocked(storeToken).mockReset();
    vi.mocked(findAndVerifyToken).mockReset();
    vi.mocked(rotateToken).mockReset();
    vi.mocked(revokeToken).mockReset();
});

// ─── grant_type routing + error shapes ───────────────────────────────────────
describe('grant_type routing', () => {
    it('missing grant_type → 400 invalid_request', async () => {
        const res = await post({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_request');
        expect(res.body).toHaveProperty('error_description');
    });

    it('unknown grant_type → 400 unsupported_grant_type', async () => {
        const res = await post({ grant_type: 'password' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('unsupported_grant_type');
    });

    it('all error responses set Cache-Control: no-store', async () => {
        const res = await post({ grant_type: 'password' });
        expect(res.headers['cache-control']).toContain('no-store');
    });
});

// ─── authorization_code grant ────────────────────────────────────────────────
describe('authorization_code grant', () => {
    const validPayload = {
        userId: 'user_123',
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        codeChallenge: CHALLENGE,
        codeChallengeMethod: 'S256' as const,
        scope: 'mcp:read mcp:write',
    };

    const codeGrant = (over: Record<string, string> = {}) =>
        post({
            grant_type: 'authorization_code',
            code: 'the-code',
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            code_verifier: VERIFIER,
            ...over,
        });

    it('missing params → 400 invalid_request', async () => {
        const res = await post({ grant_type: 'authorization_code', code: 'x' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_request');
    });

    it('expired/missing code → 400 invalid_grant', async () => {
        vi.mocked(consumeAuthCode).mockResolvedValue(null);
        const res = await codeGrant();
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
        expect(vi.mocked(consumeAuthCode)).toHaveBeenCalledWith('the-code');
    });

    it('client_id mismatch → 400 invalid_grant', async () => {
        vi.mocked(consumeAuthCode).mockResolvedValue({ ...validPayload, clientId: 'other_client' });
        const res = await codeGrant();
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
    });

    it('redirect_uri mismatch → 400 invalid_grant', async () => {
        vi.mocked(consumeAuthCode).mockResolvedValue({ ...validPayload, redirectUri: 'https://evil.com/cb' });
        const res = await codeGrant();
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
    });

    it('wrong PKCE verifier → 400 invalid_grant, and the code is still consumed', async () => {
        vi.mocked(consumeAuthCode).mockResolvedValue(validPayload);
        const res = await codeGrant({ code_verifier: 'wrong-verifier' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
        // Atomic consume happens BEFORE validation → a failed attempt burns the code.
        expect(vi.mocked(consumeAuthCode)).toHaveBeenCalledTimes(1);
    });

    it('valid exchange → 200 with token pair, no-store, and persists refresh hash', async () => {
        vi.mocked(consumeAuthCode).mockResolvedValue(validPayload);
        vi.mocked(storeToken).mockResolvedValue({} as never);

        const res = await codeGrant();

        expect(res.status).toBe(200);
        expect(res.body.token_type).toBe('Bearer');
        expect(res.body.expires_in).toBe(3600);
        expect(typeof res.body.access_token).toBe('string');
        expect(typeof res.body.refresh_token).toBe('string');
        expect(res.body.scope).toBe('mcp:read mcp:write');
        expect(res.headers['cache-control']).toContain('no-store');

        // Refresh token persisted by hash (raw refresh token passed to storeToken,
        // which hashes internally). Never the raw token in storage args elsewhere.
        expect(vi.mocked(storeToken)).toHaveBeenCalledTimes(1);
        const storeArgs = vi.mocked(storeToken).mock.calls[0]![0];
        expect(storeArgs.userId).toBe('user_123');
        expect(storeArgs.clientId).toBe(CLIENT_ID);
        expect(storeArgs.rawToken).toBe(res.body.refresh_token);
    });
});

// ─── refresh_token grant ─────────────────────────────────────────────────────
describe('refresh_token grant', () => {
    it('missing params → 400 invalid_request', async () => {
        const res = await post({ grant_type: 'refresh_token' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_request');
    });

    it('invalid/garbage refresh token → 400 invalid_grant', async () => {
        const res = await post({
            grant_type: 'refresh_token',
            refresh_token: 'not.a.jwt',
            client_id: CLIENT_ID,
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
    });

    it('old token presented after rotation (not in DB) → 400 invalid_grant', async () => {
        // After an in-place rotation the old hash no longer exists, so a lookup
        // of the old refresh token returns null — the old token can never be reused.
        const token = signMcpRefreshToken({ userId: 'user_123', clientId: CLIENT_ID });
        vi.mocked(findAndVerifyToken).mockResolvedValue(null);

        const res = await post({ grant_type: 'refresh_token', refresh_token: token, client_id: CLIENT_ID });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
    });

    it('client_id mismatch vs token → 400 invalid_grant', async () => {
        const token = signMcpRefreshToken({ userId: 'user_123', clientId: CLIENT_ID });
        const res = await post({ grant_type: 'refresh_token', refresh_token: token, client_id: 'someone_else' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
    });

    it('valid refresh → rotates IN PLACE: new pair issued, existing record updated by old hash', async () => {
        const token = signMcpRefreshToken({ userId: 'user_123', clientId: CLIENT_ID });
        vi.mocked(findAndVerifyToken).mockResolvedValue({ tokenHash: 'old-hash-abc', scope: 'mcp:read' } as never);
        vi.mocked(rotateToken).mockResolvedValue(true);

        const res = await post({ grant_type: 'refresh_token', refresh_token: token, client_id: CLIENT_ID });

        expect(res.status).toBe(200);
        expect(res.body.token_type).toBe('Bearer');
        expect(typeof res.body.access_token).toBe('string');
        expect(typeof res.body.refresh_token).toBe('string');
        expect(res.body.refresh_token).not.toBe(token); // a genuinely new token
        expect(res.headers['cache-control']).toContain('no-store');

        // In-place rotation: a single update on the existing record, matched by the
        // old hash — no create + delete (so createdAt is preserved).
        expect(vi.mocked(rotateToken)).toHaveBeenCalledTimes(1);
        const rotateArgs = vi.mocked(rotateToken).mock.calls[0]![0];
        expect(rotateArgs.oldTokenHash).toBe('old-hash-abc');
        expect(rotateArgs.newRawToken).toBe(res.body.refresh_token);
        expect(vi.mocked(storeToken)).not.toHaveBeenCalled();
        expect(vi.mocked(revokeToken)).not.toHaveBeenCalled();
    });

    it('rotation loses a concurrent race (record already rotated) → 400 invalid_grant', async () => {
        // findAndVerifyToken passes, but rotateToken matches 0 docs because a
        // concurrent refresh already replaced the hash → reused token rejected.
        const token = signMcpRefreshToken({ userId: 'user_123', clientId: CLIENT_ID });
        vi.mocked(findAndVerifyToken).mockResolvedValue({ tokenHash: 'old-hash-abc' } as never);
        vi.mocked(rotateToken).mockResolvedValue(false);

        const res = await post({ grant_type: 'refresh_token', refresh_token: token, client_id: CLIENT_ID });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_grant');
    });
});

// TODO: add integration tests once in-memory MongoDB is available:
//   - refresh rotation end-to-end: after a successful refresh, the record's
//     tokenHash + lastUsedAt change while createdAt is preserved, and presenting
//     the OLD refresh token returns invalid_grant (old hash no longer in Mongo).
//   - authorization_code success actually writes an McpRefreshToken document.
