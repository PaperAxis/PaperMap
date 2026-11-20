// Copyright (c) 2026 PaperAxis. All rights reserved.
// Google / PaperApp sign-in and account linking. Contract: docs/SSO.md.
import crypto from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { hashPassword, signToken, publicUser, isValidUsername } from '../auth.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import {
  getProvider,
  enabledProviders,
  redirectUri,
  appUrlUsable,
  returnUrl,
  saveState,
  takeState,
  saveTicket,
  takeTicket,
  saveCode,
  takeCode,
  pkcePair,
  randomToken,
  exchangeCode,
} from '../sso.js';

const CLIENTS = new Set(['web', 'android', 'ios']);
const MODES = new Set(['login', 'link']);
const PROVIDERS = new Set(['google', 'paperapp']);

function redirectWith(res, client, params) {
  const url = new URL(returnUrl(client));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  res.redirect(302, url.toString());
}

class SsoError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// --- /api/sso: browser-facing start and callback ---------------------------
export const ssoRouter = Router();

ssoRouter.get('/:provider/start', async (req, res) => {
  const { provider: providerId } = req.params;
  const client = String(req.query.client || '');
  const mode = String(req.query.mode || 'login');
  if (!PROVIDERS.has(providerId) || !CLIENTS.has(client) || !MODES.has(mode)) {
    return res.status(400).json({ error: 'Geçersiz istek' });
  }
  const provider = getProvider(providerId);
  if (!provider || !appUrlUsable()) {
    return redirectWith(res, client, { error: 'not_configured', provider: providerId });
  }

  let userId = null;
  if (mode === 'link') {
    const ticket = takeTicket(String(req.query.ticket || ''));
    if (!ticket || ticket.provider !== providerId) {
      return redirectWith(res, client, { error: 'invalid_state', provider: providerId });
    }
    userId = ticket.userId;
  }

  try {
    const meta = await provider.metadata();
    const { verifier, challenge } = pkcePair();
    const nonce = randomToken();
    const state = saveState({ provider: providerId, client, mode, userId, verifier, nonce });
    const url = new URL(meta.authorizationEndpoint);
    const params = {
      response_type: 'code',
      client_id: provider.clientId,
      redirect_uri: redirectUri(providerId),
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...provider.extraAuthParams,
    };
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    res.redirect(302, url.toString());
  } catch (err) {
    console.error(`sso ${providerId} start:`, err.message);
    redirectWith(res, client, { error: 'provider_error', provider: providerId });
  }
});

ssoRouter.get('/:provider/callback', async (req, res) => {
  const { provider: providerId } = req.params;
  const saved = takeState(String(req.query.state || ''));
  if (!saved || saved.provider !== providerId) {
    return redirectWith(res, 'web', { error: 'invalid_state', provider: providerId });
  }
  const { client, mode } = saved;
  const fail = (code) => redirectWith(res, client, { error: code, provider: providerId });

  if (req.query.error) {
    return fail(req.query.error === 'access_denied' ? 'access_denied' : 'provider_error');
  }
  const provider = getProvider(providerId);
  if (!provider) return fail('not_configured');
  // RFC 9207: when the provider names itself in the response, it must match.
  if (providerId === 'paperapp' && req.query.iss && req.query.iss !== provider.issuer) {
    return fail('provider_error');
  }

  let claims;
  try {
    claims = await exchangeCode(provider, String(req.query.code || ''), saved.verifier, saved.nonce);
  } catch (err) {
    console.error(`sso ${providerId} callback:`, err.message);
    return fail('provider_error');
  }

  try {
    const userId =
      mode === 'link'
        ? await linkIdentity(saved.userId, providerId, claims)
        : await resolveLogin(providerId, claims);
    const code = saveCode({ mode, provider: providerId, userId });
    redirectWith(res, client, { code, mode, provider: providerId });
  } catch (err) {
    if (err instanceof SsoError) return fail(err.code);
    console.error(`sso ${providerId} account:`, err.message);
    fail('provider_error');
  }
});

function claimEmail(claims) {
  return typeof claims.email === 'string' ? claims.email.toLowerCase().trim() : '';
}

async function linkIdentity(userId, providerId, claims) {
  const existing = await prisma.authIdentity.findUnique({
    where: { provider_subject: { provider: providerId, subject: claims.sub } },
  });
  if (existing && existing.userId !== userId) throw new SsoError('identity_in_use');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.disabled) throw new SsoError('account_disabled');
  if (!existing) {
    // One identity per provider per account: linking a new one replaces the old.
    await prisma.authIdentity.deleteMany({ where: { userId, provider: providerId } });
    await prisma.authIdentity.create({
      data: { userId, provider: providerId, subject: claims.sub, email: claimEmail(claims) || null },
    });
  }
  return userId;
}

