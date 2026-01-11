import { Worker } from "bullmq";
import { getRedis } from '../config/redis.js'
import Note from "../models/Note.js";
import buildPrompt from '../utils/buildPrompt.js'
import OpenAI from 'openai'
import { sseManager } from '../utils/sseManager.js'
import dotenv from 'dotenv'
import { writeLog } from "../utils/log.js";
import { decodeDoubleEscapedMarkdown } from "../utils/decodeContent.js";
dotenv.config();
const client = new OpenAI()

/**
 * BullMQ worker for AI note processing using OpenAI's Responses API
 * - Streaming via SSE for real-time typewriter effect
 * - JSON mode enforced for reliable parsing
 * - Uses gpt-5-nano for fast, cost-effective processing
 */

//Worker: Process note with OpenAI

let worker

export function startAIWorker() {
    if (worker) return
    worker = new Worker(
        'ai-processing',
        async (job) => {
            const { noteId } = job.data
            const startTime = Date.now()

            writeLog(noteId, `JOB START at ${startTime}`)

            // 1. Fetch note
            const loadStart = Date.now()
            const note = await Note.findById(noteId)
            writeLog(noteId, `Loaded note in ${Date.now() - loadStart}ms`);

            if (!note) {
                console.log(`Note ${noteId} does not exist, skipping`)
                return
            }

            if (note.status === "completed") {
                console.log(`Note ${noteId} already completed`);
                return;
            }

            //2. Mark as processing (idempotent)
            if (note.status !== "processing") {
                await Note.findByIdAndUpdate(noteId, {
                    status: "processing",
                });
                note.status = "processing";
            }


            // 3. Backup user input
            await Note.findByIdAndUpdate(noteId, {
                previousContent: note.content || note.rawContent,
                previousTitle: note.title || "Untitled"
            })

            writeLog(noteId, "Previous content/title backed up")

            // 4. Build prompt
            const prompt = buildPrompt(note);
            writeLog(noteId, `Prompt built. Length = ${prompt.length}`)

            // --- STREAM CONTROL ---
            let streamedContent = "";  //<CONTENT> part
            let metadataBuffer = ""
            let contentBuffer = ""
            let mode = "CONTENT" // CONTENT | METADATA

            // TIMING
            let apiStart = null;
            let firstToken = null;

            // 5. Call OpenAI with streaming
            try {
                // OpenAI call
                writeLog(noteId, "Calling OpenAI...");
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

                writeLog(
                    noteId,
                    `OpenAI request accepted in ${Date.now() - apiStart}ms`
                );

                for await (const chunk of stream) {
                    const now = Date.now();
                    writeLog(
                        noteId,
                        `CHUNK: ${chunk.type} @ ${now} (${now - apiStart}ms after request)`
                    );

                    // First token
                    if (!firstToken && chunk.type === "response.output_text.delta") {
                        firstToken = now;
                        writeLog(
                            noteId,
                            `FIRST TOKEN after ${firstToken - apiStart}ms`
                        );
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
                        writeLog(
                            noteId,
                            `STREAM DONE. Total stream chars = ${streamedContent.length}`
                        );
                        break;
                    }
                }

                // 6. Parse final JSON safely
                let parsedMeta = {
                    title: "Untitled",
                    keywords: [],
                    summary: null,
                }

                if (metadataBuffer) {
                    try {
                        const raw = metadataBuffer
                            .replace(/^<METADATA>\s*/i, "")
                            .split("</METADATA>")[0]
                            .trim();

                        parsedMeta = JSON.parse(raw);
                    } catch (e) {
                        writeLog(noteId, `METADATA PARSE ERROR: ${e.message}`);
                    }
                }

                // 7. Save to DB
                await Note.findByIdAndUpdate(noteId, {
                    title: parsedMeta.title?.trim() || "Untitled",
                    content: streamedContent.trim(),
                    keywords: parsedMeta.keywords || [],
                    summary: parsedMeta.summary || null,
                    status: "completed",
                    previousContent: null,
                    previousTitle: null,
                });

                writeLog(noteId, "Saved note to database.")

                // 8. Notify frontend
                sseManager.send(noteId, {
                    type: "done",
                    data: {
                        title: parsedMeta.title,
                        keywords: parsedMeta.keywords,
                        summary: parsedMeta.summary,
                    },
                });

                writeLog(
                    noteId,
                    `JOB FINISHED in ${Date.now() - startTime}ms (First token: ${firstToken - apiStart
                    }ms)`
                )

            } catch (error) {

                writeLog(noteId, `ERROR: ${err?.message}`)

                // Mark as failed but retryable
                await Note.findByIdAndUpdate(noteId, { status: "retrying" })

                sseManager.send(noteId, {
                    type: "error",
                    message: `Processing failed, retrying... (${job.attemptsMade}/3)`,
                    retry: true,
                })
                //throw error, BullMQ will handle retry
                throw error
            }
        },

        {
            connection: getRedis(),
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

        const attempts = job.opts.attempts || 1
        const attempt = job.attemptsMade

        console.error(`AI job failed for note ${noteId} (attempt ${attempt}/${attempts}): ${err.message}`)

        // Not final attempt → do nothing
        if (attempt < attempts) {
            await Note.findByIdAndUpdate(noteId, { status: "retrying" })
            return
        }

        // All retry attempts failed → perform rollback
        try {
            const note = await Note.findById(noteId).lean()

            if (!note) {
                console.error("Note not found during rollback:", noteId);
                return;
            }

            await Note.updateOne(
                { _id: noteId },
                {
                    $set: {
                        title: note.previousTitle || "Untitled",
                        content: note.previousContent || note.rawContent || "[content lost]",
                        keywords: [],
                        summary: null,
                        status: "failed", //final failure
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

    console.log('[Worker] AI worker started');
    return worker
}