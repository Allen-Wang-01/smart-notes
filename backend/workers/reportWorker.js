/**
 * BullMQ worker for report generation
 * 
 * Job flow
 * --------
 * 1. Lock the report document (idempotency guard)
 * 2. Fetch notes from MongoDB
 * 3. Fetch previous pipeline -> report_json + snapshot
 * 4. Run Python analytics pipeline -> report_json + snapshot
 * 5. Call LLM with snapshot -> paragraphs
 * 6. Save pipeline report to PostgreSQL (for next period's trend)
 * 7. Update MongoDB report document -> completed
 * 
 * Error handling
 * --------------
 * - LLM errors: retried inside generateReportText() with exponential backoff
 * - Python errors: surface immediately, BullMQ retries the whole job
 * - PostgreSQL write failture: logged but does not faile the job -
 *  the user still gets their report; only trend data for the next period is affected
 * - Any other error: marks report as 'failed' in MongoDB, then re-throws
 *   so BullMQ can retry according to the job's retry policy 
 */

import { Worker } from "bullmq";
import Note from "../models/Note.js";
import Report from "../models/Report.js";
import { getRedis } from '../config/redis.js'
import { generateReportText } from "../utils/generateReport.js";
import dotenv from 'dotenv'
import { createJobLogger, workerLogger } from "../utils/logger.js";
import { runPythonPipeline } from "../utils/pythonRunner.js";
import { getPreviousReport, savePipelineReport } from "../utils/reportRepository.js";
dotenv.config();


