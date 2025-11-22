/**
 * =============================================================================
 * Report Generation Queue
 * -----------------------------------------------------------------------------
 * Single queue for both weekly and monthly report jobs
 * =============================================================================
 */

import { Queue } from 'bullmq'
import redis from '../config/redis.js'

export const queue = new Queue('report-generation', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: 10, //Keep last 10 successful for audit trail
        removeOnFail: 5,  // Keep last 5 failed for debug cron issues
    }
})