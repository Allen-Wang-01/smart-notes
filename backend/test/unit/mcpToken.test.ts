// Self-contained: set env vars before any function calls.
// mcpToken.ts reads these lazily (inside functions), so module hoisting is fine.
process.env.MCP_TOKEN_SECRET = 'test-mcp-secret-do-not-use-in-production-x1';
process.env.MCP_BASE_URL = 'https://test-mcp.example.com';

import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
    signMcpToken,
    verifyMcpToken,
    signMcpRefreshToken,
    verifyMcpRefreshToken,
} from '../../lib/mcpToken.js';

const SECRET = process.env.MCP_TOKEN_SECRET!;
const MCP_URL = process.env.MCP_BASE_URL!;
const TEST_USER_ID = 'user_abc123';
const TEST_CLIENT_ID = 'claude-desktop';

describe('signMcpToken / verifyMcpToken', () => {
    it('round-trip: verifyMcpToken returns the correct userId', () => {
        const token = signMcpToken({ userId: TEST_USER_ID });
        const payload = verifyMcpToken(token);
        expect(payload.userId).toBe(TEST_USER_ID);
    });

    it('audience equals MCP_BASE_URL (not the literal "mcp")', () => {
        const token = signMcpToken({ userId: TEST_USER_ID });
        const decoded = jwt.decode(token) as jwt.JwtPayload;
        expect(decoded.aud).toBe(MCP_URL);
        expect(decoded.aud).not.toBe('mcp');
    });

    it('legacy "mcp" audience is accepted during transition period', () => {
        // Simulate a token issued before MCP_BASE_URL was introduced
        const legacyToken = jwt.sign(
            { sub: TEST_USER_ID, aud: 'mcp' },
            SECRET,
            { expiresIn: '1h' }
        );
        const payload = verifyMcpToken(legacyToken);
        expect(payload.userId).toBe(TEST_USER_ID);
    });

    it('wrong audience is rejected', () => {
        const wrongAudToken = jwt.sign(
            { sub: TEST_USER_ID, aud: 'https://attacker.example.com' },
            SECRET,
            { expiresIn: '1h' }
        );
        expect(() => verifyMcpToken(wrongAudToken)).toThrow();
    });

    it('expired token is rejected', () => {
        // Set exp 60 seconds in the past to guarantee expiry without real waits
        const expiredToken = jwt.sign(
            {
                sub: TEST_USER_ID,
                aud: MCP_URL,
                exp: Math.floor(Date.now() / 1000) - 60,
            },
            SECRET
        );
        expect(() => verifyMcpToken(expiredToken)).toThrow();
    });

    it('tampered signature is rejected', () => {
        const token = signMcpToken({ userId: TEST_USER_ID });
        // Flip one character in the signature segment (third JWT part)
        const parts = token.split('.');
        const sig = parts[2]!;
        parts[2] = sig[0] === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1);
        const tampered = parts.join('.');
        expect(() => verifyMcpToken(tampered)).toThrow();
    });
});

describe('signMcpRefreshToken / verifyMcpRefreshToken', () => {
    it('round-trip: verifyMcpRefreshToken returns correct userId and clientId', () => {
        const token = signMcpRefreshToken({ userId: TEST_USER_ID, clientId: TEST_CLIENT_ID });
        const payload = verifyMcpRefreshToken(token);
        expect(payload.userId).toBe(TEST_USER_ID);
        expect(payload.clientId).toBe(TEST_CLIENT_ID);
    });

    it('token signed with wrong secret is rejected', () => {
        const wrongSecretToken = jwt.sign(
            { sub: TEST_USER_ID, clientId: TEST_CLIENT_ID, aud: 'mcp:refresh' },
            'completely-wrong-secret'
        );
        expect(() => verifyMcpRefreshToken(wrongSecretToken)).toThrow();
    });
});
