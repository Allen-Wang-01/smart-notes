import Report from "../models/Report.js";
import { enqueueReportJob } from "./enqueueReport.js";
import { parseWeeklyPeriod, parseMonthlyPeriod } from "../utils/period.js";

export async function generateReportService({ userId, type, periodKey }) {
    const { start, end } = type === "weekly"
        ? parseWeeklyPeriod(periodKey)
        : parseMonthlyPeriod(periodKey)

    let report = await Report.findOne({ userId, type, periodKey })

    if (!report) {
        report = await Report.create({
            userId,
            type,
            periodKey,
            startDate: start,
            endDate: end,
            status: 'pending',
        })
    }

    await enqueueReportJob(report)

    return report
}