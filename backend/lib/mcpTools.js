import { db } from "../config/postgres.js"
import Note from "../models/Note.js"
import { generateEmbedding } from "./embeddings.js"
import { searchRelatedNotes } from "./vectorSearch.js"
import { searchSavedMemories, saveMemory } from "./savedMemory.js"

// =====================================================
// Tool: search_personal_knowledge
// Semantic search over the user's notes.
// Optionally accepts a pre-computed `queryEmbedding` to avoid
// redundant OpenAI calls when the same query is reused
// (e.g. inside getFullContext).
//
// Returns sourceType and description on every result so the
// consuming LLM can apply the trust hierarchy
// (description > sourceType > content) when interpreting
// the user's notes — same hierarchy used in buildPrompt.
// =====================================================

export async function searchPersonalKnowledge({ userId, query, limit = 5, queryEmbedding = null, }) {
    if (!query || typeof query !== 'string') {
        return { results: [] }
    }

    const safeLimit = Math.min(Math.max(1, limit), 10)

    const matches = await searchRelatedNotes({
        text: query,
        userId,
        threshold: 0.6, // Slightly looser than worker-internal search;
        limit: safeLimit,
        precomputedEmbedding: queryEmbedding,
    })

    const results = matches.map(({ note, similarity }) => ({
        noteId: String(note._id),
        title: note.title,
        summary: note.summary,
        createdAt: note.createdAt,
        themes: note.analysis?.themes || [],
        similarity: Number(similarity.toFixed(3)),
        sourceType: note.sourceType || 'authored',
        description: note.description || null,
    }))
    return { results }
}

// =====================================================
// Tool: get_user_profile
// Returns a structured profile of the user, optionally
// filtered by a focus area (semantic search over cognitive units).
// =====================================================
export async function getUserProfile({ userId, focus = null, limit = 15, focusEmbedding = null, }) {
    const safeLimit = Math.min(Math.max(1, limit), 30)

    let units = []

    if (focus && typeof focus === 'string') {
        // Focus-driven: semantic search cognitive units that match the focus
        const embedding = focusEmbedding || await generateEmbedding(focus, {
            callSite: 'mcp_search_query_embedding',
            userId,
        });

        const rpcResult = await db.rpc('search_similar_cognitive_units', {
            query_embedding: embedding,
            target_user_id: String(userId),
            match_threshold: 0.55, // Loose - focus is intentionally fuzzy
            match_count: safeLimit,
        })

        units = rpcResult?.data ?? rpcResult ?? []
    } else {
        // No focus: return the most "stable" units -
        // those reinforced multiple times and held with confidence.

        const rpcResult = await db.select('cognitive_units', {
            eq: { user_id: String(userId) },
            order: [
                { column: 'mention_count', ascending: false },
                { column: 'confidence', ascending: false },
                { column: 'last_seen', ascending: false },
            ],
            limit: safeLimit,
        })
        units = rpcResult?.data ?? rpcResult ?? []
    }

    const profile = (Array.isArray(units) ? units : []).map(formatCognitiveUnit)

    return {
        focus: focus || null,
        unitCount: profile.length,
        units: profile,
    }
}

// =====================================================
// Tool: get_recent_context
// Returns the last N days of notes aggregated by themes
// and emotional state.
// Note-level results carry sourceType and description so the
// consuming LLM can correctly attribute emotion: "saved" notes
// without descriptions should not be read as the user's own
// emotional expression.
// =====================================================
export async function getRecentContext({ userId, days = 14 }) {
    const safeDays = Math.min(Math.max(1, days), 90);
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const notes = await Note.find({
        userId,
        createdAt: { $gte: since },
        status: 'completed',
    })
        .select('title summary createdAt analysis sourceType description')
        .sort({ createdAt: -1 })
        .lean()

    // Aggregate themes across the period (frequency count).
    const themeCounts = {}
    const emotions = []
    const noteSummaries = []

    for (const note of notes) {
        const themes = note.analysis?.themes || []
        for (const theme of themes) {
            themeCounts[theme] = (themeCounts[theme] || 0) + 1
        }

        // Only collect emotion signals from authored notes. For "saved" notes,
        // analysis.emotion (when present) describes the saved content's tone,
        // not the user's state — folding it into the user's emotional trajectory
        // would mislead downstream reasoning. Saved notes with a description
        // express user intent, not user emotion, so they are also skipped here.
        if (note.analysis?.emotion && (note.sourceType || 'authored') === 'authored') {
            emotions.push({
                emotion: note.analysis.emotion,
                intensity: note.analysis.emotionIntensity,
                date: note.createdAt,
            })
        }

        noteSummaries.push({
            noteId: String(note._id),
            title: note.title,
            summary: note.summary,
            createdAt: note.createdAt,
            sourceType: note.sourceType || 'authored',
            description: note.description || null,
        })
    }

    const topThemes = Object.entries(themeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([theme, count]) => ({ theme, count }));

    return {
        periodDays: safeDays,
        noteCount: notes.length,
        topThemes,
        emotions,
        notes: noteSummaries.slice(0, 20),   // Cap to keep response token-efficient.
    };
}


