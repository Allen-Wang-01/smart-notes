import { db } from "../config/postgres.js"
import Note from "../models/Note.js";
import { generateEmbedding } from "./embeddings.js";

// Default search parameters. Tuneable as dataset grows.
const DEFAULT_MATCH_THRESHOLD = 0.7;
const DEFAULT_MATCH_COUNT = 5;

/**
 * Search for notes semantically related to the given text.
 *
 * Flow:
 *   1. Generate embedding for the query text (or use precomputed)
 *   2. RPC to pgvector to find nearest note_ids in Supabase
 *   3. Fetch full note data from MongoDB by note_ids
 *   4. Return enriched results with similarity scores
 * 
 *  Returned notes include sourceType and description so downstream
 *  consumers (buildPrompt, MCP tools) can apply the trust hierarchy
 *  described in buildPrompt.js.
 * 
 * @param {Object} params
 * @param {string} params.text - Query text (typically the new note's rawContent).
 * @param {string} params.userId - User scope for search.
 * @param {string} [params.excludeNoteId] - Note ID to exclude (e.g. the current note itself).
 * @param {number} [params.threshold] - Minimum cosine similarity (0-1).
 * @param {number} [params.limit] - Max number of results.
 * @param {number[]} [params.precomputedEmbedding] - Skip embedding generation if provided.
 * @returns {Promise<Array>} Array of { note, similarity } objects.
 */

export async function searchRelatedNotes({
    text,
    userId,
    excludeNoteId = null,
    threshold = DEFAULT_MATCH_THRESHOLD,
    limit = DEFAULT_MATCH_COUNT,
    precomputedEmbedding = null,
}) {
    if ((!text && !precomputedEmbedding) || !userId) {
        return []
    }

    // 1. Generate query embedding (skip if caller already has one)
    const queryEmbedding = precomputedEmbedding || await generateEmbedding(text, {
        callSite: 'search_query_embedding',
        userId,
    });

    // 2. Call Postgres function for vector search
    const rpcResult = await db.rpc('search_related_notes', {
        query_embedding: queryEmbedding,
        target_user_id: String(userId),
        match_threshold: threshold,
        match_count: limit,
        exclude_note_id: excludeNoteId ? String(excludeNoteId) : null,
    });

    // Expected shape from db.rpc: { data, error } or raw array.
    // Adjust this to match your db wrapper's return format.
    const matches = rpcResult?.data ?? rpcResult ?? [];

    if (!Array.isArray(matches) || matches.length === 0) {
        return []
    }

    // 3. Fetch full notes from MongoDB
    //    sourceType and description are required by buildPrompt and MCP tools
    //    so they can apply the trust hierarchy (description > sourceType > content).
    const noteIds = matches.map(m => m.note_id)
    const notes = await Note.find({
        _id: { $in: noteIds },
    }).select('_id rawContent summary title createdAt analysis sourceType description')
        .lean()

    // 4. Map notes back to their similarity scores, preserving order
    const notesById = new Map(notes.map(n => [String(n._id), n]))

    return matches
        .map(match => {
            const note = notesById.get(match.note_id);
            if (!note) return null;
            return {
                note,
                similarity: match.similarity,
            };
        })
        .filter(Boolean);
}

/**
 * Save a note's embedding to Supabase for future semantic search.
 *
 * @param {Object} params
 * @param {string} params.noteId - MongoDB note _id as string.
 * @param {string} params.userId - User ID as string.
 * @param {number[]} params.embedding - 1536-dim vector.
 */
export async function saveNoteEmbedding({ noteId, userId, embedding }) {
    await db.upsert('note_embeddings', {
        note_id: String(noteId),
        user_id: String(userId),
        embedding,
    }, {
        // note_id is the primary key: re-processing a note overwrites its vector.
        onConflict: ['note_id'],
    });
}