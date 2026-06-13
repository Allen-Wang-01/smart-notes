import { db } from "../config/postgres.js";
import { generateEmbedding } from "./embeddings.js";

// Semantic similarity threshold for merging cognitive units.
// 0.92 is high on purpose: "Node.js" and "nodejs" will merge,
// but "Node.js" and "Python" will not.
const MERGE_THRESHOLD = 0.92;

/**
 * Process a batch of cognitive units extracted from one note.
 * For each unit:
 *   - Generate embedding from (concept + context)
 *   - Search for semantically similar existing units (threshold 0.92)
 *   - If found: merge (append context, bump confidence, increment mention_count)
 *   - If not found: insert as a new unit
 *
 * Runs units sequentially to avoid race conditions where two
 * similar new units would both insert instead of merging.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Array} params.units - Array of { concept, context, tags, confidence }.
 */
export async function processCognitiveUnits({ userId, units }) {
    if (!Array.isArray(units) || units.length === 0) {
        return
    }

    for (const unit of units) {
        try {
            await processSingleUnit({ userId, unit })
        } catch (err) {
            // Log and continue — one failing unit shouldn't block the rest.
            console.error('processCognitiveUnits: unit failed', {
                concept: unit.concept,
                error: err.message,
            })
        }
    }
}

async function processSingleUnit({ userId, unit }) {
    const { concept, context, tags = [], confidence = 0.5 } = unit
    if (!concept || !context) {
        return
    }

    // Embed (concept + context) together so the semantic signature
    // captures both the entity and how it's used.
    const embeddingInput = `${concept}: ${context}`
    const embedding = await generateEmbedding(embeddingInput)

    // Look for an existing semantically-equivalent unit
    const rpcResult = await db.rpc('search_similar_cognitive_units', {
        query_embedding: embedding,
        target_user_id: String(userId),
        match_threshold: MERGE_THRESHOLD,
        match_count: 1,
    });

    const matches = rpcResult?.data ?? rpcResult ?? [];
    const existing = Array.isArray(matches) && matches.length > 0 ? matches[0] : null

    if (existing) {
        await mergeUnit({ existing, incoming: { concept, context, tags, confidence } })
    } else {
        await insertUnit({ userId, concept, context, tags, confidence, embedding })
    }
}

/**
 * Merge incoming unit data into an existing unit.
 * - Append new context if it adds information
 * - Union tags
 * - Nudge confidence upward (bounded at 1)
 * - Increment mention_count
 * - Refresh last_seen
 */

async function mergeUnit({ existing, incoming }) {
    // Keep context growing but bounded - avoid unbounded concatenation
    // If the incoming context is already substantially present, skip appending
    const mergedContext = shouldAppendContext(existing.context, incoming.context)
        ? `${existing.context}; ${incoming.context}`
        : existing.context

    // Truncate if the merged context grows too long.
    const MAX_CONTEXT_LENGTH = 1000
    const finalContext = mergedContext.length > MAX_CONTEXT_LENGTH
        ? mergedContext.slice(mergedContext.length - MAX_CONTEXT_LENGTH)
        : mergedContext

    const mergedTags = unionTags(existing.tags ?? [], incoming.tags ?? [])

    // Confidence converges toward 1 with each reinforcement.
    // Each mention closes ~30% of the remaining gap to 1
    const boostedConfidence = Math.min(
        1,
        (existing.confidence ?? 0.5) + (1 - existing.confidence * 0.3)
    )
    await db.update(
        'cognitive_units',
        {
            context: finalContext,
            tags: mergedTags,
            confidence: boostedConfidence,
            mention_count: (existing.mention_count ?? 1) + 1,
            last_seen: new Date().toISOString(),
        },
        { eq: { id: existing.id } }
    );
}


async function insertUnit({ userId, concept, context, tags, confidence, embedding }) {
    await db.insert('cognitive_units', {
        user_id: String(userId),
        concept,
        context,
        tags,
        confidence,
        mention_count: 1,
        last_seen: new Date().toISOString(),
        embedding,
    });
}

// ---- Helpers ----

/**
 * Decide whether incoming context adds new information.
 * Simple heuristic: skip append if incoming is already a substring
 * of existing (case-insensitive).
 */

function shouldAppendContext(existingContext, incomingContext) {
    if (!incomingContext) return false
    return !existingContext.toLowerCase().includes(incomingContext.toLowerCase())
}

function unionTags(existing, incoming) {
    const set = new Set([...existing, ...incoming])
    return Array.from(set)
}