import Note from "../models/Note.js";

export function createHeartbeat({ noteId, generationId, intervalMs = 5000 }) {
    let timer = null
    async function beat() {
        try {
            await Note.updateOne(
                { _id: noteId, generationId },
                { $set: { lastHeartbeatAt: new Date() } }
            )
        } catch (err) {
            console.error("[Heartbeat] update failed:", err)
        }
    }

    return {
        start() {
            if (timer) return // prevent duplicate timers

            timer = setInterval(beat, intervalMs)
        },

        stop() {
            if (!timer) return

            clearInterval(timer)
            timer = null
        },

        isRunning() {
            return timer !== null
        },
    }
}