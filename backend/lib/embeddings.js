import OpenAI from 'openai'

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
 * @returns {Promise<number[]>} 1536-dimension embedding vector.
 */

export async function generateEmbedding(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('generateEmbedding: text must be a non-empty string')
    }

    const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
    })

    return response.data[0].embedding
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * More efficient than calling generateEmbedding in a loop.
 *
 * @param {string[]} texts - Array of texts to embed.
 * @returns {Promise<number[][]>} Array of embeddings, same order as input.
 */
export async function generateEmbeddingsBatch(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('generateEmbeddingsBatch: texts must be a non-empty array')
    }

    const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
    })

    return response.data.map(item => item.embedding)
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS }