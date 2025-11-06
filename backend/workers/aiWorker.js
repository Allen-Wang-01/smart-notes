import { Worker } from "bullmq";
import redis from '../config/redis.js'
import Note from "../models/Note.js";
import OpenAI from 'openai'
import sseManager from '../utils/sseManager.js'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

//Worker: Process note with OpenAI

const worker = new Worker(
    'ai-processing',
    async (job) => {
        const { noteId } = job.data
        const note = await Note.findById(noteId)
        if (!note || !note.isProcessing) return
        const prompt = `
                        You are a professional note organizer. Transform the user's raw note into:
                1. A clean, structured Markdown content
                2. A concise title (max 8 words)
                3. 3–6 keywords

                Raw note:
                """
                ${note.rawContent}
                """

                Respond in JSON:
                {
                "title": "string",
                "content": "markdown string",
                "keywords": ["string"]
                }
                `
        const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            stream: true,
        })

        let fullText = ''

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta.content || ''
            fullText += delta

            sseManager.send(noteId, { type: 'chunk', content: delta })
        }

        let title = 'Untitled'
        let content = note.rawContent
        let keywords = []

        try {
            const jsonMatch = fullText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0])
                title = result.title || title
                content = result.content || content
                keywords = result.keywords || []
            } else if (!jsonMatch) {
                console.warn(`No JSON object found in model output for note ${noteId}`)
            }
        } catch (err) {
            console.error('JSON parse error:', err)
        }
        await Note.findByIdAndUpdate(noteId, {
            title,
            content,
            keywords,
            isProcessing: false,
        })

        sseManager.send(noteId, {
            type: 'done',
            data: { title, content }
        })

        return { title, content, keywords }
    },
    { connection: redis, concurrency: 2 }
)

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
});


// Graceful shutdown
worker.on('failed', (job, err) => {
    sseManager.send(job.data.noteId, {
        type: 'error',
        message: err.message,
    });
    console.error(`Job ${job.id} failed: `, err.message)
})

export default worker