import Note from "../models/Note.js";

/**
 * Recover stuck AI jobs that have not sent heartbeat within timeout.
 *
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=30000] - Timeout in milliseconds
 * @returns {number} Number of recovered jobs
 */
export async function recoverStuckJobs({ timeoutMs = 30000 } = {}) {
    const timeoutDate = new Date(Date.now() - timeoutMs)

    try {
        const res = await Note.updateMany(
            {
                status: "processing",
                lastHeartbeatAt: { $lt: timeoutDate },
            },
            {
                $set: {
                    status: "pending",
                    generationId: null,
                },
            }
        )

        if (res.modifiedCount > 0) {
            console.log(`[Recovery] restored ${res.modifiedCount} stuck jobs`)
        }

        return res.modifiedCount
    } catch (err) {
        console.error("[Recovery] failed:", err)
        return 0
    }
}