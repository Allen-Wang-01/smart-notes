import { getRedis } from '../config/redis.js';

// Authorization codes are short-lived and single-use, so they live in Redis
// (reusing the existing BullMQ ioredis singleton — NOT a new connection).
// Step 4 (/token) will consume + delete the code atomically.

const AUTH_CODE_PREFIX = 'authcode:';
const AUTH_CODE_TTL_SECONDS = 600; // 10 minutes (spec cap)

export interface AuthCodePayload {
    userId: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    // PKCE method is always S256 (validated before storing), kept explicit for /token
    codeChallengeMethod: 'S256';
    scope: string;
    state?: string;
}

function key(code: string): string {
    return `${AUTH_CODE_PREFIX}${code}`;
}

/**
 * Persist an authorization code with a 10-minute TTL.
 * The raw code is the Redis key suffix; the value is the JSON payload the
 * /token endpoint needs to validate the exchange.
 */
export async function storeAuthCode(code: string, payload: AuthCodePayload): Promise<void> {
    const redis = getRedis();
    await redis.set(key(code), JSON.stringify(payload), 'EX', AUTH_CODE_TTL_SECONDS);
}

/**
 * Atomically fetch AND delete a code in a single Redis round-trip (GETDEL,
 * Redis 6.2+). Returns null if the code is missing/expired/already consumed.
 *
 * Atomicity is the single-use guarantee: a non-atomic get-then-delete would
 * let two concurrent /token requests both read the same code before either
 * deletes it, redeeming it twice. GETDEL closes that race. The caller consumes
 * the code BEFORE validating PKCE/binding, so even a failed exchange burns it.
 */
export async function consumeAuthCode(code: string): Promise<AuthCodePayload | null> {
    const redis = getRedis();
    const raw = await redis.getdel(key(code));
    if (!raw) return null;
    return JSON.parse(raw) as AuthCodePayload;
}

export { AUTH_CODE_TTL_SECONDS };
