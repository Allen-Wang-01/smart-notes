import { describe, it, expect } from 'vitest';
import { computeS256Challenge, verifyPkceS256 } from '../../lib/pkce.js';

// RFC 7636 Appendix B — canonical S256 test vector.
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('computeS256Challenge', () => {
    it('matches the RFC 7636 test vector (correct base64url S256 encoding)', () => {
        expect(computeS256Challenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
    });

    it('produces unpadded, URL-safe output (no =, +, or /)', () => {
        const challenge = computeS256Challenge('some-random-verifier-value-123456789');
        expect(challenge).not.toMatch(/[=+/]/);
    });
});

describe('verifyPkceS256', () => {
    it('passes for the correct verifier', () => {
        expect(verifyPkceS256(RFC_VERIFIER, RFC_CHALLENGE)).toBe(true);
    });

    it('fails for a wrong verifier', () => {
        expect(verifyPkceS256('the-wrong-verifier', RFC_CHALLENGE)).toBe(false);
    });

    it('fails when the stored challenge is empty or malformed', () => {
        expect(verifyPkceS256(RFC_VERIFIER, '')).toBe(false);
        expect(verifyPkceS256(RFC_VERIFIER, 'not-the-challenge')).toBe(false);
    });

    it('is not fooled by a plain (non-hashed) verifier==challenge comparison', () => {
        // A 'plain' PKCE implementation would treat verifier===challenge as valid.
        // S256 must reject it: SHA256(x) !== x.
        expect(verifyPkceS256('abc123', 'abc123')).toBe(false);
    });
});
