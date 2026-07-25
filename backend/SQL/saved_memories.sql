-- =====================================================
-- Table: saved_memories
-- Purpose: User-curated memory layer. Unlike cognitive_units
-- (which the system extracts and infers from notes), these are
-- verbatim entries the user (or Claude via MCP) explicitly saves
-- and wants preserved unchanged across sessions. No confidence,
-- no auto-merge — content is kept as-is.
--
-- Organized as TOPIC + ENTRIES: rows sharing the same `topic`
-- form one memory subject (e.g. "Japanese Study" with multiple
-- timestamped entries). Retrieval finds relevant topics via
-- embedding, then returns ALL entries under those topics so the
-- consumer sees the complete picture, not isolated fragments.
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_memories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    topic       TEXT NOT NULL,                -- memory subject, e.g. "Japanese Study". Same topic = one subject, many entries
    content     TEXT NOT NULL,                -- verbatim content, never abstracted or rewritten
    source      TEXT NOT NULL DEFAULT 'user', -- 'user' (manually saved) | 'claude' (written via MCP)
    tags        TEXT[] DEFAULT '{}',          -- free-form tags for filtering/categorization
    embedding   vector(1536),                 -- embedding of content, for topic-level semantic retrieval
    created_at  TIMESTAMPTZ DEFAULT NOW()     -- entries are immutable; ordered by this within a topic
);

-- Index for filtering by user (always scoped per user)
CREATE INDEX IF NOT EXISTS idx_saved_memories_user
    ON saved_memories (user_id);

-- Index for fetching all entries of a topic, ordered by time
CREATE INDEX IF NOT EXISTS idx_saved_memories_topic
    ON saved_memories (user_id, topic, created_at DESC);

-- Vector index for semantic retrieval (find relevant topics by content similarity)
CREATE INDEX IF NOT EXISTS idx_saved_memories_vector
    ON saved_memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);