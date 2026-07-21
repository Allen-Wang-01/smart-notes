// Self-contained env.
process.env.MCP_TOKEN_SECRET = 'test-mcp-secret-do-not-use-in-production-x1';
process.env.MCP_BASE_URL = 'https://test-mcp.example.com';
process.env.CLIENT_ORIGIN = 'https://app.example.com';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const REDIRECT = 'https://claude.ai/callback';
const CLIENT_ID = 'mcp_client_test';

// Mongo models + login deps mocked so we can drive the handler to the CSRF gate.
vi.mock('../../models/OAuthClient.js', () => ({
    default: { findOne: vi.fn(() => Promise.resolve({ clientId: CLIENT_ID, redirectUris: [REDIRECT] })) },
}));
vi.mock('../../models/User.js', () => ({
    default: {
        findById: vi.fn(() =>
            Promise.resolve({ _id: 'user_123', email: 'u@example.com', username: 'u', refreshToken: 'stored-hash' }),
        ),
    },
}));
vi.mock('../../lib/refreshTokenHash.js', () => ({
    verifyRefreshToken: vi.fn(() => true),
    hashRefreshToken: vi.fn(() => 'stored-hash'),
}));
vi.mock('jsonwebtoken', () => ({
    default: { verify: vi.fn(() => ({ userId: 'user_123' })) },
}));
vi.mock('../../lib/csrfStore.js', () => ({
    generateCsrfToken: vi.fn(() => 'csrf-token-abc'),
    storeCsrfToken: vi.fn(),
    verifyAndConsumeCsrfToken: vi.fn(),
}));
vi.mock('../../lib/authCodeStore.js', () => ({
    storeAuthCode: vi.fn(() => Promise.resolve()),
}));

import { authorizeDecision } from '../../controllers/oauthController.js';
import { verifyAndConsumeCsrfToken } from '../../lib/csrfStore.js';
import { storeAuthCode } from '../../lib/authCodeStore.js';

const app = express();
app.use(cookieParser());
app.post('/authorize', express.urlencoded({ extended: true }), authorizeDecision);

const baseForm = {
    action: 'authorize',
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
    state: 'xyz',
    scope: 'mcp:read',
};

const postDecision = (form: Record<string, string>) =>
    request(app)
        .post('/authorize')
        .type('form')
        .set('Cookie', 'refreshToken=fake-but-mock-verified')
        .send(form);

beforeEach(() => {
    vi.mocked(verifyAndConsumeCsrfToken).mockReset();
    vi.mocked(storeAuthCode).mockReset().mockResolvedValue(undefined as never);
});

describe('consent POST — CSRF protection', () => {
    it('rejects a mismatched CSRF token with 403 and does not mint a code', async () => {
        vi.mocked(verifyAndConsumeCsrfToken).mockResolvedValue(false);
        const res = await postDecision({ ...baseForm, csrf_token: 'wrong-token' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('invalid_csrf');
        expect(vi.mocked(storeAuthCode)).not.toHaveBeenCalled();
    });

    it('rejects an absent CSRF token with 403', async () => {
        vi.mocked(verifyAndConsumeCsrfToken).mockResolvedValue(false);
        const { csrf_token, ...noCsrf } = { ...baseForm, csrf_token: '' };
        void csrf_token;
        const res = await postDecision(noCsrf);
        expect(res.status).toBe(403);
        expect(vi.mocked(storeAuthCode)).not.toHaveBeenCalled();
    });

    it('with a valid CSRF token, mints a code and redirects back with code + state', async () => {
        vi.mocked(verifyAndConsumeCsrfToken).mockResolvedValue(true);
        const res = await postDecision({ ...baseForm, csrf_token: 'csrf-token-abc' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toMatch(new RegExp(`^${REDIRECT}\\?`));
        expect(res.headers.location).toContain('code=');
        expect(res.headers.location).toContain('state=xyz');
        expect(vi.mocked(storeAuthCode)).toHaveBeenCalledTimes(1);
    });
});
