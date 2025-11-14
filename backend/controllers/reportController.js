/**
 * =============================================================================
 * Report Controller
 * -----------------------------------------------------------------------------
 * - Validates input → converts to periodKey
 * - Checks DB cache
 * - Triggers BullMQ job if missing
 * - Returns stream URL for real-time updates
 * =============================================================================
 */

import Report from "../models/Report.js";
import { getWeeklyKey, getMonthlyKey, parseMonthlyPeriod, parseWeeklyPeriod } from "../utils/period.js";
import { queue } from "../queues/reportQueue.js";


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

export async function getWeeklyReport(userId, dateStr) {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
        throw new Error('Invalid date format')
    }

    const periodKey = getWeeklyKey(date)
    const { start, end } = parseWeeklyPeriod(periodKey)

    //check cache
    let report = await Report.findOne({
        userId,
        type: 'weekly',
        periodKey,
    })

    if (report?.status === 'completed') {
        return {
            status: 200,
            data: {
                report: sanitizeReport(report)
            }
        }
    }

    //not found or failed -> trigger job
    if (!report) {
        report = await Report.create({
            userId,
            type: 'weekly',
            periodKey,
            startDate: start,
            endDate: end,
            status: 'pending',
        })
    }

    //trigger job 
    await queue.add('generate-weekly', {
        reportId: report._id.toString(),
        userId,
        periodKey,
        startDate: start,
        endDate: end,
    }, {
        jobId: `weekly:${userId}:${periodKey}`, //prevent duplicates
        removeOnComplete: true,
        removeOnFail: false,
    })

    const streamUrl = `/api/sse/reports/${report._id}`

    return {
        status: 202,
        data: {
            status: report.status,
            streamUrl,
            message: 'Report generation started',
        },
    };
}

/**
 * GET Monthly Report
 */

export async function getMonthlyReport(userId, year, month) {
    if (month < 1 || month > 12) {
        throw new Error('Month must be 1-12')
    }

    const periodKey = getMonthlyKey(new Date(year, month - 1))
    const { start, end } = parseMonthlyPeriod(periodKey)

    let report = await Report.findOne({
        userId,
        type: 'monthly',
        periodKey,
    })

    if (report?.status === 'completed') {
        return {
            status: 200,
            data: {
                report: sanitizeReport(report)
            },
        };
    }

    if (!report) {
        report = await Report.create({
            userId,
            type: 'monthly',
            periodKey,
            startDate,
            endDate,
            status: 'pending',
        });
    }

    await queue.add('generate-monthly', {
        reportId: report._id.toString(),
        userId,
        periodKey,
        startDate: start,
        endDate: end,
    }, {
        jobId: `monthly: ${userId}:${periodKey}`,
        removeOnComplete: true,
        removeOnFail: false,
    });

    const streamUrl = `/api/sse/report/${report._id}`;
    return {
        status: 202,
        data: {
            status: report.status,
            streamUrl,
            message: 'Monthly report generation started'
        },
    };
}
