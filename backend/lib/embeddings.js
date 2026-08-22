import OpenAI from 'openai'
import { startTrace, hashInput } from './trace.js'

const client = new OpenAI()

// Using text-embedding-3-small: 1536 dimensions, cost-efficient
// Must match the `vector(1536)` dimension in the Supabase tables
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate an embedding for a single piece of text.
 *
 * @param {string} text - Text to embed. Will be truncated by OpenAI
 *   if it exceeds the model's token limit.
 * @param {{callSite?: string, userId?: string, recordId?: string}} [meta] - trace metadata.
 *   `callSite` defaults to 'embedding_unknown' so un-migrated call sites are visible in the trace
 *   data instead of silently blending into another category.
 * @returns {Promise<number[]>} 1536-dimension embedding vector.
 */

export async function generateEmbedding(text, meta = {}) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('generateEmbedding: text must be a non-empty string')
    }

    const { callSite = 'embedding_unknown', userId, recordId } = meta

    // Embedding rows are accounting-only — no input/output text, since the
    // vector itself already lives in note_embeddings / cognitive_units.
    const rec = startTrace({
        callSite,
        callType: 'embedding',
        model: EMBEDDING_MODEL,
        userId,
        recordId,
        inputChars: text.length,
        inputHash: hashInput(text),
    })

    try {
        const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text,
        })

        // Embeddings API usage shape differs from Responses API: prompt_tokens, no output tokens.
        await rec.finish({ inputTokens: response.usage?.prompt_tokens })

        return response.data[0].embedding
    } catch (err) {
        await rec.fail(err)
        throw err
    }
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * More efficient than calling generateEmbedding in a loop.
 *
 * @param {string[]} texts - Array of texts to embed.
 * @param {{callSite?: string, userId?: string, recordId?: string}} [meta] - trace metadata (see generateEmbedding)
 * @returns {Promise<number[][]>} Array of embeddings, same order as input.
 */
export async function generateEmbeddingsBatch(texts, meta = {}) {
    if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('generateEmbeddingsBatch: texts must be a non-empty array')
    }

    const { callSite = 'embedding_unknown', userId, recordId } = meta

    // One trace row per batch call, not per text.
    const rec = startTrace({
        callSite,
        callType: 'embedding',
        model: EMBEDDING_MODEL,
        userId,
        recordId,
        inputChars: texts.reduce((sum, text) => sum + text.length, 0),
        inputHash: hashInput(JSON.stringify(texts)),
    })

    try {
        const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: texts,
        })

        await rec.finish({ inputTokens: response.usage?.prompt_tokens })

        return response.data.map(item => item.embedding)
    } catch (err) {
        await rec.fail(err)
        throw err
    }
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS }