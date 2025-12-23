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

