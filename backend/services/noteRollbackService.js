import Note from "../models/Note";

/**
 * Rollback note when all retries failed.
 * Only executes if worker still owns generation lock.
 */

export async function rollbackNote({
    noteId,
    generationId,
}) {
    const result = await Note.updateOne(
        {
            _id: noteId,
            status: "retrying", // only rollback if still retrying
            generationId,
        },
        [
            {
                $set: {
                    title: "$previousTitle",
                    content: "$previousContent",
                    keywords: [],
                    summary: null,
                    status: "failed",
                }
            },
            {
                $unset: ["previousContent", "previousTitle", "generationId"]
            }
        ]
    );

    return result.modifiedCount === 1
}