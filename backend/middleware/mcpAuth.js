import { verifyMcpToken } from "../lib/mcpToken.js";
/**
 * Verify the Bearer token attached by Claude on every MCP request.
 * On success, attaches `req.mcpUser = { userId }`.
 *
 * Used only on the /mcp route — separate from the main authMiddleware
 * because MCP tokens have a different audience and lifetime.
 */
export function mcpAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || ''
    const match = authHeader.match(/^Bearer\s+(.+)$/i)

    if (!match) {
        return res.status(401).json({
            error: 'Missing or malformed Authorization header'
        })
    }

    const token = match[1]

    try {
        const payload = verifyMcpToken(token)
        req.mcpUser = { userId: payload.userId }
        return next()
    } catch (err) {
        return res.status(401).json({
            error: 'Invalid or expired MCP token',
        })
    }
}