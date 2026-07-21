import type { Request, Response } from 'express';
import {
    listConnectionsForUser,
    revokeAllTokensForUser,
} from '../lib/mcpRefreshToken.js';

// These endpoints sit behind the existing web authMiddleware, which populates
// req.user = { userId, username } from the access token. authMiddleware is
// plain JS, so we read the field through a narrow local cast rather than a
// global Express type augmentation.
function getAuthUserId(req: Request): string | undefined {
    return (req as { user?: { userId?: string } }).user?.userId;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mcp/connections — list the logged-in user's active MCP connections.
// Never returns token hashes (the helper projects only display fields).
// ─────────────────────────────────────────────────────────────────────────────
export async function listConnections(req: Request, res: Response): Promise<void> {
    const userId = getAuthUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const connections = await listConnectionsForUser(userId);
        res.json({ connections });
    } catch (err) {
        console.error('[mcp/connections] list error');
        void err;
        res.status(500).json({ error: 'Failed to list connections' });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mcp/connections/revoke-all — account-level "disconnect everything".
// Deletes every MCP refresh token for the user, cutting off all Claude sessions.
// ─────────────────────────────────────────────────────────────────────────────
export async function revokeAllConnections(req: Request, res: Response): Promise<void> {
    const userId = getAuthUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const revoked = await revokeAllTokensForUser(userId);
        res.json({ revoked });
    } catch (err) {
        console.error('[mcp/connections] revoke-all error');
        void err;
        res.status(500).json({ error: 'Failed to revoke connections' });
    }
}
