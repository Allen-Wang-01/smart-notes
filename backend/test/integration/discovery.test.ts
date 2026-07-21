// Set env vars before any function calls — modules read them lazily inside handlers.
process.env.MCP_BASE_URL = 'https://test-mcp.example.com';
process.env.MCP_TOKEN_SECRET = 'test-mcp-secret-do-not-use-in-production-x1';

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import oauthDiscoveryRouter from '../../routes/oauthDiscovery.js';
import { mcpAuthMiddleware } from '../../middleware/mcpAuth.js';

const MCP_URL = 'https://test-mcp.example.com';

// Minimal test app — no DB, no cron, just the routes under test.
const app = express();
app.use(express.json());
app.use(oauthDiscoveryRouter);
// Dummy protected route to exercise the auth middleware
app.get('/protected', mcpAuthMiddleware, (_req, res) => { res.json({ ok: true }); });

// ─── RFC 9728 ─── Protected Resource Metadata ────────────────────────────────

describe('GET /.well-known/oauth-protected-resource', () => {
    it('returns 200', async () => {
        const res = await request(app).get('/.well-known/oauth-protected-resource');
        expect(res.status).toBe(200);
    });

    it('resource equals MCP_BASE_URL', async () => {
        const res = await request(app).get('/.well-known/oauth-protected-resource');
        expect(res.body.resource).toBe(MCP_URL);
    });

    it('authorization_servers contains only MCP_BASE_URL', async () => {
        const res = await request(app).get('/.well-known/oauth-protected-resource');
        expect(res.body.authorization_servers).toEqual([MCP_URL]);
    });

    it('bearer_methods_supported includes "header"', async () => {
        const res = await request(app).get('/.well-known/oauth-protected-resource');
        expect(res.body.bearer_methods_supported).toContain('header');
    });

    it('scopes_supported contains mcp:read and mcp:write', async () => {
        const res = await request(app).get('/.well-known/oauth-protected-resource');
        expect(res.body.scopes_supported).toEqual(expect.arrayContaining(['mcp:read', 'mcp:write']));
    });

    it('all URL fields derive from MCP_BASE_URL (no hardcoded hosts)', async () => {
        const res = await request(app).get('/.well-known/oauth-protected-resource');
        expect(res.body.resource).toMatch(new RegExp(`^${MCP_URL}`));
        for (const url of res.body.authorization_servers as string[]) {
            expect(url).toMatch(new RegExp(`^${MCP_URL}`));
        }
    });
});

// ─── RFC 8414 ─── Authorization Server Metadata ──────────────────────────────

describe('GET /.well-known/oauth-authorization-server', () => {
    it('returns 200', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        expect(res.status).toBe(200);
    });

    it('issuer equals MCP_BASE_URL', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        expect(res.body.issuer).toBe(MCP_URL);
    });

    it('OAuth endpoint paths are rooted under MCP_BASE_URL/api/mcp', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        expect(res.body.authorization_endpoint).toBe(`${MCP_URL}/api/mcp/authorize`);
        expect(res.body.token_endpoint).toBe(`${MCP_URL}/api/mcp/token`);
        expect(res.body.registration_endpoint).toBe(`${MCP_URL}/api/mcp/register`);
        expect(res.body.revocation_endpoint).toBe(`${MCP_URL}/api/mcp/revoke`);
    });

    it('all URL fields derive from MCP_BASE_URL', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        const urlFields = [
            'issuer',
            'authorization_endpoint',
            'token_endpoint',
            'registration_endpoint',
            'revocation_endpoint',
        ] as const;
        for (const field of urlFields) {
            expect(String(res.body[field])).toMatch(new RegExp(`^${MCP_URL}`));
        }
    });

    it('response_types_supported is ["code"]', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        expect(res.body.response_types_supported).toEqual(['code']);
    });

    it('grant_types_supported includes authorization_code and refresh_token', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        expect(res.body.grant_types_supported).toEqual(
            expect.arrayContaining(['authorization_code', 'refresh_token']),
        );
    });

    it('code_challenge_methods_supported is ["S256"] only', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        expect(res.body.code_challenge_methods_supported).toEqual(['S256']);
        expect(res.body.code_challenge_methods_supported).not.toContain('plain');
    });

    it('token_endpoint_auth_methods_supported is ["none"] (public clients)', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        expect(res.body.token_endpoint_auth_methods_supported).toEqual(['none']);
    });

    it('scopes_supported contains mcp:read and mcp:write', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        expect(res.body.scopes_supported).toEqual(expect.arrayContaining(['mcp:read', 'mcp:write']));
    });
});

// ─── mcpAuthMiddleware — 401 + WWW-Authenticate ──────────────────────────────

describe('mcpAuthMiddleware', () => {
    it('returns 401 with WWW-Authenticate when Authorization header is absent', async () => {
        const res = await request(app).get('/protected');
        expect(res.status).toBe(401);
        expect(res.headers['www-authenticate']).toBeTruthy();
        expect(res.headers['www-authenticate']).toMatch(/^Bearer/);
        expect(res.headers['www-authenticate']).toContain(
            `${MCP_URL}/.well-known/oauth-protected-resource`,
        );
    });

    it('returns 401 with error="invalid_token" in WWW-Authenticate for a bad token', async () => {
        const res = await request(app)
            .get('/protected')
            .set('Authorization', 'Bearer this.is.not.a.valid.jwt');
        expect(res.status).toBe(401);
        expect(res.headers['www-authenticate']).toContain('error="invalid_token"');
        expect(res.headers['www-authenticate']).toContain(
            `${MCP_URL}/.well-known/oauth-protected-resource`,
        );
    });

    it('preserves JSON error body on 401', async () => {
        const res = await request(app).get('/protected');
        expect(res.body).toHaveProperty('error');
    });

    it('WWW-Authenticate on missing token does NOT include error="invalid_token"', async () => {
        // Missing-token 401 should not claim the token is invalid — it's simply absent.
        const res = await request(app).get('/protected');
        expect(res.headers['www-authenticate']).not.toContain('error=');
    });
});
