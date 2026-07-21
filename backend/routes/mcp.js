import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js' // Existing web auth (access token) — for connection management
import { mcpAuthMiddleware } from '../middleware/mcpAuth.js'; // New MCP-specific auth
import { mcpRegisterRateLimiter, mcpTokenRateLimiter } from '../middleware/rateLimiters.js';
import { registerClient, authorize, authorizeDecision } from '../controllers/oauthController.js';
import { handleToken, revokeTokenEndpoint } from '../controllers/oauthTokenController.js';
import { listConnections, revokeAllConnections } from '../controllers/mcpConnectionsController.js';
import { handleMcpRequest } from '../mcp/server.js';

const router = express.Router();

// -------------------------------------------------
// 1. OAuth 2.1 endpoints (paths must match oauthDiscovery.ts metadata)
//    - /register: dynamic client registration (public client, no secret)
//    - /authorize: GET renders consent/login, POST processes the decision
//    - /token: authorization_code + refresh_token grants (public client, PKCE)
//    - /revoke: RFC 7009 token revocation (always 200)
//    All submit application/x-www-form-urlencoded, so these routes need a
//    urlencoded parser (server.js only mounts json globally).
// -------------------------------------------------
// Public unauthenticated endpoints are rate-limited per IP to prevent resource
// exhaustion (register writes to Mongo; token/revoke hit Redis + sign JWTs).
router.post('/register', mcpRegisterRateLimiter, registerClient);
router.get('/authorize', authorize);
router.post('/authorize', express.urlencoded({ extended: true }), authorizeDecision);
router.post('/token', mcpTokenRateLimiter, express.urlencoded({ extended: true }), handleToken);
router.post('/revoke', mcpTokenRateLimiter, express.urlencoded({ extended: true }), revokeTokenEndpoint);

// -------------------------------------------------
// 1c. Connection management (account settings UI)
//     - Behind the web authMiddleware (access token), NOT the MCP bearer token.
//     - Lets a logged-in user list and revoke their Claude connections.
// -------------------------------------------------
router.get('/connections', authMiddleware, listConnections);
router.post('/connections/revoke-all', authMiddleware, revokeAllConnections);

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
//   POST /mcp/register               → dynamic client registration
//   GET  /mcp/authorize              → consent / login
//   POST /mcp/authorize              → consent decision → mint auth code
//   POST /mcp/token                  → OAuth token endpoint (code + refresh grants)
//   POST /mcp/revoke                 → RFC 7009 token revocation
//   GET  /mcp/connections            → list user's MCP connections (web auth)
//   POST /mcp/connections/revoke-all → revoke all connections (web auth)
//   POST /mcp                        → Claude posts JSON-RPC requests
//   GET  /mcp                        → Claude opens server-sent streams
//   DELETE /mcp                      → Claude closes sessions
// =====================================================
