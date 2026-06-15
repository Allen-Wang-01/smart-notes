import crypto from 'crypto'

/**
 * Hash a refresh token before persisting it.
 *
 * Refresh tokens are high-entropy random strings (not user-chosen secrets),
 * so a fast SHA-256 is sufficient — we don't need a slow KDF like bcrypt.
 * The goal is breach mitigation: an attacker who reads the stored hash
 * cannot reverse it into a token they can present.
 *
 * @param token - The raw refresh token (JWT string).
 * @returns Hex-encoded SHA-256 hash.
 */
export function hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Constant-time comparison of a candidate token against a stored hash.
 *
 * Using timingSafeEqual (instead of ===) prevents a timing side-channel:
 * a plain string compare can leak how many leading characters matched via
 * response-time differences. For a security credential check, compare in
 * constant time regardless of where the first mismatch occurs.
 *
 * @param rawToken - The raw refresh token presented by the client.
 * @param storedHash - The hex-encoded hash previously persisted.
 * @returns true if the token matches the stored hash.
 */
export function verifyRefreshToken(rawToken: string, storedHash: string): boolean {
    const candidateHash = hashRefreshToken(rawToken)

    // Both buffers must be equal length for timingSafeEqual; since both are
    // SHA-256 hex digests they always are, but guard defensively in case the
    // stored value is malformed/empty.
    const a = Buffer.from(candidateHash)
    const b = Buffer.from(storedHash)
    if (a.length !== b.length) {
        return false
    }
    return crypto.timingSafeEqual(a, b)
}