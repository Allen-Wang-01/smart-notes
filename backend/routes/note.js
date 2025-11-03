import { Router } from "express"
import {
    createNote,
    getNotesList,
    getNoteById,
    updateNote,
    deleteNote,
} from '../controllers/noteController.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = Router()

router.use(authMiddleware)
router.post('/', createNote)
router.get('/', getNotesList)
router.get('/:id', getNoteById)
router.put('/:id', updateNote)
router.delete('/:id', deleteNote)

export default router;