import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL

const redis = redisUrl ?
    new Redis(redisUrl, {
        tls: {}, // REQUIRED for Upstash
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    }) :
    new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    })

export default redis