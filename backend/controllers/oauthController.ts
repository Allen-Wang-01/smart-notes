import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import OAuthClient from '../models/OAuthClient.js';
import { verifyRefreshToken } from '../lib/refreshTokenHash.js';
import {
    validateRedirectUris,
    generateClientId,
    generateAuthCode,
    validateAuthorizeParams,
    isRegisteredRedirectUri,
} from '../lib/oauthValidation.js';
import { storeAuthCode } from '../lib/authCodeStore.js';
import {
    generateCsrfToken,
    storeCsrfToken,
    verifyAndConsumeCsrfToken,
} from '../lib/csrfStore.js';

const SUPPORTED_SCOPES = ['mcp:read', 'mcp:write'];
const DEFAULT_SCOPE = 'mcp:read mcp:write';

function getMcpBaseUrl(): string {
    const url = process.env.MCP_BASE_URL;
    if (!url) throw new Error('MCP_BASE_URL must be set');
    return url.replace(/\/$/, '');
}

function getClientOrigin(): string {
    return (process.env.CLIENT_ORIGIN ?? '').replace(/\/$/, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mcp/register — lightweight Dynamic Client Registration (RFC 7591)
// ─────────────────────────────────────────────────────────────────────────────
export async function registerClient(req: Request, res: Response): Promise<void> {
    try {
        const { redirect_uris, client_name } = req.body ?? {};

        const check = validateRedirectUris(redirect_uris);
        if (!check.valid) {
            res.status(400).json({
                error: 'invalid_redirect_uri',
                error_description: check.error,
            });
            return;
        }

        const clientId = generateClientId();

        await OAuthClient.create({
            clientId,
            redirectUris: redirect_uris,
            clientName: typeof client_name === 'string' ? client_name : undefined,
        });

        // RFC 7591 registration response. Public client → no client_secret.
        res.status(201).json({
            client_id: clientId,
            redirect_uris: redirect_uris,
            client_name: typeof client_name === 'string' ? client_name : undefined,
            token_endpoint_auth_method: 'none',
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
        });
    } catch (err) {
        console.error('[oauth] registerClient error:', err);
        res.status(500).json({ error: 'server_error' });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session helper — reuses the exact web refresh-token verification logic
// (jwt.verify with REFRESH_TOKEN_SECRET → User lookup → hashed constant-time
// comparison against the stored hash).
// ─────────────────────────────────────────────────────────────────────────────
interface LoggedInUser {
    id: string;
    email: string;
    username: string;
}

async function getLoggedInUser(req: Request): Promise<LoggedInUser | null> {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return null;

    try {
        const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET as string,
        ) as { userId: string };

        const user = await User.findById(decoded.userId);
        if (!user || !user.refreshToken) return null;
        if (!verifyRefreshToken(refreshToken, user.refreshToken)) return null;

        return {
            id: String(user._id),
            email: user.email,
            username: user.username,
        };
    } catch {
        return null;
    }
}

// Reconstruct the full authorize URL so the login flow can resume afterward.
function authorizeReturnUrl(req: Request): string {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    return `${getMcpBaseUrl()}/api/mcp/authorize?${qs}`;
}

// Send the browser back to the client's redirect_uri carrying an error.
function redirectWithError(
    res: Response,
    redirectUri: string,
    error: string,
    state: string | undefined,
): void {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    if (state) url.searchParams.set('state', state);
    res.redirect(url.toString());
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mcp/authorize — validate, check login, render consent (or login prompt)
// ─────────────────────────────────────────────────────────────────────────────
export async function authorize(req: Request, res: Response): Promise<void> {
    const {
        response_type,
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method,
        state,
        scope,
    } = req.query as Record<string, string | undefined>;

    // 1. Look up the client FIRST — never redirect to an unregistered client.
    if (!client_id) {
        res.status(400).json({ error: 'invalid_request', error_description: 'client_id is required' });
        return;
    }
    const client = await OAuthClient.findOne({ clientId: client_id });
    if (!client) {
        res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
        return;
    }

    // 2. redirect_uri MUST exactly match a registered URI — the critical check.
    //    A mismatch means we cannot trust the redirect target, so we 400 rather
    //    than redirect (redirecting would hand the error to an attacker URL).
    if (!redirect_uri || !isRegisteredRedirectUri(redirect_uri, client.redirectUris)) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'redirect_uri does not match a registered URI',
        });
        return;
    }

    // 3. Protocol params. From here, redirect_uri is trusted, so protocol errors
    //    are delivered back to the client per OAuth (except response_type, which
    //    we also surface directly since a bad one implies a broken client).
    const paramCheck = validateAuthorizeParams({ response_type, code_challenge, code_challenge_method });
    if (!paramCheck.valid) {
        redirectWithError(res, redirect_uri, paramCheck.error ?? 'invalid_request', state);
        return;
    }

    // 4. Login state.
    const user = await getLoggedInUser(req);
    if (!user) {
        res.status(200).type('html').send(renderLoginPrompt(authorizeReturnUrl(req)));
        return;
    }

    // 5. Consent. Mint a CSRF token bound to this user and embed it in the form;
    //    POST /authorize verifies it before minting a code (defense-in-depth).
    const requestedScope = normalizeScope(scope);
    const csrfToken = generateCsrfToken();
    await storeCsrfToken(user.id, csrfToken);

    res.status(200).type('html').send(
        renderConsentPage({
            email: user.email,
            scope: requestedScope,
            // The consent form re-submits every param so POST can re-validate.
            params: {
                response_type: response_type!,
                client_id,
                redirect_uri,
                code_challenge: code_challenge!,
                code_challenge_method: code_challenge_method!,
                state,
                scope: requestedScope,
                csrf_token: csrfToken,
            },
        }),
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mcp/authorize — process the consent decision
//   action=authorize → mint one-time code, redirect back
//   action=cancel    → redirect back with error=access_denied
//   action=switch    → clear session cookie, send to login to pick another account
// ─────────────────────────────────────────────────────────────────────────────
export async function authorizeDecision(req: Request, res: Response): Promise<void> {
    const {
        action,
        response_type,
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method,
        state,
        scope,
        csrf_token,
    } = req.body ?? {};

    // Re-validate the client + redirect_uri on POST — never trust the form blindly.
    const client = client_id ? await OAuthClient.findOne({ clientId: client_id }) : null;
    if (!client) {
        res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
        return;
    }
    if (!redirect_uri || !isRegisteredRedirectUri(redirect_uri, client.redirectUris)) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'redirect_uri does not match a registered URI',
        });
        return;
    }

    // "Use a different account": clear the current session, resume via login.
    if (action === 'switch') {
        res.clearCookie('refreshToken', { httpOnly: true, path: '/' });
        const returnTo = `${getMcpBaseUrl()}/api/mcp/authorize?${new URLSearchParams({
            response_type: response_type ?? '',
            client_id,
            redirect_uri,
            code_challenge: code_challenge ?? '',
            code_challenge_method: code_challenge_method ?? '',
            ...(state ? { state } : {}),
            ...(scope ? { scope } : {}),
        }).toString()}`;
        res.redirect(`${getClientOrigin()}/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
    }

    if (action === 'cancel') {
        redirectWithError(res, redirect_uri, 'access_denied', state);
        return;
    }

    if (action !== 'authorize') {
        res.status(400).json({ error: 'invalid_request', error_description: 'Unknown action' });
        return;
    }

    // Re-verify login on the minting request itself.
    const user = await getLoggedInUser(req);
    if (!user) {
        res.status(401).json({ error: 'login_required' });
        return;
    }

    // CSRF check: the authorization action must originate from our own consent
    // form. PKCE already makes a forged code unredeemable, but this stops the
    // minting action from being triggered cross-site at all. Constant-time
    // compare + single-use consume are handled inside the store helper.
    const csrfOk = await verifyAndConsumeCsrfToken(user.id, csrf_token);
    if (!csrfOk) {
        res.status(403).json({ error: 'invalid_csrf', error_description: 'CSRF validation failed' });
        return;
    }

    // Re-validate PKCE params before issuing a code.
    const paramCheck = validateAuthorizeParams({ response_type, code_challenge, code_challenge_method });
    if (!paramCheck.valid) {
        redirectWithError(res, redirect_uri, paramCheck.error ?? 'invalid_request', state);
        return;
    }

    // Mint the one-time authorization code. NOTE: only the short-lived code goes
    // in the front-channel redirect — never a token.
    const code = generateAuthCode();
    await storeAuthCode(code, {
        userId: user.id,
        clientId: client_id,
        redirectUri: redirect_uri,
        codeChallenge: code_challenge,
        codeChallengeMethod: 'S256',
        scope: normalizeScope(scope),
        state,
    });

    const url = new URL(redirect_uri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state); // echo state back unchanged
    res.redirect(url.toString());
}

// Intersect requested scopes with what we support; fall back to the default.
function normalizeScope(scope: string | undefined): string {
    if (!scope || typeof scope !== 'string') return DEFAULT_SCOPE;
    const requested = scope.split(/\s+/).filter(Boolean);
    const allowed = requested.filter((s) => SUPPORTED_SCOPES.includes(s));
    return allowed.length > 0 ? allowed.join(' ') : DEFAULT_SCOPE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-contained HTML (no framework, no external assets)
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background: #f5f5f7; color: #1d1d1f; display: flex; min-height: 100vh;
         align-items: center; justify-content: center; margin: 0; }
  .card { background: #fff; max-width: 420px; width: 90%; padding: 32px;
          border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { color: #515154; line-height: 1.5; font-size: 14px; }
  .email { font-weight: 600; color: #1d1d1f; }
  .scopes { background: #f5f5f7; border-radius: 10px; padding: 12px 16px; margin: 16px 0;
            font-size: 13px; color: #515154; }
  .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
  button, .btn { font-size: 15px; padding: 12px; border-radius: 10px; border: none;
                 cursor: pointer; width: 100%; font-weight: 500; }
  .primary { background: #0071e3; color: #fff; }
  .secondary { background: #e8e8ed; color: #1d1d1f; }
  .link { background: none; color: #0071e3; text-decoration: none; text-align: center;
          padding: 6px; font-size: 13px; }
`;

function renderLoginPrompt(returnUrl: string): string {
    const loginUrl = `${getClientOrigin()}/login?returnTo=${encodeURIComponent(returnUrl)}`;
    return `<!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in to Hindsight</title><style>${PAGE_STYLE}</style></head>
    <body><div class="card">
      <h1>Sign in required</h1>
      <p>Claude is requesting access to your Hindsight account. Please sign in to continue.</p>
      <div class="actions">
        <a class="btn primary" href="${escapeHtml(loginUrl)}">Sign in to Hindsight</a>
      </div>
    </div></body></html>`;
}

interface ConsentView {
    email: string;
    scope: string;
    params: {
        response_type: string;
        client_id: string;
        redirect_uri: string;
        code_challenge: string;
        code_challenge_method: string;
        state?: string;
        scope: string;
        csrf_token: string;
    };
}

function hiddenInputs(params: ConsentView['params']): string {
    return Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(
            ([k, v]) =>
                `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(String(v))}">`,
        )
        .join('');
}

function renderConsentPage(view: ConsentView): string {
    const scopeList = view.scope
        .split(/\s+/)
        .filter(Boolean)
        .map((s) => `<li>${escapeHtml(s)}</li>`)
        .join('');
    const hidden = hiddenInputs(view.params);

    return `<!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Authorize Claude</title><style>${PAGE_STYLE}</style></head>
    <body><div class="card">
      <h1>Authorize Claude</h1>
      <p>Claude is requesting access to your Hindsight account.</p>
      <p>Signed in as <span class="email">${escapeHtml(view.email)}</span></p>
      <div class="scopes">
        <strong>Requested permissions</strong>
        <ul>${scopeList}</ul>
      </div>
      <form method="POST" action="/api/mcp/authorize">
        ${hidden}
        <div class="actions">
          <button class="primary" type="submit" name="action" value="authorize">Authorize</button>
          <button class="secondary" type="submit" name="action" value="switch">Use a different account</button>
          <button class="link" type="submit" name="action" value="cancel">Cancel</button>
        </div>
      </form>
    </div></body></html>`;
}
