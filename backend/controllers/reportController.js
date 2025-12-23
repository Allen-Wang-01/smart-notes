/**
 * =============================================================================
 * Report Controller
 * -----------------------------------------------------------------------------
 * - No streaming
 * - Always return DB result if completed
 * - If missing or failed, trigger new job and return pending status
 * - Frontend should poll `GET/reports/:id`until completed
 * =============================================================================
 */

import Report from "../models/Report.js";
import { enqueueReportJob } from "../services/enqueueReport.js";
import { generateReportService } from "../services/reportService.js";



/**
 * Strip internal fields before sending to frontend
 */
function sanitizeReport(report) {
    const { _id, userId, createdAt, updatedAt, __v, ...safe } = report.toObject();
    safe.id = _id.toString();
    return safe;
}

/**
 * GET Weekly Report
 */

export async function getWeeklyReport(userId, selectedWeekPeriod) {
    //check cache
    let report = await Report.findOne({
        userId,
        type: 'weekly',
        periodKey: selectedWeekPeriod,
    })

    if (!report) {
        return {
            status: 404,
            data: {
                report: null,
                status: "not_found",
            }
        }
    }

    // if already completed -> return directly
    if (report?.status === 'completed') {
        return {
            status: 200,
            data: {
                report: sanitizeReport(report),
                status: "completed",
            }
        }
    }

    return {
        status: 200,
        data: {
            status: report.status,
            reportId: report._id.toString(),
            report: sanitizeReport(report),
        },
    };
}

/**
 * GET Monthly Report
 */

export async function getMonthlyReport(userId, selectedMonthPeriod) {
    let report = await Report.findOne({
        userId,
        type: 'monthly',
        periodKey: selectedMonthPeriod,
    })

    if (!report) {
        return {
            status: 404,
            data: {
                report: null,
                status: "not_found",
            },
        };

    }

    // Already finished
    if (report?.status === 'completed') {
        return {
            status: 200,
            data: {
                report: sanitizeReport(report),
                status: "completed",
            },
        };
    }

    if (report.status !== "completed") {
        return {
            status: 200,
            data: {
                report: sanitizeReport(report),
                status: report.status, // pending / processing / failed
            },
        };
    }
}

/**
 * GET /reports/available-periods
 * Returns the earliest & latest weekly/monthly report periodKey for the user
 */
export const getAvailablePeriods = async (req, res) => {
    try {
        const userId = req.user.userId

        // Fetch only what we need: type & periodKey
        const reports = await Report.find(
            { userId },
            { type: 1, periodKey: 1 }
        ).lean()

        // group & sort
        const weeklyKeys = reports
            .filter(r => r.type === 'weekly')
            .map(r => r.periodKey)
            .sort()

        const monthlyKeys = reports
            .filter(r => r.type === 'monthly')
            .map(r => r.periodKey)
            .sort()

        const response = {
            weekly: {
                earliest: weeklyKeys[0] || null,
                latest: weeklyKeys[weeklyKeys.length - 1] || null,
            },
            monthly: {
                earliest: monthlyKeys[0] || null,
                latest: monthlyKeys[monthlyKeys.length - 1] || null,
            }
        }
        return res.json({ ok: true, periods: response })
    } catch (err) {
        console.error("Error in getAvailablePeriods:", err)
        return res.status(500).json({
            ok: false,
            error: "Failed to fetch available report periods",
        })
    }
}

