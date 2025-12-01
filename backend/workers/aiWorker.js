import { Worker } from "bullmq";
import redis from '../config/redis.js'
import Note from "../models/Note.js";
import buildPrompt from '../utils/buildPrompt.js'
import OpenAI from 'openai'
import { sseManager } from '../utils/sseManager.js'
import dotenv from 'dotenv'
dotenv.config();
const client = new OpenAI()


/**
 * BullMQ worker for AI note processing using OpenAI's Responses API
 * - Streaming via SSE for real-time typewriter effect
 * - JSON mode enforced for reliable parsing
 * - Uses gpt-5-nano for fast, cost-effective processing
 */

//Worker: Process note with OpenAI

const worker = new Worker(
    'ai-processing',
    async (job) => {
        const { noteId } = job.data
        //Fetch current note
        const note = await Note.findById(noteId)
        if (!note || !note.isProcessing) {
            console.log(`Note ${noteId} already processed or cancelled`)
            return
        }
        //generate prompt
        const prompt = buildPrompt(note);

        //backup current content for rollback
        await Note.findByIdAndUpdate(noteId, {
            previousContent: note.content || note.rawContent,
            previousTitle: note.title || "Untitled"
        })

        let fullResponse = ""

        try {
            // Use Responses API with streaming and JSON
            const stream = await client.responses.create({
                model: 'gpt-5-nano',
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: prompt,
                    },
                ],
                stream: true,
                response_format: { type: "json_object" }, //Ensures pure JSON output
                temperature: 0.3,
                max_tokens: 3500,
                timeout: 60_000, //60 seconds timeout
            })

            for await (const chunk of stream) {
                const delta = chunk.output?.[0]?.delta?.content || ""
                fullResponse += delta
                sseManager.send(noteId, { type: "chunk", content: delta })
            }

            const parsed = JSON.parse(fullResponse)

            // successed remove backup
            await Note.findByIdAndUpdate(noteId, {
                title: parsed.title?.trim() || "Untitled",
                content: parsed.content?.trim() || "",
                keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
                summary: parsed.summary || null,
                isProcessing: false,
                previousContent: null,
                previousTitle: null,
            })
            sseManager.send(noteId, { type: "done", data: parsed })
        } catch (error) {
            console.error(`OpenAI API error for note ${noteId}: `, error.message)

            sseManager.send(noteId, {
                type: "error",
                message: `Processing failed, retrying... (${(job.attemptsMade || 0) + 1}/3)`,
                retry: true,
            })
            //throw error, BullMQ will handle retry
            throw error
        }
    },

    {
        connection: redis,
        concurrency: 3, //Process up to 3 jobs in parallel
        limiter: { max: 15, duration: 1000 }, // rate limit: max 15 jobs per second, Prevent burst requests
    }
)

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully for note ${job.data.noteId}`);
});


worker.on('failed', async (job, err) => {
    const noteId = job?.data?.noteId
    if (!noteId) return
    console.error(`AI job failed for note ${noteId}: `, err.message)

    // All retry attempts failed → perform rollback
    try {
        await Note.updateOne(
            { _id, noteId },
            {
                $set: {
                    title: { $ifNull: ["$previousTitle", "Untitled"] },
                    content: { $ifNull: ["$previousContent", "$rawContent"] },
                    keywords: [],
                    summary: null,
                    isProcessing: false,
                },
                $unset: {
                    previousContent: "",
                    previousTitle: "",
                },
            }
        )

        sseManager.send(noteId, {
            type: "error",
            message: "All retries failed. Your original note has been restored.",
            retry: false,
        });
    } catch (rollbackErr) {
        console.error("Critical: rollback also failed!", rollbackErr);
    }
})

export default worker