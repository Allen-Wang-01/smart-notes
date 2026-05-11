import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
    searchPersonalKnowledge,
    getUserProfile,
    getRecentContext,
    getFullContext,
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