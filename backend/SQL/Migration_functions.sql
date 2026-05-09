-- =====================================================
-- Migration: RPC Functions for Vector Search
-- Run after the initial migration.sql
-- =====================================================


-- =====================================================
-- Function: search_related_notes
-- Purpose: Find semantically similar notes for a given user.
-- Returns notes above a cosine similarity threshold,
-- ordered by similarity (highest first).
-- =====================================================
CREATE OR REPLACE FUNCTION search_related_notes(
    query_embedding     vector(1536),
    target_user_id      TEXT,
    match_threshold     FLOAT DEFAULT 0.7,
    match_count         INT DEFAULT 5,
    exclude_note_id     TEXT DEFAULT NULL
)
RETURNS TABLE (
    note_id     TEXT,
    similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ne.note_id,
        1 - (ne.embedding <=> query_embedding) AS similarity
    FROM note_embeddings ne
    WHERE ne.user_id = target_user_id
      AND (exclude_note_id IS NULL OR ne.note_id != exclude_note_id)
      AND 1 - (ne.embedding <=> query_embedding) >= match_threshold
    ORDER BY ne.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- =====================================================
-- Function: search_similar_cognitive_units
-- Purpose: Find cognitive units whose embedding is semantically
-- close enough to be considered "the same concept" for merging.
-- Typically called with a high threshold (e.g. 0.92).
-- =====================================================
CREATE OR REPLACE FUNCTION search_similar_cognitive_units(
    query_embedding     vector(1536),
    target_user_id      TEXT,
    match_threshold     FLOAT DEFAULT 0.92,
    match_count         INT DEFAULT 1
)
RETURNS TABLE (
    id              UUID,
    concept         TEXT,
    context         TEXT,
    tags            TEXT[],
    confidence      FLOAT,
    mention_count   INTEGER,
    similarity      FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cu.id,
        cu.concept,
        cu.context,
        cu.tags,
        cu.confidence,
        cu.mention_count,
        1 - (cu.embedding <=> query_embedding) AS similarity
    FROM cognitive_units cu
    WHERE cu.user_id = target_user_id
      AND cu.embedding IS NOT NULL
      AND 1 - (cu.embedding <=> query_embedding) >= match_threshold
    ORDER BY cu.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;