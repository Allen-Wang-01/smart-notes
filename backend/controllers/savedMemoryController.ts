import { Request, Response } from 'express'
import { listSavedMemoryTopics, getSavedMemoryByTopic } from '../lib/mcpTools.js'

export const getTopics = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await listSavedMemoryTopics({ userId: (req as any).user.userId })
        res.json(result)
    } catch {
        res.status(500).json({ message: 'Failed to fetch memory topics' })
    }
}

export const getTopicEntries = async (req: Request, res: Response): Promise<void> => {
    const topic = Array.isArray(req.params['topic']) ? req.params['topic'][0] : req.params['topic']
    if (!topic?.trim()) {
        res.status(400).json({ message: 'topic is required' })
        return
    }

    try {
        const result = await getSavedMemoryByTopic({
            userId: (req as any).user.userId,
            topic: decodeURIComponent(topic),
        })
        res.json(result)
    } catch {
        res.status(500).json({ message: 'Failed to fetch memory entries' })
    }
}
