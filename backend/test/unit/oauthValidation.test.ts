import { describe, it, expect } from 'vitest';
import {
    isValidRedirectUri,
    validateRedirectUris,
    isRegisteredRedirectUri,
    generateClientId,
    generateAuthCode,
    validateAuthorizeParams,
} from '../../lib/oauthValidation.js';

// ─── redirect_uri validity (single) ──────────────────────────────────────────
describe('isValidRedirectUri', () => {
    it('accepts https URLs', () => {
        expect(isValidRedirectUri('https://claude.ai/api/mcp/callback')).toBe(true);
    });

    it('accepts http only for localhost / loopback', () => {
        expect(isValidRedirectUri('http://localhost:3000/cb')).toBe(true);
        expect(isValidRedirectUri('http://127.0.0.1:8080/cb')).toBe(true);
    });

    it('rejects http for a public host', () => {
        expect(isValidRedirectUri('http://evil.example.com/cb')).toBe(false);
    });

    it('rejects non-http(s) schemes and malformed strings', () => {
        expect(isValidRedirectUri('ftp://host/cb')).toBe(false);
        expect(isValidRedirectUri('javascript:alert(1)')).toBe(false);
        expect(isValidRedirectUri('not a url')).toBe(false);
        expect(isValidRedirectUri('')).toBe(false);
    });
});

// ─── redirect_uris array validation (registration) ───────────────────────────
describe('validateRedirectUris', () => {
    it('rejects a non-array', () => {
        expect(validateRedirectUris(undefined).valid).toBe(false);
        expect(validateRedirectUris('https://x.com/cb').valid).toBe(false);
        expect(validateRedirectUris({}).valid).toBe(false);
    });

    it('rejects an empty array', () => {
        expect(validateRedirectUris([]).valid).toBe(false);
    });

    it('rejects an array containing an invalid URI', () => {
        const result = validateRedirectUris(['https://ok.com/cb', 'http://evil.com/cb']);
        expect(result.valid).toBe(false);
        expect(result.error).toBeTruthy();
    });

    it('rejects an array containing a non-string entry', () => {
        expect(validateRedirectUris(['https://ok.com/cb', 123]).valid).toBe(false);
    });

    it('accepts a non-empty array of valid URIs', () => {
        expect(validateRedirectUris(['https://claude.ai/cb', 'http://localhost:3000/cb']).valid).toBe(true);
    });
});

// ─── strict redirect_uri allow-list match (the critical security check) ───────
describe('isRegisteredRedirectUri', () => {
    const registered = ['https://claude.ai/callback', 'https://claude.ai/other'];

    it('matches an exact registered URI', () => {
        expect(isRegisteredRedirectUri('https://claude.ai/callback', registered)).toBe(true);
    });

    it('rejects a prefix / substring / trailing-slash variant (no loose matching)', () => {
        expect(isRegisteredRedirectUri('https://claude.ai/callback/', registered)).toBe(false);
        expect(isRegisteredRedirectUri('https://claude.ai/callback/../evil', registered)).toBe(false);
        expect(isRegisteredRedirectUri('https://claude.ai', registered)).toBe(false);
        expect(isRegisteredRedirectUri('https://claude.ai.evil.com/callback', registered)).toBe(false);
    });

    it('rejects a URI not in the list', () => {
        expect(isRegisteredRedirectUri('https://attacker.com/callback', registered)).toBe(false);
    });
});

// ─── client_id / auth code generation ────────────────────────────────────────
describe('generateClientId', () => {
    it('produces high-entropy, unique, non-empty ids', () => {
        const a = generateClientId();
        const b = generateClientId();
        expect(a).not.toBe(b);
        expect(a.length).toBeGreaterThan(20);
    });

    it('never returns anything resembling a secret (id only)', () => {
        // Sanity: the id is a single opaque string, not an object with a secret.
        expect(typeof generateClientId()).toBe('string');
    });
});

describe('generateAuthCode', () => {
    it('produces high-entropy unique codes', () => {
        const a = generateAuthCode();
        const b = generateAuthCode();
        expect(a).not.toBe(b);
        expect(a.length).toBeGreaterThan(20);
    });
});

// ─── authorize parameter validation ──────────────────────────────────────────
describe('validateAuthorizeParams', () => {
    const good = {
        response_type: 'code',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
    };

    it('accepts a well-formed request', () => {
        expect(validateAuthorizeParams(good).valid).toBe(true);
    });

    it('rejects unsupported response_type', () => {
        const r = validateAuthorizeParams({ ...good, response_type: 'token' });
        expect(r.valid).toBe(false);
        expect(r.error).toBe('unsupported_response_type');
    });

    it('rejects a missing code_challenge (PKCE mandatory)', () => {
        const r = validateAuthorizeParams({ ...good, code_challenge: undefined });
        expect(r.valid).toBe(false);
        expect(r.error).toBe('invalid_request');
    });

    it('rejects code_challenge_method=plain (S256 only)', () => {
        const r = validateAuthorizeParams({ ...good, code_challenge_method: 'plain' });
        expect(r.valid).toBe(false);
        expect(r.error).toBe('invalid_code_challenge_method');
    });

    it('rejects a missing code_challenge_method', () => {
        const r = validateAuthorizeParams({ ...good, code_challenge_method: undefined });
        expect(r.valid).toBe(false);
        expect(r.error).toBe('invalid_code_challenge_method');
    });
});

// TODO: add integration tests for the DB/Redis-backed paths once in-memory
// MongoDB is available:
//   - POST /api/mcp/register persists an OAuthClient document
//   - GET /api/mcp/authorize renders the consent page when logged in
//   - GET /api/mcp/authorize 400s on unknown client_id / mismatched redirect_uri
//   - POST /api/mcp/authorize (action=authorize) stores an authcode:* key in
//     Redis with a 600s TTL and redirects with ?code=&state=
//   - action=cancel → redirect with error=access_denied; action=switch → clears
//     cookie and redirects to login with returnTo