async function resolveLogin(providerId, claims) {
  const linked = await prisma.authIdentity.findUnique({
    where: { provider_subject: { provider: providerId, subject: claims.sub } },
    include: { user: true },
  });
  if (linked) {
    if (linked.user.disabled) throw new SsoError('account_disabled');
    return linked.userId;
  }

  const email = claimEmail(claims);
  if (!email) throw new SsoError('email_missing');
  const providerVerified = providerId === 'google' && claims.email_verified === true;

  const sameEmail = await prisma.user.findUnique({ where: { email } });
  if (sameEmail) {
    // Auto-link only when both sides vouch for the address.
    if (!(providerVerified && sameEmail.emailVerified)) throw new SsoError('email_in_use');
    if (sameEmail.disabled) throw new SsoError('account_disabled');
    await prisma.authIdentity.create({
      data: { userId: sameEmail.id, provider: providerId, subject: claims.sub, email },
    });
    return sameEmail.id;
  }

  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : email.split('@')[0];
  const user = await prisma.user.create({
    data: {
      email,
      username: await uniqueUsername(email),
      displayName: name.slice(0, 60),
      passwordHash: await hashPassword(crypto.randomBytes(32).toString('base64url')),
      hasPassword: false,
      emailVerified: providerVerified,
      identities: { create: { provider: providerId, subject: claims.sub, email } },
    },
  });
  return user.id;
}

async function uniqueUsername(email) {
  let base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
  if (base.length < 3) base = `${base}user`.slice(0, 20);
  if (!isValidUsername(base)) base = 'user';
  for (let i = 0; i < 20; i++) {
    const suffix = i === 0 ? '' : String(crypto.randomInt(10, 100000));
    const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    if (!(await prisma.user.findUnique({ where: { username: candidate } }))) return candidate;
  }
  return `user${crypto.randomBytes(6).toString('hex')}`.slice(0, 20);
}

// --- /api/auth: JSON endpoints -------------------------------------------
export const ssoAuthRouter = Router();

ssoAuthRouter.get('/sso/providers', (req, res) => {
  res.json({ providers: appUrlUsable() ? enabledProviders() : [] });
});

ssoAuthRouter.post('/sso/link-ticket', requireAuth, (req, res) => {
  const provider = String(req.body?.provider || '');
  if (!PROVIDERS.has(provider) || !getProvider(provider)) {
    return res.status(400).json({ error: 'Bu giriş yöntemi kullanılamıyor' });
  }
  res.json({ ticket: saveTicket({ userId: req.userId, provider }) });
});

ssoAuthRouter.post('/sso/exchange', async (req, res) => {
  const entry = takeCode(String(req.body?.code || ''));
  if (!entry) {
    return res.status(400).json({ error: 'Giriş bağlantısının süresi doldu. Yeniden deneyin.' });
  }
  let user = await prisma.user.findUnique({ where: { id: entry.userId } });
  if (!user || user.disabled) {
    return res.status(403).json({ error: 'Hesabınız devre dışı bırakıldı.' });
  }
  if (entry.mode === 'link') {
    return res.json({ linked: true, provider: entry.provider, user: publicUser(user) });
  }
  if (config.adminEmails.includes(user.email) && !user.isAdmin) {
    user = await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

ssoAuthRouter.get('/identities', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { identities: { orderBy: { createdAt: 'asc' } } },
  });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  res.json({
    identities: user.identities.map((i) => ({
      provider: i.provider,
      email: i.email,
      createdAt: i.createdAt,
    })),
    hasPassword: user.hasPassword,
  });
});

ssoAuthRouter.delete('/identities/:provider', requireAuth, async (req, res) => {
  const { provider } = req.params;
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { identities: true },
  });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  const remaining = user.identities.filter((i) => i.provider !== provider);
  if (remaining.length === user.identities.length) {
    return res.status(404).json({ error: 'Bu hesap bağlı değil' });
  }
  if (!user.hasPassword && remaining.length === 0) {
    return res.status(409).json({
      error: 'Son giriş yöntemini kaldırmadan önce bir şifre belirle.',
    });
  }
  await prisma.authIdentity.deleteMany({ where: { userId: user.id, provider } });
  res.json({ ok: true });
});
