import Redis from "ioredis";

let redis

export function getRedis() {
    if (redis) return redis

    const redisUrl = process.env.REDIS_URL

    if (redisUrl) {
        redis = new Redis(redisUrl, {
            tls: {}, // REQUIRED for Upstash
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        })
    } else {
        redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        })
    }
    console.log('[Redis] Connected using', redisUrl ? 'REDIS_URL' : 'HOST/PORT')
    return redis
}

export default redis