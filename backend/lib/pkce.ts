import crypto from 'crypto';

// PKCE (RFC 7636) — S256 method only. 'plain' is never accepted anywhere in
// the flow, so there is deliberately no plain-method code path here.

/**
 * Compute the S256 code challenge for a given code_verifier:
 *   BASE64URL( SHA256( ASCII(code_verifier) ) )
 * Node's 'base64url' digest is already unpadded and URL-safe, matching RFC 7636.
 */
export function computeS256Challenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Verify a presented code_verifier against the stored code_challenge using a
 * constant-time comparison. This is the core protection against a stolen
 * authorization code: without the original verifier, the derived challenge
 * won't match, so the code cannot be exchanged.
 */
export function verifyPkceS256(codeVerifier: string, storedChallenge: string): boolean {
    const computed = computeS256Challenge(codeVerifier);
    const a = Buffer.from(computed);
    const b = Buffer.from(storedChallenge);
    // timingSafeEqual requires equal-length buffers; a length mismatch is an
    // immediate (safe) non-match.
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}
