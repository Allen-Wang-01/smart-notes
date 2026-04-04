import { Worker } from "bullmq";
import { getRedis } from '../config/redis.js'
import Note from "../models/Note.js";
import buildPrompt from '../utils/buildPrompt.js'
import OpenAI from 'openai'
import { sseManager } from '../utils/sseManager.js'
import dotenv from 'dotenv'
import { createAIJobLogger, aiWorkerLogger } from "../utils/logger.js";
import { createHeartbeat } from "../services/heartbeatService.js";
import { recoverStuckJobs } from "../services/recoveryService.js";
import { lockNote } from "../services/noteLockService.js";
import { saveAIResult } from "../services/noteSaveService.js";
import { rollbackNote } from "../services/noteRollbackService.js";
import { isValidAnalysis } from "../utils/validators.js";
dotenv.config();
const client = new OpenAI()

/**
 * BullMQ worker for AI note processing using OpenAI's Responses API
 * - Streaming via SSE for real-time typewriter effect
 * - JSON mode enforced for reliable parsing
 * - Uses gpt-5-nano for fast, cost-effective processing
 */

//Worker: Process note with OpenAI

export async function startAIWorker() {
    await recoverStuckJobs() //  only once on boot
    const worker = new Worker(
        'ai-processing',
        async (job) => {
            const { noteId } = job.data
            const startTime = Date.now()

            const log = createAIJobLogger(job)
            log.info('job_started', { startTime })

            const generationId = job.id
            const heartbeat = createHeartbeat({ noteId, generationId })

            // 1. Atomically fetch + lock + backup
            const loadStart = Date.now()

            const { lockResult, note } = await lockNote(noteId, generationId)

            if (!lockResult) {
                log.info('job_skipped', { reason: 'already locked or completed' })
                return
            }

            log.info('note_locked', { durationMs: Date.now() - loadStart })

            // If no note returned -> either not exist or already locked
            if (!note) {
                log.info('job_skipped', { reason: 'note missing' })
                return;
            }

            // 2. Build prompt
            const prompt = buildPrompt(note);
            log.info('prompt_built', { promptLength: prompt.length })

            // --- STREAM CONTROL ---
            let streamedContent = "";  //<CONTENT> part
            let metadataBuffer = ""
            let contentBuffer = ""
            let mode = "CONTENT" // CONTENT | METADATA

            // TIMING
            let apiStart = null;
            let firstToken = null;

            // 3. Call OpenAI with streaming
            try {
                heartbeat.start()
                // OpenAI call
                log.info('llm_started')
                apiStart = Date.now();
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
                    store: false,
                })

                log.info('llm_request_accepted', { durationMs: Date.now() - apiStart })

                for await (const chunk of stream) {
                    // First token
                    if (!firstToken && chunk.type === "response.output_text.delta") {
                        firstToken = Date.now()
                        log.info('llm_first_token', { durationMs: firstToken - apiStart })
                    }

                    // ---- 1. delta chunk: response.output_text.delta ----

                    if (chunk.type === "response.output_text.delta") {
                        const text = chunk.delta || ""

                        // ===== CONTENT MODE =====


                        if (mode === "CONTENT") {
                            contentBuffer += text
                            const marker = "<METADATA>"
                            const markerIndex = contentBuffer.indexOf(marker)
                            if (markerIndex !== -1) {
                                const before = contentBuffer.slice(0, markerIndex)
                                const after = contentBuffer.slice(markerIndex + marker.length)
                                // streaming only real content
                                if (before) {
                                    streamedContent += before;
                                    sseManager.send(noteId, {
                                        type: "chunk",
                                        content: before,
                                    })
                                }

                                // switch to METADATA mode
                                mode = "METADATA";
                                metadataBuffer += after;

                                //clear buffer
                                contentBuffer = "";
                            } else {
                                // stream only the safe part
                                const safeLength = Math.max(
                                    0,
                                    contentBuffer.length - (marker.length - 1)
                                );

                                if (safeLength > 0) {
                                    const safeContent = contentBuffer.slice(0, safeLength);

                                    streamedContent += safeContent;
                                    sseManager.send(noteId, {
                                        type: "chunk",
                                        content: safeContent,
                                    });

                                    contentBuffer = contentBuffer.slice(safeLength);
                                }
                            }
                        } else if (mode === "METADATA") {
                            metadataBuffer += text
                        }
                        continue
                    }


                    if (chunk.type === "response.output_text.done") {
                        if (chunk.text) {
                            metadataBuffer += chunk.text
                        }
                        log.debug('raw_stream_dump', {
                            contentBuffer,
                            metadataBuffer,
                            mode,
                        })
                        log.info('llm_stream_done', { streamedChars: streamedContent.length })
                        break;
                    }
                }

                // 4. Parse final JSON safely
                let parsedMeta = {
                    title: "Untitled",
                    keywords: [],
                    summary: null,
                    analysis: null,
                }

                if (metadataBuffer) {
                    try {
                        const raw = metadataBuffer
                            .replace(/^<METADATA>\s*/i, "")
                            .split("</METADATA>")[0]
                            .trim();

                        const parsed = JSON.parse(raw);
                        parsedMeta = {
                            title: parsed.title ?? "Untitled",
                            keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
                            summary: parsed.summary ?? null,
                            analysis: isValidAnalysis(parsed.analysis) ? parsed.analysis : null,
                        }
                        log.info('metadata_parsed', { title: parsedMeta.title })
                    } catch (e) {
                        log.warn('metadata_parse_failed', { error: e.message })
                    }
                }

                // 5. Save to DB
                const saveSuccess = await saveAIResult({
                    noteId,
                    generationId: job.id,
                    content: streamedContent,
                    title: parsedMeta.title,
                    keywords: parsedMeta.keywords,
                    summary: parsedMeta.summary,
                    analysis: parsedMeta.analysis,
                })
                // if no document was modified, then lock lost
                if (!saveSuccess) {
                    log.warn('save_skipped', { reason: 'lock lost' })
                    return;
                }

                log.info('note_saved')

                // 6. Notify frontend
                sseManager.send(noteId, {
                    type: "done",
                    data: {
                        title: parsedMeta.title,
                        keywords: parsedMeta.keywords,
                        summary: parsedMeta.summary,
                    },
                });

                log.info('job_completed', {
                    totalMs: Date.now() - startTime,
                    firstTokenMs: firstToken ? firstToken - apiStart : null,
                })

            } catch (error) {
                log.error('job_failed', { error: error.message, stack: error.stack })
                //throw error, BullMQ will handle retry
                throw error
            } finally {
                heartbeat.stop()
            }
        },

        {
            connection: getRedis(),
            concurrency: 3, //Process up to 3 jobs in parallel
            limiter: { max: 15, duration: 1000 }, // rate limit: max 15 jobs per second, Prevent burst requests
        }
    )

    worker.on('completed', (job) => {
        aiWorkerLogger.info('worker_job_completed', {
            jobId: String(job.id),
            noteId: String(job.data.noteId),
        })
        console.log(`Job ${job.id} completed successfully for note ${job.data.noteId}`);
    });


    worker.on('failed', async (job, err) => {
        const noteId = job?.data?.noteId
        if (!noteId) return

        const attempts = job.opts.attempts || 1
        const attempt = job.attemptsMade

        aiWorkerLogger.error('worker_job_failed', {
            jobId: String(job?.id),
            noteId,
            attempt,
            attempts,
            error: err.message,
        })

        // Not final attempt → do nothing
        if (attempt < attempts) {
            await Note.findByIdAndUpdate(noteId, { status: "retrying" })
            sseManager.send(noteId, {
                type: "error",
                message: `Processing failed, retrying... (${job.attemptsMade}/3)`,
                retry: true,
            })
            return
        }

        // All retry attempts failed → perform rollback
        try {
            const success = await rollbackNote({
                noteId,
                generationId: job.id
            })


            if (!success) {
                aiWorkerLogger.warn('rollback_skipped', { noteId })
                return;
            }

            sseManager.send(noteId, {
                type: "error",
                message: "All retries failed. Your original note has been restored.",
                retry: false,
            });
        } catch (rollbackErr) {
            aiWorkerLogger.error('rollback_failed', { noteId, error: rollbackErr.message })
        }
    })

    aiWorkerLogger.info('worker_started')
    return worker
}