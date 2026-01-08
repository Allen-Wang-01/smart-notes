import { Router } from "express"
import {
    createNote,
    getNotesList,
    getNoteById,
    updateNote,
    deleteNote,
    getNoteStream,
    regenerateNote
} from '../controllers/noteController.js'
import { apiRateLimiter, sseRateLimiter } from "../middleware/rateLimiters.js"
import authMiddleware from '../middleware/authMiddleware.js'

const router = Router()

router.use(authMiddleware)
router.post('/', apiRateLimiter, createNote)
router.get('/:id/stream', sseRateLimiter, getNoteStream)
router.post("/:id/regenerate", apiRateLimiter, regenerateNote);
router.get('/', apiRateLimiter, getNotesList)
router.get('/:id', apiRateLimiter, getNoteById)
router.put('/:id', apiRateLimiter, updateNote)
router.delete('/:id', apiRateLimiter, deleteNote)

export default router;