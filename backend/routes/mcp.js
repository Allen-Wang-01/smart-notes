import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js' // Existing main auth (15-min access token)
import { mcpAuthMiddleware } from '../middleware/mcpAuth.js'; // New MCP-specific auth
import { generateMcpToken } from '../controllers/mcpTokenController.js';
import { handleMcpRequest } from '../mcp/server.js';

const router = express.Router();

// -------------------------------------------------
// 1. Token generation endpoint
//    - Authenticated by the regular access token
//    - User calls this from the web app to get their long-lived MCP token
// -------------------------------------------------
router.post('/token', authMiddleware, generateMcpToken);

// -------------------------------------------------
// 2. The MCP protocol endpoint itself
//    - Authenticated by the MCP-specific Bearer token
//    - Claude posts JSON-RPC messages here
//    - Streamable HTTP supports both POST (requests) and GET (server→client streams)
// -------------------------------------------------
router.post('/', mcpAuthMiddleware, handleMcpRequest);
router.get('/', mcpAuthMiddleware, handleMcpRequest);
router.delete('/', mcpAuthMiddleware, handleMcpRequest);

export default router;

// =====================================================
// Mount in the main app:
//
// import mcpRouter from './routes/mcp.js';
// app.use('/mcp', mcpRouter);
//
// Resulting endpoints:
//   POST /mcp/token   → user gets their MCP token
//   POST /mcp         → Claude posts JSON-RPC requests
//   GET  /mcp         → Claude opens server-sent streams
//   DELETE /mcp       → Claude closes sessions
// =====================================================
