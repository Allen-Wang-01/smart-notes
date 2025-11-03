import { Worker } from "bullmq";
import redis from '../config/redis.js'
import Note from "../models/Note.js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

//Worker: Process note with OpenAI

const worker = new Worker(
    'ai-processing',
    async (job) => {
        const { noteId } = job.data
        try {
            const note = await Note.findById(noteId)
            if (!note || !note.isProcessing) return

            // Step 1: Generate structured content + title + keywords
            const prompt = `
                        You are a professional note organizer. Transform the user's raw note into:
                        1. A clean, structured Markdown content
                        2. A concise title (max 8 words)
                        3. 3-6 keywords

                        Raw note:
                        """
                        ${note.rawContent}
                        """

                        Respond in JSON:
                        {
                        "title": "string",
                        "content": "markdown string",
                        "keywords": ["string"]
                        }`;

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.3,
            })

            const result = JSON.parse(response.choices[0].message.content)

            // Step 2: Update note
            await Note.findByIdAndUpdate(noteId, {
                title: result.title,
                content: result.content,
                keywords: result.keywords,
                isProcessing: false,
            })
            console.log(`AI processed note: ${noteId}`)
        } catch (error) {
            console.error(`AI worker error (note ${noteId}): `, error)
            throw error // BullMQ will retry
        }
    },
    {
        connection: redis,
        concurrency: 3, // Process 3 notes at onces
    }
)

// Graceful shutdown
worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed: `, err.message)
})

export default worker