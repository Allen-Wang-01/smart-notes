import { getReportQueue } from "../queues/reportQueue.js"

export async function enqueueReportJob(report) {
    if (report.status === "completed") return

    report.status = "pending"
    report.errorMessage = null
    await report.save()

    const queue = getReportQueue()

    //enqueue job(idempotent)
    await queue.add(
        `generate-${report.type}`,
        {
            reportId: report._id.toString(),
            userId: report.userId.toString(),
            periodKey: report.periodKey,
            startDate: report.startDate,
            endDate: report.endDate,
        },
        {
            removeOnComplete: true,
            removeOnFail: false,
        }
    );
}