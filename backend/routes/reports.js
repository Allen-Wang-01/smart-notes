/**
 * =============================================================================
 * Report Routes
 * -----------------------------------------------------------------------------
 * GET /api/reports/weekly?date=YYYY-MM-DD
 * GET /api/reports/monthly?year=YYYY&month=MM
 *
 * Returns:
 * - 200: { report, streamUrl? }
 * - 202: { status: 'processing', streamUrl }
 * - 400: Validation error
 * =============================================================================
 */

import { Router } from "express";
import {
    getWeeklyReport,
    getMonthlyReport,
    getAvailablePeriods,
    retryReport,
    generateReport,
} from '../controllers/reportController.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = Router()

// All report routes require authentication
router.use(authMiddleware)

// Weekly report
router.get('/weekly', async (req, res) => {
    try {
        const { selectedWeekPeriod } = req.query
        if (!selectedWeekPeriod) {
            return res.status(400).json({ error: 'Query param `selectedWeekPeriod` is required' })
        }

        const result = await getWeeklyReport(req.user.userId, selectedWeekPeriod)
        res.status(result.status).json(result.data)
    } catch (err) {
        console.error('Weekly report error: ', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// Monthly resport
router.get('/monthly', async (req, res) => {
    try {
        const { selectedMonthPeriod } = req.query
        if (!selectedMonthPeriod) {
            return res
                .status(400)
                .json({ error: 'Query params selectedMonthPeriod are required' })
        }
        const result = await getMonthlyReport(req.user.userId, selectedMonthPeriod)
        res.status(result.status).json(result.data)
    } catch (err) {
        console.error('Monthly report error: ', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

//GET /available-periods
router.get('/available-periods', getAvailablePeriods)
// Post /:reportId/retry
router.post('/retry/:reportId', retryReport)
// Post /generate
router.post('/generate', generateReport)
export default router

