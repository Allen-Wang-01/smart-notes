import jwt from 'jsonwebtoken';

// MCP tokens are long-lived (90 days) and signed separately from the
// main access/refresh token pair. This isolation means:
//   - The main system's 15-minute access token policy stays intact
//   - MCP tokens can be revoked independently
//   - When OAuth is added later, the OAuth flow ultimately calls
//     signMcpToken() to issue the final access token — same plumbing.
const MCP_TOKEN_EXPIRES_IN = '90d';
const MCP_TOKEN_AUDIENCE = 'mcp';

/**
 * Sign a long-lived JWT for MCP usage.
 *
 * @param {Object} params
 * @param {string} params.userId - User ID to embed in the token.
 * @returns {string} Signed JWT.
 */
export function signMcpToken({ userId }) {
    if (!userId) {
        throw new Error('signMcpToken: userId is required')
    }

    const secret = process.env.MCP_TOKEN_SECRET

    if (!secret) {
        throw new Error('signMcpToken: MCP_TOKEN_SECRET or JWT_SECRET must be set')
    }

    return jwt.sign(
        {
            sub: String(userId),
            aud: MCP_TOKEN_AUDIENCE,
        },
        secret,
        {
            expiresIn: MCP_TOKEN_EXPIRES_IN
        }
    )
}

/**
 * Verify an MCP token and return the payload.
 * Throws if invalid, expired, or wrong audience.
 *
 * @param {string} token
 * @returns {{ userId: string, iat: number, exp: number }}
 */
export function verifyMcpToken(token) {
    const secret = process.env.MCP_TOKEN_SECRET || process.env.JWT_SECRET
    if (!secret) {
        throw new Error('verifyMcpToken: MCP_TOKEN_SECRET or JWT_SECRET must be set')
    }
    const payload = jwt.verify(token, secret, {
        audience: MCP_TOKEN_AUDIENCE,
    })

    return {
        userId: payload.sub,
        iat: payload.iat,
        exp: payload.exp,
    }
}