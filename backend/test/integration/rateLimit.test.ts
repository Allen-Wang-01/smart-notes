import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mcpRegisterRateLimiter, mcpTokenRateLimiter } from '../../middleware/rateLimiters.js';

// Each limiter keeps an in-memory per-IP counter. Mounting it on its own app
// with a trivial handler lets us prove the 429 kicks in without touching Mongo,
// Redis, or the real controllers. We loop past any reasonable cap and assert
// that early requests succeed and a later one is throttled — without hardcoding
// the exact limit.
function appWith(limiter: express.RequestHandler) {
    const app = express();
    app.post('/x', limiter, (_req, res) => { res.status(200).json({ ok: true }); });
    return app;
}

async function fireUntilThrottled(app: express.Express, cap: number) {
    let saw2xx = false;
    let saw429 = false;
    for (let i = 0; i < cap; i++) {
        const res = await request(app).post('/x');
        if (res.status === 200) saw2xx = true;
        if (res.status === 429) { saw429 = true; break; }
    }
    return { saw2xx, saw429 };
}

describe('MCP OAuth rate limiters', () => {
    it('register limiter throttles once the per-IP cap is exceeded', async () => {
        const { saw2xx, saw429 } = await fireUntilThrottled(appWith(mcpRegisterRateLimiter), 500);
        expect(saw2xx).toBe(true);
        expect(saw429).toBe(true);
    });

    it('token/revoke limiter throttles once the per-IP cap is exceeded', async () => {
        const { saw2xx, saw429 } = await fireUntilThrottled(appWith(mcpTokenRateLimiter), 500);
        expect(saw2xx).toBe(true);
        expect(saw429).toBe(true);
    });
});
