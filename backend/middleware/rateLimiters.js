import rateLimit from "express-rate-limit";

/**
 * Rate limiter for normal API requests (CRUD, regenerate, etc.)
 */
export const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,             // max 60 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for SSE endpoints (long-lived connections)
 */
export const sseRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,             // max 10 SSE connections per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,                 // 20 attempts per IP
});