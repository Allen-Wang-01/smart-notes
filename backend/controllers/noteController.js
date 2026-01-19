import Note from '../models/Note.js'
import { getAIQueue } from '../queues/aiQueue.js'
import { sseManager } from '../utils/sseManager.js'
import { aiWorkerController } from '../workers/aiWorkerController.js'

/**
 * GET /api/notes/:id/stream
 * SSE Stream: real-time AI processing
 */

export const getNoteStream = async (req, res) => {
    const { id } = req.params
    const userId = req.user.userId

    // vertify the note exists and belongs to the user
    const note = await Note.findOne({ _id: id, userId })
    if (!note) {
        return res.status(404).json({ error: 'Note not found' })
    }

    //if the note is already processed, return it immediately
    if (["completed", "failed"].includes(note.status)) {
        return res.status(200).json({
            title: note.title,
            content: note.content,
            status: note.status,
        });
    }

    //set Server-Sent Events (SSE) headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    //register the sse client connection for this note
    sseManager.addClient(id, res)

    //send and initial "start" event to the client
    //so the frontend knows that the stream connection has been successfully established
    res.write(`data: ${JSON.stringify({ type: 'start', noteId: id })}\n\n`)

    // Clean up when the client closes the connection
    req.on('close', () => {
        sseManager.removeClient(id, res)
    })
}

/**
 * CREATE: Create a new note from NewNoteCard
 * Body: { rawContent: string, category?: string }
 * Returns: lightweight note with processing state
 */

export const createNote = async (req, res) => {
    const { rawContent, category = 'study' } = req.body
    const userId = req.user.userId
    if (!rawContent?.trim()) {
        return res.status(400).json({ error: 'rawContent is required' })
    }
    const aiQueue = getAIQueue()
    try {
        const note = new Note({
            userId,
            rawContent: rawContent.trim(),
            category,
            status: "pending",
        })

        await note.save()

        // Trigger BullMQ job
        await aiQueue.add('process-note',
            { noteId: note._id },
            { jobId: `process-${note._id}`, removeOnComplete: true, removeOnFail: true }
        );

        await aiWorkerController.ensureRunning()

        res.status(201).json({
            message: 'Note created. AI is organizing your content.',
            note: {
                id: note._id,
                title: 'Processing...',
                category: note.category,
                date: note.createdAt,
                status: "pending",
            },
        })
    } catch (error) {
        console.error('Create note error:', error)
        res.status(500).json({ error: 'Failed to create note' })
    }
}

/**
 * READ LIST: Get lightweight notes for Sidebar
 * Query: ?page=1&limit=20
 * Returns: [{ id, title, category, date }]
 */

export const getNotesList = async (req, res) => {
    const userId = req.user.userId
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit
    try {
        const notes = await Note.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('title category createdAt')
            .lean()

        const total = await Note.countDocuments({ userId })
        // Format date for frontend
        const formattedNotes = notes.map(note => ({
            id: note._id,
            title: note.title || 'Untitled',
            category: note.category,
            date: note.createdAt,
        }))

        res.json({
            notes: formattedNotes,
            pagination: { page, limit, total }
        })
    } catch (error) {
        console.error('Get notes list error:', error)
        res.status(500).json({ error: 'Failed to fetch notes' })
    }
}

/**
 * READ DETAIL: Get full note for NoteEditor
 * Path: /:id
 * Returns: full note with rawContent, content, keywords
 */

export const getNoteById = async (req, res) => {
    const { id } = req.params
    const userId = req.user.userId

    try {
        const note = await Note.findOne({ _id: id, userId: userId })
            .select('title content rawContent category keywords createdAt updatedAt status')
            .lean()

        if (!note) {
            return res.status(404).json({ error: 'Note not found' })
        }

        res.json({
            note: {
                id: note._id,
                title: note.title || 'Untitled',
                content: note.content || note.rawContent,
                rawContent: note.rawContent,
                category: note.category,
                keywords: note.keywords || [],
                created: note.createdAt,
                updated: note.updatedAt,
                status: note.status,
            },
        })
    } catch (error) {
        console.error('Get note by Id error:', error)
        res.status(500).json({ error: 'Failed to fetch note' })
    }
}

/**
 * UPDATE: Save edits from NoteEditor
 * Body: { title?, content?, category? }
 */

export const updateNote = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const updates = req.body
    //validate: at least one field
    if (!updates.title && !updates.content && !updates.category) {
        return res.status(400).json({ error: 'No updates provided' })
    }
    try {
        const note = await Note.findOneAndUpdate(
            { _id: id, userId: userId },
            { $set: updates },
            { new: true, runValidators: true }
        ).select('title content category keywords createdAt')

        if (!note) {
            return res.status(404).json({ error: 'Note not found' })
        }

        res.json({
            message: 'Note updated successfully',
            note: {
                id: note._id,
                title: note.title,
                content: note.content,
                category: note.category,
                keywords: note.keywords || [],
                date: note.createdAt,
            },
        })
    } catch (error) {
        console.error('Update note error:', error)
        res.status(500).json({ error: 'Failed to update note' })
    }
}

/**
 * REGENERATE NOTE: POST /api/notes/:id/regenerate
 *
 * This endpoint triggers an AI reprocessing job for an existing note.
 * It is used when the user requests to "regenerate" a note’s content.
 *
 * Workflow:
 * 1. Validates that the note exists and belongs to the authenticated user.
 * 2. Creates a backup of the current content (in case regeneration fails).
 * 3. Resets the note’s title, content, and keywords, and marks it as processing.
 * 4. Enqueues a new BullMQ job ("process-note") to have the AI regenerate the note.
 * 5. Returns the updated note metadata with `status = processing`.
 *
 * The frontend will automatically receive the regenerated content
 * through the existing SSE (Server-Sent Events) stream endpoint:
 *     GET /api/notes/:id/stream
 *
 * If AI regeneration fails, the system restores the note’s previous content
 * from the backup to ensure no data loss.
 */
export const regenerateNote = async (req, res) => {
    const { id } = req.params
    const userId = req.user.userId

    const aiQueue = getAIQueue()
    try {
        const note = await Note.findOne({ _id: id, userId })
        if (!note) {
            return res.status(404).json({ error: "Note not found" })
        }

        await Note.findByIdAndUpdate(id, {
            status: "pending",
            title: "Regenerating...",
            content: "",
            keywords: [],
            summary: null,
        })

        //add a new job to the AI queue
        await aiQueue.add(
            "process-note",
            { noteId: note._id },
            {
                jobId: `regenerate-${note._id}-${Date.now()}`,
                removeOnComplete: true,
                removeOnFail: true,
            }
        )

        await aiWorkerController.ensureRunning()

        res.status(200).json({
            message: "Note regeneration started"
        })
    } catch (error) {
        console.error("Regenerate note error: ", error)
        res.status(500).json({ error: "Failed to regenerate note" })
    }
}

/**
 * DELETE: Remove note from NoteEditor
 */

export const deleteNote = async (req, res) => {
    const { id } = req.params
    const userId = req.user.userId
    try {
        const note = await Note.findOneAndDelete({ _id: id, userId: userId })

        if (!note) {
            return res.status(404).json({ error: 'Note not found' })
        }
        res.json({ message: 'Note deleted successfully' })
    } catch (error) {
        console.error('Delete note error:', error)
        res.status(500).json({ error: 'Failed to delete note' })
    }
}