/**
 * Validates the analysis object returned from the LLM before writing to the database.
 *
 * The LLM occasionally returns malformed values — an unrecognized emotion label,
 * a numeric field outside [0, 1], or a missing topics array. If we pass these
 * directly to Mongoose, the updateOne call will throw a validation error and the
 * job will fail entirely.
 *
 * This function acts as a lightweight guard: if the analysis is structurally valid,
 * it is saved to the database. If not, analysis is stored as null and the pipeline
 * worker (validator.py) will handle the missing data gracefully at report generation time.
 */
const VALID_EMOTIONS = new Set(["joy", "anxiety", "calm", "stress", "sad", "anger"]);

export function isValidAnalysis(a) {
    if (!a || typeof a !== "object") return false;
    if (!VALID_EMOTIONS.has(a.emotionPrimary)) return false;

    const numericFields = ["emotionIntensity", "energyLevel", "focusLevel", "confidence"];
    for (const field of numericFields) {
        const v = a[field];
        if (typeof v !== "number" || v < 0 || v > 1) return false;
    }

    if (!Array.isArray(a.topics) || a.topics.length === 0) return false;

    return true;
}