import crypto from 'crypto';
import { getRedis } from '../config/redis.js';

// CSRF tokens for the consent form. Stored in Redis (reusing the existing
// ioredis singleton) with a short TTL matching the consent window. PKCE already
// makes a forged authorization code unredeemable; this is defense-in-depth so
// the authorization action itself cannot be triggered cross-site.
//
// Keyed per-user: the token is bound to the logged-in user rendering the form.
// Trade-off: a user opening two concurrent consent flows would have the first
// form's token overwritten by the second. Acceptable for this flow; a future
// version could key per-flow if concurrent authorizations must both survive.

const CSRF_PREFIX = 'mcpcsrf:';
const CSRF_TTL_SECONDS = 600; // matches the 10-minute consent/auth-code window

function key(userId: string): string {
    return `${CSRF_PREFIX}${userId}`;
}

/** Generate a high-entropy CSRF token to embed as a hidden form field. */
export function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/** Store the CSRF token for a user with a short TTL. */
export async function storeCsrfToken(userId: string, token: string): Promise<void> {
    const redis = getRedis();
    await redis.set(key(userId), token, 'EX', CSRF_TTL_SECONDS);
}

/**
 * Constant-time compare a presented CSRF token against the one stored for the
 * user. On a successful match the token is consumed (single-use) so it cannot
 * be replayed. Returns false on absence, length mismatch, or value mismatch.
 *
 * A failed match does NOT delete the stored token — a wrong guess must not
 * invalidate the legitimate form the user is about to submit.
 */
export async function verifyAndConsumeCsrfToken(
    userId: string,
    presented: unknown,
): Promise<boolean> {
    if (typeof presented !== 'string' || presented.length === 0) return false;

    const redis = getRedis();
    const stored = await redis.get(key(userId));
    if (!stored) return false;

    const a = Buffer.from(presented);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    if (!crypto.timingSafeEqual(a, b)) return false;

    await redis.del(key(userId)); // single-use
    return true;
}

export { CSRF_TTL_SECONDS };
