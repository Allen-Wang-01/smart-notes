/**
 * =============================================================================
 * Report Generation Queue
 * -----------------------------------------------------------------------------
 * Single queue for both weekly and monthly report jobs
 * =============================================================================
 */

import { Queue } from 'bullmq'
import { getRedis } from '../config/redis.js'

let reportQueue

export function getReportQueue() {
    if (reportQueue) return reportQueue

    reportQueue = new Queue('report-generation', {
        connection: getRedis(),
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
    return reportQueue
}