export function startReportWorker() {
    const worker = new Worker(
        'report-generation',
        async (job) => {
            console.log('job.data:', job.data)
            const { reportId, userId, periodKey, startDate, endDate } = job.data
            const period = periodKey
            const log = createJobLogger(job)
            console.log("workerKey: ", periodKey)
            log.info('job_started', { reportId, period })
            // Lock the report (idempotency guard)
            // findOneAndUpdate with status: 'pending' ensures only one worker
            // processes this job event if BullMQ delivers it more than once.
            const locked = await Report.findOneAndUpdate(
                { _id: reportId, status: 'pending' },
                { status: 'processing', generatedAt: new Date() }
            )

            if (!locked) {
                const report = await Report.findById(reportId)

                if (!report) {
                    log.info('job_skipped', { reason: 'report not found' })
                    return { skipped: true }
                }

                if (report.status === 'completed') {
                    log.info('job_skipped', { reason: 'already completed' })
                    return { skipped: true }
                }

                if (report.status === 'failed') {
                    await Report.findOneAndUpdate(
                        { _id: reportId, status: 'failed' },
                        { status: 'processing', generatedAt: new Date(), $unset: { errorMessage: "" } }
                    )
                    log.info('job_retrying', { reportId, previousStatus: 'failed' })
                } else {
                    // pending/processing but not locked, then there is another worker working on this job
                    throw new Error(`Unexpected report state: ${report?.status}`)
                }
            }

            try {
                // Fetch notes from MongoDB
                // analysis and rawContent are required by the Python pipeline.
                // .lean() returns plain objects - faster and uses less memory.
                const notes = await Note.find({
                    userId,
                    createdAt: { $gte: startDate, $lte: endDate },
                    summary: { $ne: null },
                }).select('_id summary keywords title createdAt rawContent analysis sourceType description').lean()

                log.info('notes_fetched', { count: notes.length })

                // Fetch previous pipeline report from PostgreSQL
                // Failure here is non-fatal: we log a warning and continue without
                // trend data rather than failing the whole job.
                let previousReport = null
                try {
                    previousReport = await getPreviousReport(String(userId), period)
                    log.info('previous_report_fetched', { found: previousReport !== null })
                } catch (err) {
                    log.warn('previous_report_fetch_failed', {
                        error: err.message,
                        impact: 'trend data will be unavailable for this report',
                    })
                }

                // Run Python analytics pipeline
                const pythonPayload = {
                    notes,
                    period,
                    startDate: toDateOnly(startDate),
                    endDate: toDateOnly(endDate),
                    previousReport: previousReport ?? null,
                }
                log.info('python_started', { noteCount: notes.length })
                const reportJson = await runPythonPipeline(pythonPayload, log)
                log.info('python_completed', {
                    noteCount: reportJson.summary?.note_count,
                    hasSnapshot: typeof reportJson.snapshot === 'string',
                })

                // Call LLM
                // generateReportText() retries internally with exponential backoff.
                // If all retries fail it throws, which lands us in the catch block.
                log.info('llm_started')
                const llmResult = await generateReportText(reportJson.snapshot, {
                    userId: String(userId),
                    recordId: String(reportId),
                })
                log.info('llm_completed')

                // Save pipeline report to PostgreSQL
                // Non-fatal: a save failture means the next period won't have trend
                // data, but the current report is still delivered to the user.
                try {
                    await savePipelineReport({
                        userId: String(userId),
                        period,
                        startDate: toDateOnly(startDate),
                        endDate: toDateOnly(endDate),
                        reportJson,
                        snapshot: reportJson.snapshot,
                    })
                    log.info('postgres_saved')
                } catch (err) {
                    log.error('postgres_save_failed', {
                        error: err.message,
                        impact: 'trend data for next period unavailable',
                        reportId,
                        userId: String(userId),
                        period,
                        alert: true,
                    })
                }

                // Extract stats for MongoDB (matches existing Report schema) 
                const stats = {
                    noteCount: reportJson.summary?.note_count ?? 0,
                    activeDays: reportJson.time_patterns?.active_days ?? 0,
                    topKeywords: _extractTopKeywords(reportJson),
                }

                // Update MongoDB report -> completed
                await Report.findOneAndUpdate(
                    { _id: reportId, status: 'processing' },
                    {
                        status: 'completed',
                        content: llmResult.paragraphs,
                        stats,
                        generatedAt: new Date(),
                    }
                )

                log.info('job_completed', { periodKey })
                return { success: true, periodKey }

            } catch (err) {
                log.error('job_failed', {
                    error: err.message,
                    stack: err.stack,
                })

                // Mark as failed in MongoDB so the UI can surface the error state.
                // Use updateOne to aviod overwriting a 'completed' doc if somehow
                // we ended up here after a partial success.

                await Report.updateOne(
                    { _id: reportId, status: 'processing' },
                    {
                        status: 'failed',
                        errorMessage: err instanceof Error ? err.message : String(err),
                    }
                ).catch((updateErr) => {
                    // If even this update fails, log it but don't throw again
                    // we want BullMQ to see the original error.
                    log.error('failed_status_update_error', { error: updateErr.message })
                })

                console.error(`Report generation failed [${reportId}]:`, err);
                throw err; // BullMQ will retry
            }
        },
        {
            connection: getRedis(),
            concurrency: 3,
        }
    )

    //Worker-level events (outside individual job context)
    worker.on('completed', (job) => {
        workerLogger.info('worker_job_completed', {
            jobId: String(job.id),
            userId: String(job.data.userId),
            period: job.data.periodKey,
        })
    });


    worker.on('failed', async (job, err) => {
        workerLogger.error('worker_job_failed', {
            jobId: String(job?.id),
            userId: String(job?.data.userId),
            period: job?.data.periodKey,
            attempts: job?.attemptsMade,
            error: err.message,
        })
    });

    workerLogger.info('[Worker] Report worker started')
    return worker
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract top keywords from the Python report_json into the format
 * expected by the MongoDB Report schema: [{keyword, count}]
 * 
 * Falls back to an empty array if the field is missing or malformed
 * 
 * @param {object} reportJson
 * @returns {{keyword: string, count: number} []}
 */
function _extractTopKeywords(reportJson) {
    try {
        const topics = reportJson.summary?.top_topics ?? {}
        return Object.entries(topics)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([keyword, count]) => ({ keyword, count }))
    } catch {
        return []
    }
}


/**
 * Convert a Date into a local "YYYY-MM-DD" string (date-only, no timezone).
 *
 * ⚠️ Why not use toISOString().slice(0, 10)?
 * Because toISOString() converts the date to UTC, which can shift the day
 * depending on the local timezone.
 *
 * Example (Asia/Tokyo, UTC+9):
 * - Local time: 2026-04-07 00:00
 * - toISOString(): 2026-04-06T15:00:00Z
 * - slice(0,10): "2026-04-06" ❌ (incorrect day)
 *
 * This function uses local time (getFullYear, getMonth, getDate)
 * to preserve the correct calendar date.
 *
 * @param {Date|string|number} date - Input date
 * @returns {string} Date string in "YYYY-MM-DD" format
 */
function toDateOnly(date) {
    const d = new Date(date)
    const pad = n => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}