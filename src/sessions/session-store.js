const crypto = require("crypto");

const sessions = new Map();
const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

const getSessionTtlMs = () => {
  if (process.env.SESSION_TTL_MS === undefined) {
    return DEFAULT_SESSION_TTL_MS;
  }

  const configuredTtl = Number(process.env.SESSION_TTL_MS);
  return Number.isFinite(configuredTtl) && configuredTtl >= 0
    ? configuredTtl
    : DEFAULT_SESSION_TTL_MS;
};

const createSession = (data) => {
  const now = new Date();
  const createdAt = now.toISOString();
  const session = {
    sessionId: crypto.randomUUID(),
    token: data.token,
    providerCode: data.providerCode,
    gameCode: data.gameCode,
    playerId: data.playerId,
    currency: data.currency,
    mode: "REAL",
    status: "ACTIVE",
    createdAt,
    lastActivityAt: createdAt,
    expiresAt: new Date(now.getTime() + getSessionTtlMs()).toISOString(),
    authenticatedAt: null,
    closedAt: null,
    expiredAt: null
  };

  sessions.set(session.sessionId, session);
  return session;
};

const getSession = (sessionId) => sessions.get(sessionId) || null;

const getPublicSession = (sessionId) => {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  return {
    sessionId: session.sessionId,
    providerCode: session.providerCode,
    gameCode: session.gameCode,
    playerId: session.playerId,
    currency: session.currency,
    mode: session.mode,
    status: session.status,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    expiresAt: session.expiresAt,
    authenticatedAt: session.authenticatedAt,
    closedAt: session.closedAt,
    expiredAt: session.expiredAt
  };
};

const touchSession = (sessionId) => {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  session.lastActivityAt = new Date().toISOString();
  return session;
};

const closeSession = (sessionId) => {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  if (session.status !== "ACTIVE") {
    return session;
  }

  session.status = "CLOSED";
  session.closedAt = new Date().toISOString();
  return session;
};

const markAuthenticated = (sessionId) => {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  session.authenticatedAt = new Date().toISOString();
  return session;
};

const markExpired = (sessionId) => {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  session.status = "EXPIRED";
  session.expiredAt = new Date().toISOString();
  return session;
};

module.exports = {
  createSession,
  getSession,
  getPublicSession,
  touchSession,
  closeSession,
  markAuthenticated,
  markExpired
};
