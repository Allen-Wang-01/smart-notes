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
import User from '../models/User.js'
import { generateReportService } from '../services/reportService.js'
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
        let successCount = 0
        let failCount = 0

        try {
            const periodKey = getPreviousPeriodKey(getWeeklyKey())
            console.log(`[Weekly Cron] Target period: ${periodKey}`)

            const users = await User.find({ isActive: true }).select('_id')
            console.log(`[Weekly Cron] Found ${users.length} active users`)

            for (const user of users) {
                try {
                    await generateReportService({
                        userId: user._id.toString(),
                        type: "weekly",
                        periodKey,
                    })
                    successCount++
                } catch (err) {
                    failCount++
                    console.error(
                        `[Weekly Cron] Failed for user ${user._id}:`,
                        err.message
                    )
                }

            }
        } catch (err) {
            console.error("[Weekly Cron] Fatal error:", err)
        } finally {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2)
            console.log(
                `[Weekly Cron] Completed in ${duration}s | Success: ${successCount} | Failed: ${failCount}`
            )
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