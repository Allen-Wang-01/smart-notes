import { Router } from 'express'
import { getTopics, getTopicEntries } from '../controllers/savedMemoryController.js'
import { apiRateLimiter } from '../middleware/rateLimiters.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = Router()

router.use(authMiddleware)
router.get('/topics', apiRateLimiter, getTopics)
router.get('/topics/:topic', apiRateLimiter, getTopicEntries)

export default router
