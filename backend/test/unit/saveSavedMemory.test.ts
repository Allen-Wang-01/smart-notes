/**
 * Unit tests for the save_memory MCP tool handler (saveSavedMemory).
 *
 * All external dependencies are mocked — no database, no OpenAI API, no network.
 * We only verify the wiring and contract of saveSavedMemory itself:
 *   - Validation: missing topic/content → error returned, saveMemory not called
 *   - Happy path: saveMemory called with correct args (source always 'claude')
 *   - Failure path: saveMemory throws → { success: false } returned, never re-thrown
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock all modules that have side effects at import time, before mcpTools.js loads.
// vi.mock calls are hoisted by vitest, so these run before any import below.
vi.mock('../../config/postgres.js', () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        rpc: vi.fn(),
        delete: vi.fn(),
    },
    checkConnection: vi.fn(),
}));
vi.mock('../../lib/embeddings.js', () => ({
    generateEmbedding: vi.fn(),
    EMBEDDING_MODEL: 'text-embedding-3-small',
    EMBEDDING_DIMENSIONS: 1536,
}));
vi.mock('../../lib/vectorSearch.js', () => ({
    searchRelatedNotes: vi.fn(),
}));
vi.mock('../../models/Note.js', () => ({
    default: { find: vi.fn() },
}));
vi.mock('../../lib/savedMemory.js', () => ({
    saveMemory: vi.fn(),
    searchSavedMemories: vi.fn(),
    groupByTopic: vi.fn(),
}));

import { saveSavedMemory } from '../../lib/mcpTools.js';
import { saveMemory } from '../../lib/savedMemory.js';

const mockSaveMemory = vi.mocked(saveMemory);
const USER_ID = 'user-test-001';

describe('saveSavedMemory', () => {
    beforeEach(() => {
        mockSaveMemory.mockReset();
    });

    // ── Validation ───────────────────────────────────────────────────────────

    it('returns an error and does not call saveMemory when topic is empty', async () => {
        const result = await saveSavedMemory({
            userId: USER_ID,
            topic: '',
            content: 'Some content',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(mockSaveMemory).not.toHaveBeenCalled();
    });

    it('returns an error and does not call saveMemory when content is empty', async () => {
        const result = await saveSavedMemory({
            userId: USER_ID,
            topic: 'Japanese Study',
            content: '',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(mockSaveMemory).not.toHaveBeenCalled();
    });

    // ── Happy path ───────────────────────────────────────────────────────────

    it('calls saveMemory with source="claude" and forwards topic/content/tags', async () => {
        mockSaveMemory.mockResolvedValue({
            id: 'uuid-abc',
            topic: 'Japanese Study',
            content: 'Learned て-form today.',
            user_id: USER_ID,
            source: 'claude',
            tags: ['日語', 'N4'],
            created_at: '2026-06-17T10:00:00Z',
        });

        await saveSavedMemory({
            userId: USER_ID,
            topic: 'Japanese Study',
            content: 'Learned て-form today.',
            tags: ['日語', 'N4'],
        });

        expect(mockSaveMemory).toHaveBeenCalledWith({
            userId: USER_ID,
            topic: 'Japanese Study',
            content: 'Learned て-form today.',
            source: 'claude',
            tags: ['日語', 'N4'],
        });
    });

    it('returns { success: true } with topic and id on successful write', async () => {
        mockSaveMemory.mockResolvedValue({
            id: 'uuid-xyz',
            topic: 'Architecture',
            content: 'BullMQ + SSE chosen for streaming.',
            user_id: USER_ID,
            source: 'claude',
            tags: [],
            created_at: '2026-06-17T11:00:00Z',
        });

        const result = await saveSavedMemory({
            userId: USER_ID,
            topic: 'Architecture',
            content: 'BullMQ + SSE chosen for streaming.',
        });

        expect(result.success).toBe(true);
        expect(result.topic).toBe('Architecture');
        expect(result.id).toBe('uuid-xyz');
    });

    it('defaults tags to [] when not provided', async () => {
        mockSaveMemory.mockResolvedValue({
            id: 'uuid-def',
            topic: 'Architecture',
            content: 'Some note.',
            user_id: USER_ID,
            source: 'claude',
            tags: [],
            created_at: '2026-06-17T12:00:00Z',
        });

        await saveSavedMemory({
            userId: USER_ID,
            topic: 'Architecture',
            content: 'Some note.',
            // tags omitted
        });

        expect(mockSaveMemory).toHaveBeenCalledWith(
            expect.objectContaining({ tags: [] })
        );
    });

    // ── Failure path ─────────────────────────────────────────────────────────

    it('returns { success: false } when saveMemory throws, without rethrowing', async () => {
        mockSaveMemory.mockRejectedValue(new Error('Supabase insert failed'));

        const result = await saveSavedMemory({
            userId: USER_ID,
            topic: 'Some Topic',
            content: 'Some content',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Supabase insert failed');
    });

    it('never throws to the caller even when saveMemory rejects', async () => {
        mockSaveMemory.mockRejectedValue(new Error('Network error'));

        // If saveSavedMemory re-threw, this would reject and the test would fail.
        await expect(
            saveSavedMemory({ userId: USER_ID, topic: 'T', content: 'C' })
        ).resolves.toMatchObject({ success: false });
    });
});
