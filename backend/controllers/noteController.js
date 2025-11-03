import Note from '../models/Note'

/**
 * CREATE: Create a new note from NewNoteCard
 * Body: { rawContent: string, category?: string }
 * Returns: lightweight note with processing state
 */

export const createNote = async (req, res) => {
    const { rawContent, category = 'study' } = req.body
    const userId = req.userId
    if (!rawContent?.trim()) {
        return res.status(400).json({ error: 'rawContent is required' })
    }
    try {
        const note = new Note({
            userId,
            rawContent: rawContent.trim(),
            category,
            isProcessing: true,
        })

        await note.save()
        // TODO: Trigger BullMQ job in next step
        // await aiQueue.add('process-note', { noteId: note._id });

        res.status(201).json({
            message: 'Note created. AI is organizing your content.',
            note: {
                id: note._id,
                title: 'Processing...',
                category: note.category,
                date: note.createdAt,
                isProcessing: true,
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
    const userId = req.userId
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
    const userId = req.userId

    try {
        const note = await Note.findOne({ id: id, userId })
            .select('title content rawContent category keywords createdAt isProcessing')
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
                date: note.createdAt,
                isProcessing: note.isProcessing || false,
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
    const userId = req.userId;
    const updates = req.body
    //validate: at least one field
    if (!updates.title && !updates.content && !updates.category) {
        return res.status(400).json({ error: 'No updates provided' })
    }
    try {
        const note = await Note.findOneAndUpdate(
            { id: id, userId },
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
 * DELETE: Remove note from NoteEditor
 */

export const deleteNote = async (req, res) => {
    const { id } = req.params
    const userId = req.userId
    try {
        const note = await Note.findOneAndDelete({ _id: id, userId })

        if (!note) {
            return res.status(404).json({ error: 'Note not found' })
        }
        res.json({ message: 'Note deleted successfully' })
    } catch (error) {
        console.error('Delete note error:', error)
        res.status(500).json({ error: 'Failed to delete note' })
    }
}