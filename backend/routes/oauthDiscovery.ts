import { Router, type Request, type Response } from 'express';

const router = Router();

function getMcpBaseUrl(): string {
    const url = process.env.MCP_BASE_URL;
    if (!url) throw new Error('MCP_BASE_URL must be set');
    return url.replace(/\/$/, ''); // strip trailing slash defensively
}

// RFC 9728 — OAuth 2.0 Protected Resource Metadata
// Tells clients which authorization server governs this MCP resource.
router.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
    const base = getMcpBaseUrl();
    res.json({
        resource: base,
        authorization_servers: [base],
        bearer_methods_supported: ['header'],
        scopes_supported: ['mcp:read', 'mcp:write'],
    });
});

// RFC 8414 — OAuth 2.0 Authorization Server Metadata
// Tells clients every endpoint they need to complete the OAuth flow.
router.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
    const base = getMcpBaseUrl();
    res.json({
        issuer: base,
        // MCP router is mounted at /api/mcp in server.js
        authorization_endpoint:               `${base}/api/mcp/authorize`,
        token_endpoint:                       `${base}/api/mcp/token`,
        registration_endpoint:                `${base}/api/mcp/register`,
        revocation_endpoint:                  `${base}/api/mcp/revoke`,
        response_types_supported:             ['code'],
        grant_types_supported:                ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported:     ['S256'], // PKCE S256 only — "plain" is not accepted
        token_endpoint_auth_methods_supported: ['none'], // public clients; no client secret
        scopes_supported:                     ['mcp:read', 'mcp:write'],
    });
});

export default router;
