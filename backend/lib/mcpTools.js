import { db } from "../config/postgres.js"
import Note from "../models/Note.js"
import { generateEmbedding } from "./embeddings.js"
import { searchRelatedNotes } from "./vectorSearch.js"

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
        const embedding = focusEmbedding || await generateEmbedding(focus);

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
    const topicEmbedding = await generateEmbedding(topic);

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

