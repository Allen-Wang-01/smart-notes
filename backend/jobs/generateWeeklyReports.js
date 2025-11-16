/**
 * =============================================================================
 * Weekly Report Cron Job
 * -----------------------------------------------------------------------------
 * Runs every Sunday at 00:00 JST
 * Generates last week's growth report for ALL active users
 * Idempotent: uses BullMQ jobId to prevent duplicates
 * =============================================================================
 */

import corn from 'node-cron'
import { queue } from '../queues/reportQueue'
import User from '../models/User.js'
import { getPreviousPeriodKey, getWeeklyKey } from '../utils/period.js'

// Schedule: Every Sunday at 00:00 JST (UTC+9)
// 00:00 JST = 15:00 UTC previous day → use cron in UTC
// But we set timezone to 'Asia/Tokyo' for clarity
const JOB_CRON = '0 0 * * 0'; // 00:00 every Sunday

console.log('[Cron] Scheduling weekly report job:', JOB_CRON, 'in Asia/Tokyo');

const weeklyJob = corn.schedule(
    JOB_CRON,
    async () => {
        const startTime = Date.now()
        console.log(`[Weekly Cron] Starting at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })}`)

        try {
            const periodKey = getPreviousPeriodKey(getWeeklyKey())
            console.log(`[Weekly Cron] Target period: ${periodKey}`)

            const users = await User.find({ isActive: true }).select('_id')
            console.log(`[Weekly Cron] Found ${users.length} active users`)

            let successCount = 0
            let failCount = 0

            for (const user of users) {
                try {
                    await queue.add(
                        'generate-weekly',
                        {
                            userId: user._id.toString(),
                            periodKey,
                        },
                        {
                            jobId: `weekly:${user._id}:${periodKey}`,
                            removeOnComplete: true,
                            removeOnFail: false,
                        }
                    );
                    successCount++
                } catch (err) {
                    console.error(`[Weekly Cron] Failed to queue for user ${user._id}:`, err.message)
                    failCount++
                }
            }
            const duration = ((Date.now() - startTime) / 1000).toFixed(2)
            console.log(`[Weekly Cron] Completed in ${duration}s | Success: ${successCount} | Failed: ${failCount}`)
        } catch (err) {
            console.error('[Weekly Cron] Fatal error:', err);
        }
    },
    {
        scheduled: false,
        timezone: 'Asia/Tokyo',
    }
);

// Start the job
weeklyJob.start();
console.log('[Cron] Weekly report job scheduled and running');
export default weeklyJob;