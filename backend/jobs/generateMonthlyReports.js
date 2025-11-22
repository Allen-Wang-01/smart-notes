/**
 * =============================================================================
 * Monthly Report Cron Job
 * -----------------------------------------------------------------------------
 * Runs on the 1st of every month at 00:05 JST
 * Generates last month's growth report for ALL active users
 * Idempotent + safe delay to avoid race with weekly jobs
 * =============================================================================
 */

import corn from 'node-cron'
import { queue } from '../queues/reportQueue.js'
import User from '../models/User.js'
import { getPreviousPeriodKey, getWeeklyKey } from '../utils/period.js'

// 1st of month, 00:05 JST → avoids conflict with weekly job
const JOB_CRON = '5 0 1 * *';
console.log('[Cron] Scheduling monthly report job:', JOB_CRON, 'in Asia/Tokyo');

const monthlyJob = corn.schedule(
    JOB_CRON,
    async () => {
        const startTime = Date.now()
        console.log(`[Monthly Cron] Starting at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })}`)

        try {
            const periodKey = getPreviousPeriodKey(getWeeklyKey())
            console.log(`[Monthly Cron] Target period: ${periodKey}`)

            const users = await User.find({ isActive: true }).select('_id')
            console.log(`[Monthly Cron] Found ${users.length} active users`)

            let successCount = 0;
            let failCount = 0;

            for (const user of users) {
                try {
                    await queue.add(
                        'generate-monthly',
                        {
                            userId: user._id.toString(),
                            periodKey,
                        },
                        {
                            jobId: `monthly:${user._id}:${periodKey}`,
                            removeOnComplete: true,
                            removeOnFail: false,
                        }
                    );
                    successCount++;
                } catch (err) {
                    console.error(`[Monthly Cron] Failed to queue for user ${user._id}:`, err.message);
                    failCount++;
                }
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(
                `[Monthly Cron] Completed in ${duration}s | Success: ${successCount} | Failed: ${failCount}`
            );
        } catch (err) {
            console.error('[Monthly Cron] Fatal error:', err);
        }
    },
    {
        scheduled: false,
        timezone: 'Asia/Tokyo',
    }
)

// Start the job
monthlyJob.start();
console.log('[Cron] Monthly report job scheduled and running');

export default monthlyJob;