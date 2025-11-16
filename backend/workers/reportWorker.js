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
import { queue } from '../queues/reportQueue.js'
import OpenAI from "openai";
import { sseManager } from "../utils/sseManager.js";
import { getWeeklyKey, getMonthlyKey } from "../utils/period";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

const worker = new Worker(
    'report-generation',
    async (job) => {
        const { reportId, userId, periodKey, startDate, endDate } = job.data
        const type = periodKey.includes('-W') ? 'weekly' : 'monthly'

        // update status to processing
        await Report.findByIdAndUpdate(reportId, {
            status: 'processing',
            generatedAt: new Date(),
        })

        sseManager.send(reportId, {
            type: 'status',
            status: 'processing',
            message: `Crafting your ${type === 'weekly' ? 'weekly' : 'monthly'} growth journey…`,
        })

        try {
            // aggregate notes in period
            const notes = await Note.find({
                userId,
                createdAt: { $gte: startDate, $lte: endDate },
                summary: { $ne: null },
            }).select('summary keywords title created At')

            if (notes.length === 0) {
                throw new Error('No notes with summary in thie period')
            }

            // build stats
            const stats = buildStats(notes, type)
            const representativeSummaries = notes
                .slice(0, 5)
                .map((n) => `- "${n.summary}"`)
                .join('\n');

            //  Construct AI prompt
            const prompt = buildPrompt(type, stats, representativeSummaries, periodKey);

            // Stream OpenAI response
            const stream = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                stream: true,
            });

            let fullText = '';
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content || '';
                fullText += delta;
                sseManager.send(reportId, { type: 'chunk', content: delta });
            }

            // Parse AI output
            const result = JSON.parse(fullText);
            const { summary, poetic } = result;

            // save final report
            await Report.findByIdAndUpdate(reportId, {
                status: 'completed',
                content: summary,
                poeticLine: poetic,
                stats,
                generatedAt: new Date(),
            });

            sseManager.send(reportId, {
                type: 'done',
                data: { summary, poetic, stats },
            });

            return { success: true, periodKey };
        } catch (err) {
            console.error(`Report generation failed [${reportId}]:`, err);

            await Report.findByIdAndUpdate(reportId, {
                status: 'failed',
            });

            sseManager.send(reportId, {
                type: 'error',
                message: 'generation failed, please try again',
            });

            throw err; // BullMQ will retry
        }
    },
    {
        connection: queue.connection,
        concurrency: 3,
    }
)

// =============================================================================
// Helper Functions
// =============================================================================

function buildStats(notes, type) {
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


function buildPrompt(type, stats, summaries, periodKey) {
    const isWeekly = type === 'weekly';
    const weekNum = periodKey.split('-W')[1];
    const monthLabel = periodKey.replace('-M', '-').replace(/(\d{4})-(\d{2})/, '$1 Month $2');
    const timeLabel = isWeekly
        ? `Week ${weekNum}`
        : monthLabel;

    return `
You are a warm and insightful growth companion, creating a ${isWeekly ? 'weekly' : 'monthly'} reflection for the user.

### Data Overview
- Time: ${timeLabel}
- Total Notes: ${stats.noteCount}
- Active Days: ${stats.activeDays}
- Top Keywords: ${stats.topKeywords.map(k => k.keyword).join(', ')}

### Representative Summaries
${summaries}

### Requirements
1. Generate 2–3 natural, encouraging, and insightful sentences (like a friend sharing observations)
2. Include at least **one specific detail** (e.g., a keyword or behavior)
3. End with **one poetic closing line** (10–18 words, vivid and evocative)
4. Output in JSON:
{
  "summary": ["Sentence 1", "Sentence 2"],
  "poetic": "Between code and coffee, you wrote your own spring."
}
`.trim();
}