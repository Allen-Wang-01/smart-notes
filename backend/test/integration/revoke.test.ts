// Self-contained env — token verification reads these lazily.
process.env.MCP_TOKEN_SECRET = 'test-mcp-secret-do-not-use-in-production-x1';
process.env.MCP_BASE_URL = 'https://test-mcp.example.com';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mongo-backed refresh-token helpers (mocked — no live Mongo)
vi.mock('../../lib/mcpRefreshToken.js', () => ({
    storeToken: vi.fn(),
    findAndVerifyToken: vi.fn(),
    revokeToken: vi.fn(),
}));

import { revokeTokenEndpoint } from '../../controllers/oauthTokenController.js';
import { findAndVerifyToken, revokeToken } from '../../lib/mcpRefreshToken.js';
import { signMcpRefreshToken } from '../../lib/mcpToken.js';

const app = express();
app.post('/revoke', express.urlencoded({ extended: true }), revokeTokenEndpoint);
const post = (body: Record<string, string>) =>
    request(app).post('/revoke').type('form').send(body);

const CLIENT_ID = 'mcp_client_test';

beforeEach(() => {
    vi.mocked(findAndVerifyToken).mockReset();
    vi.mocked(revokeToken).mockReset();
});

describe('POST /revoke (RFC 7009)', () => {
    it('missing token param → 400 invalid_request', async () => {
        const res = await post({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_request');
    });

    it('revokes a valid refresh token → 200, deletes the record', async () => {
        const token = signMcpRefreshToken({ userId: 'user_123', clientId: CLIENT_ID });
        vi.mocked(findAndVerifyToken).mockResolvedValue({ tokenHash: 'hash-xyz' } as never);

        const res = await post({ token });

        expect(res.status).toBe(200);
        expect(res.text).toBe(''); // empty body
        expect(vi.mocked(revokeToken)).toHaveBeenCalledWith('hash-xyz');
    });

    it('unknown/already-revoked refresh token → still 200, no delete', async () => {
        const token = signMcpRefreshToken({ userId: 'user_123', clientId: CLIENT_ID });
        vi.mocked(findAndVerifyToken).mockResolvedValue(null);

        const res = await post({ token });

        expect(res.status).toBe(200);
        expect(vi.mocked(revokeToken)).not.toHaveBeenCalled();
    });

    it('garbage / non-refresh token → 200, no delete (no validity oracle)', async () => {
        const res = await post({ token: 'not.a.valid.jwt' });
        expect(res.status).toBe(200);
        expect(vi.mocked(findAndVerifyToken)).not.toHaveBeenCalled();
        expect(vi.mocked(revokeToken)).not.toHaveBeenCalled();
    });

    it('access-token hint with an opaque token → still 200', async () => {
        const res = await post({ token: 'some-access-token', token_type_hint: 'access_token' });
        expect(res.status).toBe(200);
    });

    it('sets Cache-Control: no-store', async () => {
        const res = await post({ token: 'anything' });
        expect(res.headers['cache-control']).toContain('no-store');
    });
});

// TODO: add integration test once in-memory MongoDB is available — after
// revoking a valid refresh token, the refresh_token grant with that same token
// returns invalid_grant (record actually deleted).
