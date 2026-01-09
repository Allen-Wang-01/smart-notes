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
            let fullStreamText = "";  // all output includes FINAL_JSON
            let finalJsonString = null;

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


                    let incoming = "";


                    // ---- 1. delta chunk: response.output_text.delta ----

                    if (chunk.type === "response.output_text.delta") {
                        incoming = chunk.delta || "";
                        fullStreamText += incoming;


                        if (
                            fullStreamText.includes("<CONTENT>") &&
                            !fullStreamText.includes("<FINAL_JSON>")
                        ) {
                            const afterStart = fullStreamText.split("<CONTENT>")[1] || "";
                            const currentContent =
                                afterStart.split("</CONTENT>")[0] || "";

                            streamedContent = currentContent;

                            sseManager.send(noteId, {
                                type: "chunk",
                                content: incoming,
                            });
                        }

                        continue;
                    }


                    if (chunk.type === "response.output_text.done") {
                        incoming = chunk.text || "";
                        fullStreamText += incoming;


                        const afterContentTag = fullStreamText.split("<CONTENT>")[1] || "";
                        streamedContent = afterContentTag.split("</CONTENT>")[0] || "";

                        const afterJsonTag = fullStreamText.split("<FINAL_JSON>")[1] || "";
                        finalJsonString = afterJsonTag.split("</FINAL_JSON>")[0]?.trim() || "";

                        writeLog(
                            noteId,
                            `STREAM DONE. Total stream chars = ${fullStreamText.length}`
                        );

                        break;
                    }
                }

                // 6. Parse final JSON safely
                let parsed = null;

                if (finalJsonString) {
                    try {
                        parsed = JSON.parse(finalJsonString);
                    } catch (e) {

                        const fixed = finalJsonString
                            .replace(/\\n/g, "\n")
                            .replace(/\\"/g, '"');

                        parsed = JSON.parse(fixed);
                    }
                } else {
                    parsed = {
                        title: "Untitled",
                        summary: null,
                        keywords: [],
                        content: streamedContent,
                    };
                }

                // 7. Save to DB
                await Note.findByIdAndUpdate(noteId, {
                    title: parsed.title?.trim() || "Untitled",
                    content: decodeDoubleEscapedMarkdown(parsed.content?.trim()) || streamedContent,
                    keywords: parsed.keywords || [],
                    summary: parsed.summary || null,
                    status: "completed",
                    previousContent: null,
                    previousTitle: null,
                });

                writeLog(noteId, "Saved note to database.")

                // 8. Notify frontend
                sseManager.send(noteId, {
                    type: "done",
                    data: parsed,
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