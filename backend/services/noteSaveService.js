import Note from "../models/Note.js";

/**
 * Save AI generation result.
 * Only succeeds if worker still owns the generation lock.
 */

export async function saveAIResult({
    noteId,
    generationId,
    content,
    title,
    keywords,
    summary,
}) {
    const result = await Note.updateOne(
        {
            _id: noteId,
            status: "processing", // ensures no user or other worker override
            generationId, // ownership check
        },
        [
            {
                $set: {
                    title: title?.trim() || "Untitled",
                    content: content.trim(),
                    keywords: keywords || [],
                    summary: summary || null,
                    status: "completed",
                },
            },
            {
                $unset: ["previousContent", "previousTitle", "generationId"],
            },
        ]
    );

    return result.modifiedCount === 1
}