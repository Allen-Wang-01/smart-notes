/**
 * =============================================================================
 * Report Generation Worker
 * -----------------------------------------------------------------------------
 * Consumes 'generate-weekly' and 'generate-monthly' jobs from BullMQ
 * Aggregates Note summaries + stats → calls OpenAI → streams via SSE
 * Idempotent by design (jobId ensures single execution)
 * =============================================================================
 */

import { Worker } from "bullmq";
import Note from "../models/Note.js";
import Report from "../models/Report.js";
import { getRedis } from '../config/redis.js'
import { buildReportPrompt, buildLowActivityPrompt } from "../utils/buildReportPrompt.js";
import { generateReportText } from "../utils/generateReport.js";
import dotenv from 'dotenv'
import { writeLog } from "../utils/log.js"
dotenv.config();

let worker
export function startReportWorker() {
    if (worker) return

    worker = new Worker(
        'report-generation',
        async (job) => {
            console.log('job.data:', job.data)
            const { reportId, userId, periodKey, startDate, endDate } = job.data
            const type = periodKey.includes('-W') ? 'weekly' : 'monthly'
            console.log("workerKey: ", periodKey)
            // update status to processing
            const locked = await Report.findOneAndUpdate(
                { _id: reportId, status: 'pending' },
                { status: 'processing', generatedAt: new Date() }
            )

            if (!locked) {
                const report = await Report.findById(reportId)

                if (!report || report.status === 'completed') {
                    return { skipped: true }
                }

                throw new Error(`Unexpected report state: ${report?.status}`)
            }

            try {
                // load notes of this period
                const notes = await Note.find({
                    userId,
                    createdAt: { $gte: startDate, $lte: endDate },
                    summary: { $ne: null },
                }).select('summary keywords title createdAt')

                // build stats
                const stats = buildStats(notes)

                writeLog(reportId, JSON.stringify(stats, null, 2))

                if (stats.noteCount === 0) {
                    await Report.findByIdAndUpdate(reportId, {
                        status: 'completed',
                        content: [
                            "You didn’t leave any notes during this period, and that’s okay.",
                            "Every journey has quiet weeks — your next reflection is waiting."
                        ],
                        poeticLine: "Silence, too, is part of becoming.",
                        stats,
                        generatedAt: new Date(),
                    })
                    return { skippedAI: true }
                }

                const representativeSummaries = notes
                    .slice(0, 3)
                    .map((n) => `- "${n.summary}"`)
                    .join('\n');

                //  Construct AI prompt
                let prompt
                if (stats.noteCount <= 2) {
                    prompt = buildLowActivityPrompt({
                        stats,
                        summaries: representativeSummaries,
                    })
                } else {
                    prompt = buildReportPrompt({
                        type,
                        stats,
                        summaries: representativeSummaries,
                        periodKey,
                    })
                }

                writeLog(reportId, prompt)

                // Call OpenAI, non-streaming
                const reportResult = await generateReportText(prompt)

                writeLog(reportId, JSON.stringify(reportResult, null, 2))

                // save final report
                await Report.findOneAndUpdate(
                    { _id: reportId, status: 'processing' },
                    {
                        status: 'completed',
                        content: reportResult.summary,
                        poeticLine: reportResult.poeticLine,
                        stats,
                        generatedAt: new Date(),
                    }
                )
                return { success: true, periodKey };
            } catch (err) {
                await Report.findOneAndUpdate(
                    { _id: reportId, status: 'processing' },
                    {
                        status: 'failed',
                        errorMessage: err instanceof Error ? err.message : String(err),
                    }
                )

                console.error(`Report generation failed [${reportId}]:`, err);
                throw err; // BullMQ will retry
            }
        },
        {
            connection: getRedis(),
            concurrency: 3,
        }
    )

    worker.on('completed', (job) => {
        console.log(`[Report Worker] Successfully generated ${job.data.periodKey} for user ${job.data.userId}`);
    });

    worker.on('failed', async (job, err) => {
        console.error(
            `[Report Worker] ✖ Failed report: ${job.data.periodKey} | User: ${job.data.userId} | Attempts: ${job.attemptsMade} | Error: ${err.message}`
        );
    });

    console.log('[Worker] Report worker started');
    return worker
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildStats(notes) {
    const noteCount = notes.length
    const activeDays = new Set(notes.map((n) => n.createdAt.toISOString().slice(0, 10))).size
    const keywordMap = {}
    notes.forEach((n) => {
        n.keywords.forEach((kw) => {
            keywordMap[kw] = (keywordMap[kw] || 0) + 1
        })
    })

    const topKeywords = Object.entries(keywordMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword, count]) => ({ keyword, count }))

    return { noteCount, activeDays, topKeywords }
}