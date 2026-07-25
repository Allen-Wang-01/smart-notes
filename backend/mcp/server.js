import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
    searchPersonalKnowledge,
    getUserProfile,
    getRecentContext,
    getFullContext,
    listSavedMemoryTopics,
    getSavedMemoryByTopic,
    searchSavedMemory,
    saveSavedMemory,
} from "../lib/mcpTools.js";


/**
 * Build a per-request MCP server instance.
 *
 * Streamable HTTP creates a fresh server + transport for each request,
 * so we close over `userId` from the auth middleware and pass it to
 * every tool call.
 */
function buildServer(userId) {
    const server = new McpServer({
        name: 'personal-knowledge-agent',
        version: '0.1.0',
    });

    // -------------------------------------------------
    // Tool: search_personal_knowledge
    // -------------------------------------------------
    server.registerTool(
        'search_personal_knowledge',
        {
            title: 'Search personal knowledge',
            description:
                'Semantic search over the user\'s personal knowledge base. ' +
                'Returns notes whose meaning is closest to the query. ' +
                'Use this when you need specific past thoughts, decisions, ' +
                'or pieces of saved knowledge from the user.\n\n' +
                'Each result includes:\n' +
                '- sourceType: "authored" means the user wrote this themselves; ' +
                '"saved" means the user preserved external content (an article, ' +
                'a quote, an LLM answer).\n' +
                '- description: when present, the user\'s own note on why they ' +
                'saved this. Treat this as the highest-trust signal of intent.\n' +
                '- summary: the note\'s content. For "saved" notes WITHOUT a ' +
                'description, do NOT treat the summary as the user\'s own thoughts ' +
                'or feelings — it describes external material the user found valuable.',
            inputSchema: {
                query: z.string().describe('Natural-language search query'),
                limit: z.number().int().min(1).max(10).optional()
                    .describe('Max number of results (default 5)'),
            },
        },
        async ({ query, limit }) => {
            const result = await searchPersonalKnowledge({ userId, query, limit });
            return jsonResult(result);
        }
    );


    // -------------------------------------------------
    // Tool: get_user_profile
    // -------------------------------------------------
    server.registerTool(
        'get_user_profile',
        {
            title: 'Get user profile',
            description:
                'Returns a structured profile of the user as a list of ' +
                'cognitive units (skills, goals, experiences, beliefs, etc.) ' +
                'each with context about how the user relates to them. ' +
                'Pass `focus` to filter to a specific domain (e.g. ' +
                '"technical skills", "career goals"). Without `focus`, ' +
                'returns the most reinforced/stable parts of the profile.',
            inputSchema: {
                focus: z.string().optional()
                    .describe('Optional focus area to filter the profile'),
                limit: z.number().int().min(1).max(30).optional()
                    .describe('Max number of cognitive units (default 15)'),
            },
        },
        async ({ focus, limit }) => {
            const result = await getUserProfile({ userId, focus, limit });
            return jsonResult(result);
        }
    );

    // -------------------------------------------------
    // Tool: get_recent_context
    // -------------------------------------------------
    server.registerTool(
        'get_recent_context',
        {
            title: 'Get recent context',
            description:
                'Returns the user\'s recent activity over the last N days: ' +
                'top themes, emotional trajectory, and recent note summaries. ' +
                'Use when you need to know what the user has been thinking ' +
                'about lately, even if not directly related to the current topic.\n\n' +
                'Returned fields:\n' +
                '- topThemes: themes the user engaged with most this period.\n' +
                '- emotions: emotional trajectory drawn ONLY from notes the user ' +
                'wrote themselves (authored). Saved external content is excluded ' +
                'so this reflects the user\'s own state, not the tone of articles ' +
                'they preserved.\n' +
                '- notes: recent note summaries. Each carries sourceType ' +
                '("authored" = user\'s own writing, "saved" = preserved external ' +
                'content) and description (user\'s optional note on why they saved ' +
                'it). For "saved" notes without a description, the summary describes ' +
                'external material — do NOT read it as the user\'s own thoughts.',
            inputSchema: {
                days: z.number().int().min(1).max(90).optional()
                    .describe('Lookback window in days (default 14)'),
            },
        },
        async ({ days }) => {
            const result = await getRecentContext({ userId, days });
            return jsonResult(result);
        }
    );

    // -------------------------------------------------
    // Tool: get_full_context
    // -------------------------------------------------
    server.registerTool(
        'get_full_context',
        {
            title: 'Get full context',
            description:
                'One-shot retrieval of three context layers for the given topic: ' +
                '(1) stable profile relevant to the topic, ' +
                '(2) recent themes and emotional state, ' +
                '(3) specific past notes related to the topic. ' +
                'Prefer this over the individual tools at the start of a ' +
                'conversation where the user\'s personal context matters.',
            inputSchema: {
                topic: z.string()
                    .describe('What the conversation is about (used for relevance filtering)'),
            },
        },
        async ({ topic }) => {
            const result = await getFullContext({ userId, topic });
            return jsonResult(result);
        }
    );
    // -------------------------------------------------
    // Tool: list_saved_memory_topics
    // -------------------------------------------------
    server.registerTool(
        'list_saved_memory_topics',
        {
            title: 'List saved memory topics',
            description:
                'Lists every topic the user has saved memories under — a directory ' +
                'overview showing topic name, entry count, and last-update time. ' +
                'No content is included.\n\n' +
                'When to use this tool:\n' +
                '• The user asks what they have saved or wants to know their memory topics.\n' +
                '• ALWAYS call this before get_saved_memory_by_topic to get the exact topic ' +
                'name — that tool uses exact string matching and returns nothing for a ' +
                'near-miss name.\n' +
                '• When the user asks for an overview of a subject ' +
                '("check my Japanese learning progress", "what do I know about X"): ' +
                'call this first to locate the matching topic name, then call ' +
                'get_saved_memory_by_topic to retrieve all entries.\n\n' +
                'Do NOT jump straight to search_saved_memory for overview requests. ' +
                'Broad queries have low cosine similarity to specific stored entries, ' +
                'so semantic search will miss relevant content.',
            inputSchema: {},
        },
        async () => {
            const result = await listSavedMemoryTopics({ userId });
            return jsonResult(result);
        }
    );

    // -------------------------------------------------
    // Tool: get_saved_memory_by_topic
    // -------------------------------------------------
    server.registerTool(
        'get_saved_memory_by_topic',
        {
            title: 'Get saved memory by topic',
            description:
                'Returns all saved memory entries under a specific topic, sorted ' +
                'oldest-to-newest. Returns complete content — nothing is filtered ' +
                'or truncated.\n\n' +
                'When to use this tool:\n' +
                '• You already know the exact topic name (from list_saved_memory_topics) ' +
                'and want everything the user has recorded about that subject.\n' +
                '• Standard flow for "tell me about my X" or "what is my progress on X" requests:\n' +
                '  1. Call list_saved_memory_topics to find the exact topic name.\n' +
                '  2. Call this tool with that name to get all entries.\n\n' +
                'Topic matching is exact string equality. Call list_saved_memory_topics ' +
                'first if you are not certain of the name — a slightly different string ' +
                'returns zero entries.\n\n' +
                'Do NOT substitute search_saved_memory here. Semantic search cannot ' +
                'guarantee returning all entries under a topic.',
            inputSchema: {
                topic: z.string()
                    .describe('Exact topic name as returned by list_saved_memory_topics'),
            },
        },
        async ({ topic }) => {
            const result = await getSavedMemoryByTopic({ userId, topic });
            return jsonResult(result);
        }
    );

    // -------------------------------------------------
    // Tool: search_saved_memory
    // -------------------------------------------------
    server.registerTool(
        'search_saved_memory',
        {
            title: 'Search saved memory',
            description:
                'Semantic search across all saved memories, returning entries whose ' +
                'content is closest to the query regardless of which topic they ' +
                'belong to. Results include similarity scores and are grouped by topic.\n\n' +
                'When to use this tool:\n' +
                '• The user is looking for a specific piece of information but does not ' +
                'know which topic it lives under ' +
                '(e.g. "did I write anything about て-form chaining?" or ' +
                '"what did I record about the 0.92 merge threshold?").\n' +
                '• Cross-topic lookup where the user describes a content detail, ' +
                'not a subject area.\n\n' +
                'Do NOT use this for "tell me everything about my X" or "what is my ' +
                'progress on X" requests. Summary-style queries have low cosine ' +
                'similarity to specific stored entries, so many relevant entries will ' +
                'be missed. For those requests, use ' +
                'list_saved_memory_topics → get_saved_memory_by_topic.\n\n' +
                'threshold (default 0.3): cosine similarity floor — lower catches more entries.\n' +
                'matchCount (default 20): maximum total entries returned.',
            inputSchema: {
                query: z.string()
                    .describe('Natural-language description of the information to find'),
                threshold: z.number().min(0).max(1).optional()
                    .describe('Cosine similarity floor (default 0.3)'),
                matchCount: z.number().int().min(1).max(50).optional()
                    .describe('Max entries to return (default 20)'),
            },
        },
        async ({ query, threshold, matchCount }) => {
            const result = await searchSavedMemory({ userId, query, threshold, matchCount });
            return jsonResult(result);
        }
    );

    // -------------------------------------------------
    // Tool: save_memory
    // -------------------------------------------------
    server.registerTool(
        'save_memory',
        {
            title: 'Save memory',
            description:
                'Writes one entry into the user\'s persistent memory store under a topic. ' +
                'Entries are stored verbatim and retrievable in future sessions.\n\n' +
                'Before writing:\n' +
                '1. Call list_saved_memory_topics first to see existing topics. If the ' +
                'content belongs to an existing topic, use the EXACT same topic string. ' +
                'Do not invent near-duplicate names — "日语学习", "日語學習進度", and ' +
                '"Japanese learning" are three separate buckets, not one. Only create a ' +
                'new topic name if this is genuinely a new subject with no existing home.\n\n' +
                'Content quality requirements:\n' +
                '• Write complete, self-contained content. This entry will be read in a ' +
                'future session with no access to the current conversation. Never write ' +
                '"the three weaknesses mentioned above" or any reference that only makes ' +
                'sense in this context — write out the full information explicitly.\n' +
                '• Do not summarize the conversation. Write the knowledge itself.\n\n' +
                'When to use this tool:\n' +
                '• The user explicitly asks you to save, record, or remember something.\n' +
                '• The conversation surfaces information clearly worth preserving long-term ' +
                '(a decision, a progress snapshot, a key fact or insight).\n\n' +
                'Do NOT use this proactively for minor details, conversational exchanges, ' +
                'or anything the user has not indicated they want to remember permanently. ' +
                'This is the user\'s personal memory — treat writes as significant.',
            inputSchema: {
                topic: z.string()
                    .describe(
                        'Topic this entry belongs to. Must exactly match an existing topic ' +
                        'from list_saved_memory_topics if one fits, or a new descriptive name ' +
                        'if this is a genuinely new subject.'
                    ),
                content: z.string()
                    .describe(
                        'The memory content. Must be complete and self-contained — no ' +
                        'references to "the above" or anything in the current conversation.'
                    ),
                tags: z.array(z.string()).optional()
                    .describe('Optional tags for categorization (e.g. ["日語", "N3"])'),
            },
        },
        async ({ topic, content, tags }) => {
            const result = await saveSavedMemory({ userId, topic, content, tags });
            return jsonResult(result);
        }
    );

    return server;
}


/**
 * Express handler for POST/GET /mcp.
 *
 * Per the Streamable HTTP spec: build a fresh server+transport per
 * request, connect them, then let the transport handle the HTTP
 * request/response.
 */
export async function handleMcpRequest(req, res) {
    const userId = req.mcpUser?.userId
    if (!userId) {
        // Should never happen if mcpAuthMiddleware ran first
        return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
        const server = buildServer(userId)
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // stateless mode — no session continuity
        });

        // Clean up when the HTTP connection closes.
        res.on('close', () => {
            transport.close().catch(() => { });
            server.close().catch(() => { });
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        // Defensive: if headers haven't been sent, return 500.
        if (!res.headersSent) {
            res.status(500).json({ error: 'MCP request failed' });
        }
    }
}


// =====================================================
// Helpers
// =====================================================

function jsonResult(payload) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(payload, null, 2),
            },
        ],
    };
}