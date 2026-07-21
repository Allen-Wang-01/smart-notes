import type { Request, Response, NextFunction } from 'express';
import { verifyMcpToken } from '../lib/mcpToken.js';

// Extend Express Request so downstream handlers can read req.mcpUser without casts.
declare module 'express-serve-static-core' {
    interface Request {
        mcpUser?: { userId: string };
    }
}

function resourceMetadataUrl(): string {
    const base = (process.env.MCP_BASE_URL ?? '').replace(/\/$/, '');
    return `${base}/.well-known/oauth-protected-resource`;
}

/**
 * Verify the Bearer token attached by Claude on every MCP request.
 * On success, attaches req.mcpUser = { userId }.
 *
 * On failure, responds 401 with a WWW-Authenticate header so OAuth-aware
 * clients can discover the authorization server and start the flow.
 * Audience enforcement is handled inside verifyMcpToken (MCP_BASE_URL + legacy 'mcp').
 */
export function mcpAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization ?? '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        res.set(
            'WWW-Authenticate',
            `Bearer resource_metadata="${resourceMetadataUrl()}"`,
        );
        res.status(401).json({ error: 'Missing or malformed Authorization header' });
        return;
    }

    const token = match[1]!; // capture group 1 is guaranteed non-empty by the regex

    try {
        const payload = verifyMcpToken(token);
        req.mcpUser = { userId: payload.userId };
        next();
    } catch {
        res.set(
            'WWW-Authenticate',
            `Bearer resource_metadata="${resourceMetadataUrl()}", error="invalid_token", error_description="Token is invalid or expired"`,
        );
        res.status(401).json({ error: 'Invalid or expired MCP token' });
    }
}
