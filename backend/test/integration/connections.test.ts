// Self-contained env for the web authMiddleware.
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// authMiddleware verifies the access token via jwt.verify — mock it to yield a user.
vi.mock('jsonwebtoken', () => ({
    default: { verify: vi.fn(() => ({ userId: 'user_123', username: 'u' })) },
}));
// Mongo-backed helpers mocked.
vi.mock('../../lib/mcpRefreshToken.js', () => ({
    listConnectionsForUser: vi.fn(),
    revokeAllTokensForUser: vi.fn(),
}));

import authMiddleware from '../../middleware/authMiddleware.js';
import { listConnections, revokeAllConnections } from '../../controllers/mcpConnectionsController.js';
import { listConnectionsForUser, revokeAllTokensForUser } from '../../lib/mcpRefreshToken.js';

const app = express();
app.use(express.json());
app.get('/connections', authMiddleware, listConnections);
app.post('/connections/revoke-all', authMiddleware, revokeAllConnections);

const authed = () => 'Bearer valid-access-token';

beforeEach(() => {
    vi.mocked(listConnectionsForUser).mockReset();
    vi.mocked(revokeAllTokensForUser).mockReset();
});

describe('GET /connections', () => {
    it('401 without an access token', async () => {
        const res = await request(app).get('/connections');
        expect(res.status).toBe(401);
    });

    it('returns the user connections without exposing token hashes', async () => {
        vi.mocked(listConnectionsForUser).mockResolvedValue([
            {
                id: 'conn1',
                clientId: 'mcp_client_a',
                scope: 'mcp:read mcp:write',
                label: 'Claude Desktop',
                createdAt: new Date('2026-01-01T00:00:00Z'),
                lastUsedAt: new Date('2026-02-01T00:00:00Z'),
            },
        ]);

        const res = await request(app).get('/connections').set('Authorization', authed());

        expect(res.status).toBe(200);
        expect(res.body.connections).toHaveLength(1);
        expect(res.body.connections[0].clientId).toBe('mcp_client_a');
        // The response must never contain a token hash.
        expect(JSON.stringify(res.body)).not.toMatch(/tokenHash/i);
        expect(vi.mocked(listConnectionsForUser)).toHaveBeenCalledWith('user_123');
    });
});

describe('POST /connections/revoke-all', () => {
    it('401 without an access token', async () => {
        const res = await request(app).post('/connections/revoke-all');
        expect(res.status).toBe(401);
    });

    it('revokes all connections for the user and reports the count', async () => {
        vi.mocked(revokeAllTokensForUser).mockResolvedValue(3);

        const res = await request(app).post('/connections/revoke-all').set('Authorization', authed());

        expect(res.status).toBe(200);
        expect(res.body.revoked).toBe(3);
        expect(vi.mocked(revokeAllTokensForUser)).toHaveBeenCalledWith('user_123');
    });
});
