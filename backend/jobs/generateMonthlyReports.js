/**
 * =============================================================================
 * Monthly Report Cron Job
 * -----------------------------------------------------------------------------
 * Runs on the 1st of every month at 00:05 JST
 * Generates last month's growth report for ALL active users
 * Ensures Report document exists
 * Idempotent + safe delay to avoid race with weekly jobs
 * =============================================================================
 */

import cron from 'node-cron'
import User from '../models/User.js'
import { getMonthlyKey } from '../utils/period.js'
import { generateReportService } from '../services/reportService.js';

// 1st of month, 00:05 JST → avoids conflict with weekly job
const JOB_CRON = '5 0 1 * *';
console.log('[Cron] generateMonthlyReports module loaded')
console.log('[Cron] Scheduling monthly report job:', JOB_CRON, 'in Asia/Tokyo');

export function startMonthlyReportJob() {
    cron.schedule(
        JOB_CRON,
        async () => {
            const startTime = Date.now()
            console.log(`[Monthly Cron] Starting at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })}`)

            let successCount = 0
            let failCount = 0

            try {
                const periodKey = getMonthlyKey()
                console.log(`[Monthly Cron] Target period: ${periodKey}`)

                const users = await User.find().select('_id')
                console.log(`[Monthly Cron] Found ${users.length} users`)

                for (const user of users) {
                    try {
                        await generateReportService({
                            userId: user._id.toString(),
                            type: "monthly",
                            periodKey,
                        })
                        successCount++;
                    } catch (err) {
                        failCount++
                        console.error(`[Monthly Cron] Failed to queue for user ${user._id}:`, err.message);
                    }
                }
            } catch (err) {
                console.error('[Monthly Cron] Fatal error:', err);
            } finally {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(
                    `[Monthly Cron] Completed in ${duration}s | Success: ${successCount} | Failed: ${failCount}`
                );
            }
        },
        {
            timezone: 'Asia/Tokyo',
        }
    )
}