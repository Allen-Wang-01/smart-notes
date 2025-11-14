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
} from '../controllers/reportController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'

const router = Router()

// All report routes require authentication
router.use(authMiddleware)

// Weekly report
router.get('/weekly', async (req, res) => {
    try {
        const { date } = req.query
        if (!date) {
            return res.status(400).json({ error: 'Query param `date` is required' })
        }

        const result = await getWeeklyReport(req.user.id, date)
        res.status(result.status).json(result.data)
    } catch (err) {
        console.error('Weekly report error: ', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// Monthly resport
router.get('/monthly', async (req, res) => {
    try {
        const { year, month } = req.query
        if (!year || !month) {
            return res
                .status(400)
                .json({ error: 'Query params `year` and `month` are required' })
        }
        const result = await getMonthlyReport(req.user.id, parseInt(year), parseInt(month))
        res.status(result.status).json(result.data)
    } catch (err) {
        console.error('Monthly report error: ', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

export default router

