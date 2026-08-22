import { db } from "../config/postgres.js";
import { generateEmbedding } from "./embeddings.js";

// ---- Write ----

interface SaveMemoryParams {
    userId: string;
    topic: string;
    content: string;
    source?: string;
    tags?: string[];
}

interface SavedMemoryRow {
    id: string;
    user_id: string;
    topic: string;
    content: string;
    source: string;
    tags: string[];
    created_at: string;
}

/**
 * Save a memory entry to the saved_memories table.
 * Generates an embedding from content, then inserts the record.
 * Content is stored verbatim — no merging or abstraction.
 *
 * @returns The inserted row.
 */
export async function saveMemory({
    userId,
    topic,
    content,
    source = 'user',
    tags = [],
}: SaveMemoryParams): Promise<SavedMemoryRow> {
    if (!userId || !topic || !content) {
        throw new Error('saveMemory: userId, topic, and content are required')
    }

    const embedding = await generateEmbedding(content, {
        callSite: 'saved_memory_embedding',
        userId,
    })

    const result = await db.insert('saved_memories', {
        user_id: String(userId),
        topic,
        content,
        source,
        tags,
        embedding,
    }) as { rows: SavedMemoryRow[] }

    const row = result.rows[0]
    if (!row) {
        throw new Error('saveMemory: insert returned no rows')
    }
    return row
}

// ---- Search ----

export interface SavedMemoryHit {
    id: string
    topic: string
    content: string
    source: string
    tags: string[]
    created_at: string
    similarity: number
}

export interface TopicGroup {
    topic: string
    entries: SavedMemoryHit[]
}

/**
 * The shape returned by searchSavedMemories.
 *
 * `raw` — the flat list of hits in similarity order, before any grouping.
 *         A future dedup/conflict-resolution step should operate on `raw`
 *         and then pass the filtered list into groupByTopic().
 *
 * `topics` — same hits grouped by their `topic` field, each group sorted
 *            by created_at ascending so entries read chronologically.
 */
export interface SavedMemorySearchResult {
    topics: TopicGroup[]
    raw: SavedMemoryHit[]
}

/**
 * Group a flat list of hits by topic, each group sorted by created_at asc.
 * Exported so a future post-processing step can call it after dedup:
 *   const hits = await fetchRaw(...)
 *   const deduplicated = dedup(hits)   // future step
 *   return { topics: groupByTopic(deduplicated), raw: hits }
 */
export function groupByTopic(hits: SavedMemoryHit[]): TopicGroup[] {
    const topicMap = new Map<string, SavedMemoryHit[]>()
    for (const hit of hits) {
        const group = topicMap.get(hit.topic)
        if (group) {
            group.push(hit)
        } else {
            topicMap.set(hit.topic, [hit])
        }
    }

    return Array.from(topicMap.entries()).map(([topic, entries]) => ({
        topic,
        entries: [...entries].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    }))
}

interface SearchSavedMemoriesParams {
    userId: string
    query: string
    threshold?: number
    matchCount?: number
}

/**
 * Semantically retrieve saved memories for a user.
 * Retrieval is purely embedding-based — topic strings are NOT used as filters.
 * Results are grouped by topic only for presentation; the raw hits are also
 * returned so callers can inspect or post-process before grouping.
 *
 * @param threshold - Cosine similarity floor (default 0.5). Lower = broader recall.
 * @param matchCount - Max entries to return across all topics (default 20).
 */
export async function searchSavedMemories({
    userId,
    query,
    threshold = 0.5,
    matchCount = 20,
}: SearchSavedMemoriesParams): Promise<SavedMemorySearchResult> {
    if (!userId || !query) {
        throw new Error('searchSavedMemories: userId and query are required')
    }

    const embedding = await generateEmbedding(query, {
        callSite: 'saved_memory_query_embedding',
        userId,
    })

    const result = await db.rpc('search_saved_memories', {
        query_embedding: embedding,
        target_user_id: String(userId),
        match_threshold: threshold,
        match_count: matchCount,
    }) as { rows: SavedMemoryHit[] }

    const raw: SavedMemoryHit[] = result.rows ?? []

    return {
        topics: groupByTopic(raw),
        raw,
    }
}
