const paths = {
  authenticate: "/api/provider-wallet/authenticate",
  balance: "/api/provider-wallet/balance",
  bet: "/api/provider-wallet/bet",
  result: "/api/provider-wallet/result",
  refund: "/api/provider-wallet/refund",
  endRound: "/api/provider-wallet/end-round"
};

const post = async (path, payload) => {
  const operatorBaseUrl = process.env.OPERATOR_BASE_URL;
  if (!operatorBaseUrl || operatorBaseUrl.trim() === "") {
    throw new Error("OPERATOR_BASE_URL is not configured");
  }

  const url = `${operatorBaseUrl.replace(/\/+$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Operator wallet request failed with HTTP ${response.status}`);
  }

  return response.json();
};

const authenticate = (payload) => post(paths.authenticate, payload);
const getBalance = (payload) => post(paths.balance, payload);
const placeBet = (payload) => post(paths.bet, payload);
const sendResult = (payload) => post(paths.result, payload);
const refund = (payload) => post(paths.refund, payload);
const endRound = (payload) => post(paths.endRound, payload);

module.exports = {
  authenticate,
  getBalance,
  placeBet,
  sendResult,
  refund,
  endRound
};
