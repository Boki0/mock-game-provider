const test = require("node:test");
const assert = require("node:assert/strict");

const client = require("../src/clients/operator-wallet-client");

const originalFetch = global.fetch;
const originalBaseUrl = process.env.OPERATOR_BASE_URL;

test.afterEach(() => {
  global.fetch = originalFetch;

  if (originalBaseUrl === undefined) {
    delete process.env.OPERATOR_BASE_URL;
  } else {
    process.env.OPERATOR_BASE_URL = originalBaseUrl;
  }
});

test("posts JSON to the correct operator URL and returns JSON", async () => {
  process.env.OPERATOR_BASE_URL = "http://localhost:8080/";
  const payload = {
    playerId: "player-123",
    currency: "EUR",
    token: "private-token"
  };
  let request;

  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ balance: 123.45, currency: "EUR" })
    };
  };

  const result = await client.getBalance(payload);

  assert.equal(request.url, "http://localhost:8080/api/provider-wallet/balance");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(request.options.headers, {
    "Content-Type": "application/json"
  });
  assert.deepEqual(JSON.parse(request.options.body), payload);
  assert.deepEqual(result, { balance: 123.45, currency: "EUR" });
});

test("uses the correct path for every exported wallet method", async () => {
  process.env.OPERATOR_BASE_URL = "http://operator.test";
  const requestedUrls = [];

  global.fetch = async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    };
  };

  await client.authenticate({});
  await client.getBalance({});
  await client.placeBet({});
  await client.sendResult({});
  await client.refund({});
  await client.endRound({});

  assert.deepEqual(requestedUrls, [
    "http://operator.test/api/provider-wallet/authenticate",
    "http://operator.test/api/provider-wallet/balance",
    "http://operator.test/api/provider-wallet/bet",
    "http://operator.test/api/provider-wallet/result",
    "http://operator.test/api/provider-wallet/refund",
    "http://operator.test/api/provider-wallet/end-round"
  ]);
});

test("throws a safe error for an unsuccessful HTTP status", async () => {
  process.env.OPERATOR_BASE_URL = "http://localhost:8080";
  const payload = { token: "do-not-expose", amount: 50 };

  global.fetch = async () => ({
    ok: false,
    status: 502,
    json: async () => ({ error: "operator unavailable" })
  });

  await assert.rejects(
    client.placeBet(payload),
    (error) => {
      assert.equal(error.message, "Operator wallet request failed with HTTP 502");
      assert.equal(error.message.includes(payload.token), false);
      assert.equal(error.message.includes(JSON.stringify(payload)), false);
      return true;
    }
  );
});

test("throws when OPERATOR_BASE_URL is missing", async () => {
  delete process.env.OPERATOR_BASE_URL;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
  };

  await assert.rejects(
    client.authenticate({ token: "private-token" }),
    { message: "OPERATOR_BASE_URL is not configured" }
  );
  assert.equal(fetchCalled, false);
});
