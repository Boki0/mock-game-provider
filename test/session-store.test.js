const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createSession,
  getSession,
  getPublicSession,
  touchSession,
  closeSession,
  markAuthenticated,
  markExpired
} = require("../src/sessions/session-store");

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

const createTestSession = () => createSession({
  token: "casino-token",
  providerCode: "NOVA_REELS",
  gameCode: "NOVA_SEVEN",
  playerId: "player-123",
  currency: "EUR"
});

test("creates and stores a session with fallback TTL", () => {
  const originalTtl = process.env.SESSION_TTL_MS;
  delete process.env.SESSION_TTL_MS;

  try {
    const beforeCreation = Date.now();
    const session = createTestSession();
    const afterCreation = Date.now();
    const createdAt = Date.parse(session.createdAt);

    assert.match(session.sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(session.token, "casino-token");
    assert.equal(session.mode, "REAL");
    assert.equal(session.status, "ACTIVE");
    assert.equal(session.lastActivityAt, session.createdAt);
    assert.equal(Date.parse(session.expiresAt) - createdAt, DEFAULT_SESSION_TTL_MS);
    assert.ok(createdAt >= beforeCreation && createdAt <= afterCreation);
    assert.equal(session.authenticatedAt, null);
    assert.equal(session.closedAt, null);
    assert.equal(session.expiredAt, null);
    assert.equal(getSession(session.sessionId), session);
    assert.equal(getSession("missing-session"), null);
  } finally {
    if (originalTtl === undefined) {
      delete process.env.SESSION_TTL_MS;
    } else {
      process.env.SESSION_TTL_MS = originalTtl;
    }
  }
});

test("returns a public session without the token", () => {
  const session = createTestSession();
  const publicSession = getPublicSession(session.sessionId);

  assert.equal(Object.hasOwn(publicSession, "token"), false);
  assert.equal(publicSession.sessionId, session.sessionId);
  assert.equal(publicSession.providerCode, session.providerCode);
  assert.equal(publicSession.expiresAt, session.expiresAt);
  assert.equal(getPublicSession("missing-session"), null);
});

test("touches a session", async () => {
  const session = createTestSession();
  const previousActivity = session.lastActivityAt;

  await new Promise((resolve) => setTimeout(resolve, 5));
  const touchedSession = touchSession(session.sessionId);

  assert.equal(touchedSession, session);
  assert.ok(Date.parse(touchedSession.lastActivityAt) > Date.parse(previousActivity));
  assert.equal(touchSession("missing-session"), null);
});

test("closes a session", () => {
  const session = createTestSession();
  const closedSession = closeSession(session.sessionId);

  assert.equal(closedSession.status, "CLOSED");
  assert.ok(Number.isFinite(Date.parse(closedSession.closedAt)));
  assert.equal(closeSession("missing-session"), null);
});

test("marks a session as authenticated", () => {
  const session = createTestSession();
  const authenticatedSession = markAuthenticated(session.sessionId);

  assert.ok(Number.isFinite(Date.parse(authenticatedSession.authenticatedAt)));
  assert.equal(markAuthenticated("missing-session"), null);
});

test("marks a session as expired", () => {
  const session = createTestSession();
  const expiredSession = markExpired(session.sessionId);

  assert.equal(expiredSession.status, "EXPIRED");
  assert.ok(Number.isFinite(Date.parse(expiredSession.expiredAt)));
  assert.equal(markExpired("missing-session"), null);
});
