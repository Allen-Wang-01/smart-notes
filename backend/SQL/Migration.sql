-- =====================================================
-- Migration: Personal Knowledge Agent Upgrade
-- Adds semantic search (note_embeddings) and
-- cognitive layer (cognitive_units) for MCP integration
-- =====================================================

-- Enable pgvector extension for embedding-based semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pgcrypto for UUID generation (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =====================================================
-- Table: note_embeddings
-- Purpose: Store embeddings of each note for semantic
-- similarity search. Linked to MongoDB notes via note_id.
-- =====================================================
CREATE TABLE IF NOT EXISTS note_embeddings (
    note_id     TEXT PRIMARY KEY,                 -- MongoDB ObjectId (as string)
    user_id     TEXT NOT NULL,                    -- Owner of the note
    embedding   vector(1536) NOT NULL,            -- OpenAI text-embedding-3-small dimension
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering by user (embeddings are always scoped per user)
CREATE INDEX IF NOT EXISTS idx_note_embeddings_user
    ON note_embeddings (user_id);

-- IVFFlat index for fast approximate cosine similarity search.
-- `lists = 100` is a reasonable default for up to ~100k rows per user.
-- Tune later if dataset grows significantly.
CREATE INDEX IF NOT EXISTS idx_note_embeddings_vector
    ON note_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);


-- =====================================================
-- Table: cognitive_units
-- Purpose: Store contextualized cognitive entities
-- (skills, goals, values, experiences) extracted from
-- notes. Forms the "structured personal cognition layer"
-- exposed via MCP. Units are merged by semantic
-- similarity rather than string match.
-- =====================================================
CREATE TABLE IF NOT EXISTS cognitive_units (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL,
    concept         TEXT NOT NULL,                -- e.g. "Node.js", "AI Engineer transition"
    context         TEXT NOT NULL,                -- how the user uses/experiences this concept
    tags            TEXT[] DEFAULT '{}',          -- free-form tags from LLM, e.g. ["backend", "skill"]
    confidence      FLOAT DEFAULT 0.5,            -- LLM-assigned confidence (0-1)
    mention_count   INTEGER DEFAULT 1,            -- incremented on each semantic merge
    last_seen       TIMESTAMPTZ DEFAULT NOW(),    -- last time this unit was reinforced
    embedding       vector(1536),                 -- embedding of (concept + context) for merge matching
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering by user
CREATE INDEX IF NOT EXISTS idx_cognitive_units_user
    ON cognitive_units (user_id);

-- Index for sorting by recency (used by get_user_profile / get_recent_context)
CREATE INDEX IF NOT EXISTS idx_cognitive_units_last_seen
    ON cognitive_units (user_id, last_seen DESC);

-- Vector index for semantic merging and MCP semantic search
CREATE INDEX IF NOT EXISTS idx_cognitive_units_vector
    ON cognitive_units
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);


-- =====================================================
-- Notes:
-- - period_reports table (from existing analytics pipeline)
--   is preserved and will be repurposed for Personal
--   Narrative generation in Phase 3.
-- - Embeddings use 1536 dimensions (OpenAI
--   text-embedding-3-small). If switching to a different
--   model, recreate tables with correct dimension.
-- =====================================================