const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../server");
const {
  getSessionHandler,
  closeSessionHandler
} = app;
const {
  createSession,
  markExpired
} = require("../src/sessions/session-store");

const invokeHandler = (handler, sessionId) => {
  const response = {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  handler({ params: { sessionId } }, response);
  return response;
};

const createTestSession = () => createSession({
  token: "private-casino-token",
  providerCode: "NOVA_REELS",
  gameCode: "NOVA_SEVEN",
  playerId: "player-123",
  currency: "EUR"
});

test("close session endpoint handles active, closed, expired, and missing sessions", async () => {
  const activeSession = createTestSession();
  const firstCloseResponse = invokeHandler(closeSessionHandler, activeSession.sessionId);
  const firstClose = firstCloseResponse.body;

  assert.equal(firstCloseResponse.statusCode, 200);
  assert.equal(firstClose.status, "CLOSED");
  assert.ok(Number.isFinite(Date.parse(firstClose.closedAt)));
  assert.equal(Object.hasOwn(firstClose, "token"), false);
  const originalClosedAt = firstClose.closedAt;

  await new Promise((resolve) => setTimeout(resolve, 5));
  const repeatedCloseResponse = invokeHandler(closeSessionHandler, activeSession.sessionId);
  const repeatedClose = repeatedCloseResponse.body;

  assert.equal(repeatedCloseResponse.statusCode, 200);
  assert.equal(repeatedClose.status, "CLOSED");
  assert.equal(repeatedClose.closedAt, originalClosedAt);
  assert.equal(Object.hasOwn(repeatedClose, "token"), false);

  const getResponse = invokeHandler(getSessionHandler, activeSession.sessionId);
  const publicSession = getResponse.body;

  assert.equal(getResponse.statusCode, 200);
  assert.equal(publicSession.status, "CLOSED");
  assert.equal(publicSession.closedAt, originalClosedAt);
  assert.equal(Object.hasOwn(publicSession, "token"), false);

  const missingResponse = invokeHandler(closeSessionHandler, "missing-session");
  const missingBody = missingResponse.body;

  assert.equal(missingResponse.statusCode, 404);
  assert.deepEqual(missingBody, { error: "Session not found" });
  assert.equal(Object.hasOwn(missingBody, "token"), false);

  const expiredSession = createTestSession();
  markExpired(expiredSession.sessionId);
  const expiredResponse = invokeHandler(closeSessionHandler, expiredSession.sessionId);
  const expiredBody = expiredResponse.body;

  assert.equal(expiredResponse.statusCode, 409);
  assert.deepEqual(expiredBody, { error: "Expired session cannot be closed" });
  assert.equal(expiredSession.status, "EXPIRED");
  assert.equal(expiredSession.closedAt, null);
  assert.equal(Object.hasOwn(expiredBody, "token"), false);
});
