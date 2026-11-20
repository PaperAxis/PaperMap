// Copyright (c) 2026 PaperAxis. All rights reserved.
// External sign-in (Google, PaperApp OIDC): provider config, one-time stores
// and id_token verification. Flow and account rules: docs/SSO.md.
import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from './config.js';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

function googleConfig() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return null;
  return {
    id: 'google',
    clientId,
    clientSecret,
    tokenAuth: 'client_secret_post',
    extraAuthParams: { prompt: 'select_account' },
    async metadata() {
      return {
        issuers: GOOGLE_ISSUERS,
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
      };
    },
  };
}

let paperappMeta = null; // { value, at }
const META_TTL_MS = 60 * 60 * 1000;

function paperappConfig() {
  const issuer = (process.env.PAPERAPP_ISSUER || '').trim().replace(/\/+$/, '');
  const clientId = (process.env.PAPERAPP_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PAPERAPP_CLIENT_SECRET || '').trim();
  if (!issuer || !clientId || !clientSecret) return null;
  return {
    id: 'paperapp',
    clientId,
    clientSecret,
    issuer,
    tokenAuth: 'client_secret_basic',
    extraAuthParams: {},
    async metadata() {
      if (paperappMeta && Date.now() - paperappMeta.at < META_TTL_MS) return paperappMeta.value;
      const res = await fetch(`${issuer}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`PaperApp discovery ${res.status}`);
      const doc = await res.json();
      // The discovery document must describe the configured issuer exactly.
      if (doc.issuer !== issuer) throw new Error('PaperApp discovery issuer mismatch');
      const value = {
        issuers: [issuer],
        authorizationEndpoint: doc.authorization_endpoint,
        tokenEndpoint: doc.token_endpoint,
        jwksUri: doc.jwks_uri,
      };
      paperappMeta = { value, at: Date.now() };
      return value;
    },
  };
}

export function getProvider(id) {
  if (id === 'google') return googleConfig();
  if (id === 'paperapp') return paperappConfig();
  return null;
}

export function enabledProviders() {
  return ['google', 'paperapp'].filter((id) => getProvider(id));
}

export function redirectUri(providerId) {
  return `${config.appUrl}/api/sso/${providerId}/callback`;
}

// https is required in production; plain http is accepted only in development.
export function appUrlUsable() {
  if (!config.appUrl) return false;
  try {
    const u = new URL(config.appUrl);
    return u.protocol === 'https:' || process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

export function returnUrl(client) {
  return client === 'web' ? `${config.appUrl}/sso` : 'papermap://sso';
}

// --- One-time stores -------------------------------------------------------
// Kept in process memory: the server runs as a single instance and every
// entry lives for minutes at most. A restart only cancels sign-ins in flight.
const STATE_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 120 * 1000;
const CODE_TTL_MS = 120 * 1000;

const states = new Map();
const tickets = new Map();
const codes = new Map();

function put(map, value, ttlMs) {
  const key = crypto.randomBytes(32).toString('hex');
  map.set(key, { ...value, exp: Date.now() + ttlMs });
  return key;
}

function take(map, key) {
  if (typeof key !== 'string' || !key) return null;
  const entry = map.get(key);
  if (!entry) return null;
  map.delete(key);
  return entry.exp > Date.now() ? entry : null;
}

setInterval(() => {
  const now = Date.now();
  for (const map of [states, tickets, codes]) {
    for (const [k, v] of map) if (v.exp <= now) map.delete(k);
  }
}, 60 * 1000).unref();

export const saveState = (v) => put(states, v, STATE_TTL_MS);
export const takeState = (k) => take(states, k);
export const saveTicket = (v) => put(tickets, v, TICKET_TTL_MS);
export const takeTicket = (k) => take(tickets, k);
export const saveCode = (v) => put(codes, v, CODE_TTL_MS);
export const takeCode = (k) => take(codes, k);

// --- PKCE / OIDC helpers ---------------------------------------------------
export function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function randomToken() {
  return crypto.randomBytes(24).toString('base64url');
}

const jwksCache = new Map();
function jwks(uri) {
  if (!jwksCache.has(uri)) jwksCache.set(uri, createRemoteJWKSet(new URL(uri)));
  return jwksCache.get(uri);
}

/** Exchanges the authorization code and returns verified id_token claims. */
export async function exchangeCode(provider, code, verifier, nonce) {
  const meta = await provider.metadata();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(provider.id),
    code_verifier: verifier,
  });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
  if (provider.tokenAuth === 'client_secret_basic') {
    const basic = `${encodeURIComponent(provider.clientId)}:${encodeURIComponent(provider.clientSecret)}`;
    headers.Authorization = `Basic ${Buffer.from(basic).toString('base64')}`;
  } else {
    body.set('client_id', provider.clientId);
    body.set('client_secret', provider.clientSecret);
  }
  const res = await fetch(meta.tokenEndpoint, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`token endpoint ${res.status}`);
  const tokens = await res.json();
  if (typeof tokens.id_token !== 'string') throw new Error('no id_token');
  const { payload } = await jwtVerify(tokens.id_token, jwks(meta.jwksUri), {
    issuer: meta.issuers,
    audience: provider.clientId,
    algorithms: ['RS256'],
  });
  if (payload.nonce !== nonce) throw new Error('nonce mismatch');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('no sub');
  return payload;
}
