import Note from "../models/Note";

/**
 * Atomic operation:
 * - Only lock note if it is NOT already processing or completed
 * - Set status to processing
 * - Backup original content/title
 * This guarantees only ONE worker can acquire the job.
 */

export async function lockNote(noteId, generationId) {
    const note = await Note.findOneAndUpdate(
        {
            _id: noteId,
            status: { $nin: ["processing", "completed"] }, // lock condition
        },
        [
            {
                $set: {
                    status: "processing",
                    generationId: generationId,
                    // backup content safely
                    previousContent: {
                        $ifNull: [
                            { $ifNull: ["$content", "$rawContent"] },
                            "[content lost]"
                        ]
                    },
                    // backup title safely
                    previousTitle: {
                        $ifNull: ["title", "Untitled"]
                    }
                }
            }
        ],
        { new: true } // return updated doc
    );

    if (!note) {
        return { success: false }
    }

    return {
        success: true,
        note,
    }
}