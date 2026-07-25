-- =====================================================
-- RPC Functions for saved_memories semantic search
-- Run this in Supabase SQL Editor after saved_memories.sql
-- =====================================================


-- =====================================================
-- Function: search_saved_memories
-- Purpose: Pure semantic retrieval — find saved memory entries
-- whose embedding is close to the query embedding.
-- Topic strings are NOT used in retrieval; they appear in
-- the result only for presentation grouping by the caller.
-- =====================================================
CREATE OR REPLACE FUNCTION search_saved_memories(
    query_embedding     vector(1536),
    target_user_id      TEXT,
    match_threshold     FLOAT DEFAULT 0.5,
    match_count         INT DEFAULT 20
)
RETURNS TABLE (
    id          UUID,
    topic       TEXT,
    content     TEXT,
    source      TEXT,
    tags        TEXT[],
    created_at  TIMESTAMPTZ,
    similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sm.id,
        sm.topic,
        sm.content,
        sm.source,
        sm.tags,
        sm.created_at,
        1 - (sm.embedding <=> query_embedding) AS similarity
    FROM saved_memories sm
    WHERE sm.user_id = target_user_id
      AND sm.embedding IS NOT NULL
      AND 1 - (sm.embedding <=> query_embedding) >= match_threshold
    ORDER BY sm.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
