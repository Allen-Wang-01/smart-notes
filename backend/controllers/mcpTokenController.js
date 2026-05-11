import { signMcpToken } from "../lib/mcpToken.js"

/**
 * POST /api/mcp/token
 *
 * Issue a long-lived (90-day) MCP access token for the currently
 * authenticated user. The user copies this token into Claude's
 * connector settings as a Bearer header.
 *
 * Authenticated via the main authMiddleware (regular access token).
 */
export async function generateMcpToken(req, res) {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const token = signMcpToken({ userId })

        // Compute expiry for client display (90 days from now)
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

        return res.json({
            token,
            expiresAt: expiresAt.toISOString(),
            mcpUrl: `${getBaseUrl(req)}/mcp`,
            instructions: 'In Claude: Settings → Connectors → Add custom connector. ' +
                'Use the URL above and add header: Authorization: Bearer <token>.',
        })
    } catch (err) {
        return res.status(500).json({ error: 'Failed to generate MCP token' })
    }
}

function getBaseUrl(req) {
    if (process.env.PUBLIC_BASE_URL) {
        return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
    }
    const protocol = req.protocol
    const host = req.get('host')
    return `${protocol}://${host}`
}