import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Access tokens are short-lived so that revoking a refresh token bounds the
// damage window — a stateless JWT cannot be revoked directly.
const MCP_ACCESS_TOKEN_EXPIRES_IN = '1h';
// Refresh tokens are long-lived; they are stored hashed in the DB and can be
// individually revoked (see McpRefreshToken model).
const MCP_REFRESH_TOKEN_EXPIRES_IN = '30d';
// Kept so verifyMcpToken can accept tokens issued before the MCP_BASE_URL
// audience was introduced (transition-period backward compatibility).
const LEGACY_MCP_AUDIENCE = 'mcp';

function getSecret(): string {
    const secret = process.env.MCP_TOKEN_SECRET ?? process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('MCP_TOKEN_SECRET or JWT_SECRET must be set');
    }
    return secret;
}

function getMcpAudience(): string {
    const url = process.env.MCP_BASE_URL;
    if (!url) {
        throw new Error('MCP_BASE_URL must be set');
    }
    return url;
}

export interface McpTokenPayload {
    userId: string;
    iat: number;
    exp: number;
}

export interface McpRefreshTokenPayload {
    userId: string;
    clientId: string;
    iat: number;
    exp: number;
}

/**
 * Sign a short-lived (1h) MCP access token.
 * Audience is the MCP resource server URL from MCP_BASE_URL.
 */
export function signMcpToken({ userId }: { userId: string }): string {
    if (!userId) {
        throw new Error('signMcpToken: userId is required');
    }
    return jwt.sign(
        { sub: String(userId), aud: getMcpAudience() },
        getSecret(),
        { expiresIn: MCP_ACCESS_TOKEN_EXPIRES_IN }
    );
}

/**
 * Verify an MCP access token and return its payload.
 * Accepts both the current MCP_BASE_URL audience and the legacy 'mcp' literal
 * so existing tokens remain valid during the transition period.
 * Throws if the token is invalid, expired, or carries an unexpected audience.
 */
export function verifyMcpToken(token: string): McpTokenPayload {
    const payload = jwt.verify(token, getSecret(), {
        audience: [getMcpAudience(), LEGACY_MCP_AUDIENCE],
    }) as jwt.JwtPayload;

    const sub = payload.sub;
    if (!sub) throw new Error('verifyMcpToken: token missing sub claim');

    return {
        userId: sub,
        iat: payload.iat as number,
        exp: payload.exp as number,
    };
}

/**
 * Sign a long-lived (30d) MCP refresh token embedding userId and clientId.
 * The caller is responsible for hashing this token before persisting it
 * (use hashRefreshToken from lib/refreshTokenHash.ts).
 */
export function signMcpRefreshToken({
    userId,
    clientId,
}: {
    userId: string;
    clientId: string;
}): string {
    if (!userId) throw new Error('signMcpRefreshToken: userId is required');
    if (!clientId) throw new Error('signMcpRefreshToken: clientId is required');

    return jwt.sign(
        // jti guarantees every refresh token is unique even when userId, clientId,
        // and iat are identical (two rotations within the same second). Without it
        // the tokens — and thus their hashes — would collide, and rotation would
        // store then immediately revoke the same hash, stranding the user.
        { sub: String(userId), clientId, aud: 'mcp:refresh', jti: crypto.randomBytes(16).toString('hex') },
        getSecret(),
        { expiresIn: MCP_REFRESH_TOKEN_EXPIRES_IN }
    );
}

/**
 * Verify an MCP refresh token and return its embedded payload.
 * Throws if the token is invalid, expired, or not a refresh token.
 */
export function verifyMcpRefreshToken(token: string): McpRefreshTokenPayload {
    const payload = jwt.verify(token, getSecret(), {
        audience: 'mcp:refresh',
    }) as jwt.JwtPayload;

    const sub = payload.sub;
    if (!sub) throw new Error('verifyMcpRefreshToken: token missing sub claim');

    const clientId = payload['clientId'] as string | undefined;
    if (!clientId) throw new Error('verifyMcpRefreshToken: token missing clientId');

    return {
        userId: sub,
        clientId,
        iat: payload.iat as number,
        exp: payload.exp as number,
    };
}
