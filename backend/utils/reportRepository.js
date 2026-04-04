/**
 * PostgreSQL read/write for pperiod_reports
 * 
 * This table stores the full Python pipeline output (report_json + snapshot)
 * so the next period's job can use it for trend calculation
 * It is an internal store - users never query this directly
 * 
 * Required table (run once as a migration):
 *  CREATE TABLE IF NOT EXISTS period_repors(
 *      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *      user_id         TEXT NOT NULL,
 *      period          VARCHAR(10) NOT NULL,
 *      start_date      DATE NOT NULL,
 *      end_date        DATE NOT NULL,
 *      report_json     JSONB NOT NULL,
 *      snapshot        TEXT NOT NULL,
 *      created_at      TIMESTAMPTZ DEFAULT NOW(),
 *      UNIQUE (user_id, period, start_date)
 * )
 * 
 *  CREAT INDEX IF NOT EXISTS idx_period_reports_lookup
 *      ON period_reports (user_id, period, start_date DESC)
 */
import { db } from "../config/postgres.js"

/**
 * Fetch the most recent completed pipeline report for a user + period type
 * Returns null if no previous report exists.
 * 
 * @param {string} userId
 * @param {string} period 'weekly' | 'monthly'
 * @returns {Promise<object | null>}
 */

export async function getPreviousReport(userId, period) {
    try {
        const { rows } = await db.select('period_reports', {
            eq: {
                user_id: String(userId),
                period: period,
            },
            order: {
                column: 'start_date',
                ascending: false,
            },
            limit: 1,
        })

        return rows?.[0]?.report_json ?? null
    } catch (err) {
        // Treat a failed lookup as "no previous report" - the job can still
        // complete, just without trend data. The error is surfaced to the 
        // caller so it can be logged
        throw new Error(`getPreviousReport failed: ${err.message}`)
    }
}

/**
 * Upsert the pipeline report into PostgreSQL.
 * ON CONFLICT ensures this is idempotent - safe to retry without duplicates
 * 
 * @PARAM {{
 *  userId: string,
 *  period: string,
 *  startDate: string, // 'YYYY-MM-DD'
 *  endDate: string,   // 'YYYY-MM-DD'
 *  reportJson: object,
 *  snapshot: string,
 * }} params
 */
export async function savePipelineReport({
    userId,
    period,
    startDate,
    endDate,
    reportJson,
    snapshot,
}) {
    try {
        const { error } = await db.upsert('period_reports', {
            user_id: String(userId),
            period,
            start_date: startDate,
            end_date: endDate,
            report_json: reportJson,
            snapshot,
        }, {
            onConflict: ['user_id', 'period', 'start_date'],
        })

        if (error) throw error
    } catch (err) {
        throw new Error(`savePipelineReport failed: ${err.message}`)
    }
}