// =====================================================
// Tool: get_full_context
// One-shot aggregation of all three layers, ideal for
// Claude to call at the start of a relevant conversation.
// =====================================================
export async function getFullContext({ userId, topic }) {
    if (!topic || typeof topic !== 'string') {
        throw new Error('get_full_context: topic is required')
    }


    // Compute the topic embedding once and reuse it across the
    // two semantic-search subcalls. Recent context doesn't need it.
    const topicEmbedding = await generateEmbedding(topic, {
        callSite: 'mcp_topic_query_embedding',
        userId,
    });

    // Run all three layers in parallel for speed.
    const [stableProfile, recentContext, relevantSpecifics] = await Promise.all([
        getUserProfile({ userId, focus: topic, limit: 10, focusEmbedding: topicEmbedding }),
        getRecentContext({ userId, days: 21 }),
        searchPersonalKnowledge({ userId, query: topic, limit: 5, queryEmbedding: topicEmbedding, }),
    ])

    return {
        topic,
        stableProfile: stableProfile.units,
        recentContext: {
            periodDays: recentContext.periodDays,
            topThemes: recentContext.topThemes,
            emotions: recentContext.emotions,
        },
        relevantNotes: relevantSpecifics.results,
    }
}

// =====================================================
// Tool: list_saved_memory_topics
// Returns a directory-level overview of all topics the
// user has saved memories under. No content included.
// =====================================================
export async function listSavedMemoryTopics({ userId }) {
    const result = await db.select('saved_memories', {
        eq: { user_id: String(userId) },
    })
    const rows = result?.rows ?? []

    // Group by topic in JS — personal memory sets are small.
    const topicMap = new Map()
    for (const row of rows) {
        const entry = topicMap.get(row.topic)
        if (entry) {
            entry.count++
            if (row.created_at > entry.lastUpdated) {
                entry.lastUpdated = row.created_at
            }
        } else {
            topicMap.set(row.topic, {
                topic: row.topic,
                count: 1,
                lastUpdated: row.created_at,
            })
        }
    }

    const topics = Array.from(topicMap.values())
        .sort((a, b) => (b.lastUpdated > a.lastUpdated ? 1 : -1))

    return { topicCount: topics.length, topics }
}

// =====================================================
// Tool: get_saved_memory_by_topic
// Returns all entries under a specific topic, sorted
// oldest-to-newest. No filtering, no truncation.
// =====================================================
export async function getSavedMemoryByTopic({ userId, topic }) {
    const result = await db.select('saved_memories', {
        eq: { user_id: String(userId), topic },
    })
    const rows = result?.rows ?? []

    // Sort chronologically — older entries provide context for newer ones.
    const entries = rows
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
        .map(row => ({
            content: row.content,
            source: row.source,
            tags: row.tags,
            createdAt: row.created_at,
        }))

    return { topic, entryCount: entries.length, entries }
}

// =====================================================
// Tool: search_saved_memory
// Cross-topic semantic search. Returns hits grouped by
// topic with similarity scores. Delegates to
// searchSavedMemories so no retrieval logic lives here.
// =====================================================
export async function searchSavedMemory({ userId, query, threshold = 0.3, matchCount = 20 }) {
    const { topics, raw } = await searchSavedMemories({
        userId: String(userId),
        query,
        threshold,
        matchCount,
    })

    return {
        query,
        hitCount: raw.length,
        topics: topics.map(group => ({
            topic: group.topic,
            entries: group.entries.map(e => ({
                content: e.content,
                source: e.source,
                tags: e.tags,
                createdAt: e.created_at,
                similarity: e.similarity,
            })),
        })),
    }
}

// =====================================================
// Tool: save_memory
// Writes one entry into saved_memories with source='claude'.
// Returns an explicit success/failure object so Claude can
// report the outcome to the user — never fire-and-forget.
// =====================================================
/** @param {{ userId: string, topic: string, content: string, tags?: string[] }} params */
export async function saveSavedMemory({ userId, topic, content, tags = [] }) {
    if (!topic || !content) {
        return {
            success: false,
            error: 'topic and content are required',
        }
    }

    try {
        const row = await saveMemory({
            userId,
            topic,
            content,
            source: 'claude',
            tags,
        })
        return {
            success: true,
            topic: row.topic,
            id: row.id,
            createdAt: row.created_at,
        }
    } catch (err) {
        return {
            success: false,
            error: err?.message ?? 'Failed to save memory',
        }
    }
}

// =====================================================
// Helpers
// =====================================================

function formatCognitiveUnit(unit) {
    return {
        concept: unit.concept,
        context: unit.context,
        tags: unit.tags || [],
        confidence: unit.confidence,
        mentionCount: unit.mention_count,
        lastSeen: unit.last_seen,
    };
}

