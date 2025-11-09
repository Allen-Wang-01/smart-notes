import { Worker } from "bullmq";
import redis from '../config/redis.js'
import Note from "../models/Note.js";
import buildPrompt from '../utils/buildPrompt.js'
import OpenAI from 'openai'
import { sseManager } from '../utils/sseManager.js'

// const openai = new OpenAI({
//     //apiKey: process.env.OPENAI_API_KEY,
//     apiKey: xxxxxx,
// })

//Worker: Process note with OpenAI

const worker = new Worker(
    'ai-processing',
    async (job) => {
        const { noteId } = job.data
        const note = await Note.findById(noteId)
        if (!note || !note.isProcessing) return
        //generate prompt
        const prompt = buildPrompt(note);

        const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            stream: true,
        })

        let fullText = ''

        //stream loop
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
            } else {
                console.warn(`No JSON object found in model output for note ${noteId}`)
            }

            //success path
            await Note.findByIdAndUpdate(noteId, {
                title,
                content,
                keywords,
                isProcessing: false,
                previousContent: undefined, //clear backup after success
            })

            sseManager.send(noteId, {
                type: 'done',
                data: { title, content },
            })
            return { title, content, keywords }

        } catch (err) {
            console.error('AI regeneration parse or save error:', err)

            //rollback path
            const rollbackNote = await Note.findById(noteId)
            if (rollbackNote?.previousContent) {
                await Note.findByIdAndUpdate(noteId, {
                    content: rollbackNote.previousContent,
                    title: rollbackNote.title || "Untitled",
                    isProcessing: false,
                })
            }

            sseManager.send(noteId, {
                type: "error",
                message: "AI regeneration failed, rolled back to previous content."
            })
            return null
        }
    },

    { connection: redis, concurrency: 2 }
)

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
});


worker.on('failed', (job, err) => {
    sseManager.send(job.data.noteId, {
        type: 'error',
        message: err.message,
    });
    console.error(`Job ${job.id} failed: `, err.message)
})

export default worker