const express = require("express");
const path = require("path");
const crypto = require("crypto");
const {
  createSession,
  getSession,
  getPublicSession,
  touchSession,
  closeSession,
  markAuthenticated
} = require("./src/sessions/session-store");
const {
  authenticate: authenticateWithOperator,
  placeBet,
  sendResult
} = require("./src/clients/operator-wallet-client");
const {
  createRound,
  getRound,
  getBetResponse,
  saveBetResponse,
  setResultReference,
  completeRound,
  getResultResponse,
  saveResultResponse
} = require("./src/rounds/round-store");

const app = express();
const port = process.env.PORT || 8090;
const providerBaseUrl = (process.env.PROVIDER_BASE_URL || "http://localhost:8090").replace(/\/+$/, "");

const providers = [
  { providerCode: "AURORA_PLAY", name: "Aurora Play", active: true },
  { providerCode: "NOVA_REELS", name: "Nova Reels", active: true },
  { providerCode: "ATLAS_GAMING", name: "Atlas Gaming", active: true },
  { providerCode: "ORBIT_SLOTS", name: "Orbit Slots", active: true },
  { providerCode: "EMBER_GAMES", name: "Ember Games", active: true }
];

const createGame = (gameCode, providerCode, name, imgUrl) => ({
  gameCode,
  providerCode,
  name,
  category: "SLOTS",
  active: true,
  supportedCurrencies: ["EUR"],
  supportedPlatforms: ["DESKTOP", "MOBILE"],
  minBet: 1,
  maxBet: 1000,
  imgUrl
});

const games = [
  createGame("AURORA_FORTUNE", "AURORA_PLAY", "Aurora Fortune", "/images/aurora-fortune.jpg"),
  createGame("AURORA_NORTHERN_LIGHTS", "AURORA_PLAY", "Northern Lights", "/images/northern-lights.jpg"),
  createGame("AURORA_GOLDEN_HORIZON", "AURORA_PLAY", "Golden Horizon", "/images/golden-horizon.jpg"),
  createGame("NOVA_SEVEN", "NOVA_REELS", "Nova Seven", "/images/nova-seven.jpg"),
  createGame("NOVA_COSMIC_FRUITS", "NOVA_REELS", "Cosmic Fruits", "/images/cosmic-fruits.jpg"),
  createGame("NOVA_STAR_VAULT", "NOVA_REELS", "Star Vault", "/images/star-vault.jpg"),
  createGame("ATLAS_TREASURE", "ATLAS_GAMING", "Atlas Treasure", "/images/atlas-treasure.jpg"),
  createGame("ATLAS_TEMPLE_OF_COINS", "ATLAS_GAMING", "Temple of Coins", "/images/temple-of-coins.jpg"),
  createGame("ATLAS_TITAN_RICHES", "ATLAS_GAMING", "Titan Riches", "/images/titan-riches.jpg"),
  createGame("ORBIT_WILDS", "ORBIT_SLOTS", "Orbit Wilds", "/images/orbit-wilds.jpg"),
  createGame("ORBIT_GALAXY_GEMS", "ORBIT_SLOTS", "Galaxy Gems", "/images/galaxy-gems.jpg"),
  createGame("ORBIT_MOON_JACKPOT", "ORBIT_SLOTS", "Moon Jackpot", "/images/moon-jackpot.jpg"),
  createGame("EMBER_GOLD", "EMBER_GAMES", "Ember Gold", "/images/ember-gold.jpg"),
  createGame("EMBER_FIRE_REELS", "EMBER_GAMES", "Fire Reels", "/images/fire-reels.jpg"),
  createGame("EMBER_DRAGON_COINS", "EMBER_GAMES", "Dragon Coins", "/images/dragon-coins.jpg")
];

const getAuthenticateResponse = (session) => ({
  sessionId: session.sessionId,
  playerId: session.playerId,
  currency: session.currency,
  cash: session.cash,
  bonus: session.bonus,
  authenticatedAt: session.authenticatedAt
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.status(200).json({
    service: "mock-game-provider",
    message: "Mock game provider is running"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP"
  });
});

app.get("/api/providers", (req, res) => {
  res.status(200).json(providers);
});

app.get("/api/games", (req, res) => {
  const { providerCode } = req.query;
  const result = providerCode
    ? games.filter((game) => game.providerCode === providerCode)
    : games;

  res.status(200).json(result);
});

app.post("/api/launch", (req, res) => {
  const { providerCode, gameCode, playerId, currency, token, mode = "REAL" } = req.body;
  const requiredFields = { providerCode, gameCode, playerId, currency, token };
  const missingFields = Object.entries(requiredFields)
    .filter(([, value]) => value === undefined || value === null || value === "")
    .map(([field]) => field);

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`
    });
  }

  if (typeof token !== "string" || token.trim() === "") {
    return res.status(400).json({
      error: "token must be a non-empty string"
    });
  }

  if (mode !== "REAL") {
    return res.status(400).json({
      error: 'mode must be "REAL"'
    });
  }

  const provider = providers.find((item) => item.providerCode === providerCode);
  if (!provider) {
    return res.status(404).json({ error: "Provider not found" });
  }

  const game = games.find((item) => item.gameCode === gameCode);
  if (!game) {
    return res.status(404).json({ error: "Game not found" });
  }

  if (game.providerCode !== providerCode) {
    return res.status(400).json({
      error: "Game does not belong to the specified provider"
    });
  }

  const session = createSession({
    providerCode,
    gameCode,
    playerId,
    currency,
    token
  });

  const launchUrl = `${providerBaseUrl}/games/lucky-seven/?sessionId=${encodeURIComponent(session.sessionId)}`;
  return res.status(200).json({ sessionId: session.sessionId, launchUrl });
});

app.get("/api/sessions/:sessionId", (req, res) => {
  const session = getPublicSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  return res.status(200).json(session);
});

app.post("/api/sessions/:sessionId/close", (req, res) => {
  const session = closeSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status === "EXPIRED") {
    return res.status(409).json({
      error: "Expired session cannot be closed"
    });
  }

  return res.status(200).json(getPublicSession(session.sessionId));
});

app.post("/api/sessions/:sessionId/authenticate", async (req, res) => {
  const session = getSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status !== "ACTIVE") {
    return res.status(409).json({ error: "Session is not active" });
  }

  if (session.authenticatedAt) {
    return res.status(200).json(getAuthenticateResponse(session));
  }

  try {
    const operatorResponse = await authenticateWithOperator({
      token: session.token,
      providerCode: session.providerCode,
      gameCode: session.gameCode,
      sessionId: session.sessionId
    });

    if (!operatorResponse || typeof operatorResponse !== "object") {
      return res.status(502).json({ error: "Invalid operator authentication response" });
    }

    const playerId = operatorResponse.playerId || operatorResponse.userId;
    const bonus = operatorResponse.bonus ?? 0;
    const invalidResponse = !playerId
      || !operatorResponse.currency
      || !Number.isFinite(operatorResponse.cash)
      || !Number.isFinite(bonus);

    if (invalidResponse) {
      return res.status(502).json({ error: "Invalid operator authentication response" });
    }

    if (playerId !== session.playerId || operatorResponse.currency !== session.currency) {
      return res.status(502).json({ error: "Operator authentication does not match session" });
    }

    const authenticatedSession = markAuthenticated(session.sessionId, {
      playerId,
      currency: operatorResponse.currency,
      cash: operatorResponse.cash,
      bonus
    });

    return res.status(200).json(getAuthenticateResponse(authenticatedSession));
  } catch {
    return res.status(502).json({ error: "Operator authentication failed" });
  }
});

app.post("/api/sessions/:sessionId/bet", async (req, res) => {
  const session = getSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status !== "ACTIVE") {
    return res.status(409).json({ error: "Session is not active" });
  }

  if (!session.authenticatedAt) {
    return res.status(409).json({ error: "Session is not authenticated" });
  }

  const requestedAmount = req.body?.amount;
  if (typeof requestedAmount !== "number" || !Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const amount = Math.round((requestedAmount + Number.EPSILON) * 100) / 100;
  if (amount <= 0) {
    return res.status(400).json({ error: "amount is too small" });
  }

  const roundId = crypto.randomUUID();
  const reference = crypto.randomUUID();
  const previousResponse = getBetResponse(reference);

  if (previousResponse) {
    return res.status(200).json(previousResponse);
  }

  const operatorBet = {
    userId: session.playerId,
    gameId: session.gameCode,
    roundId,
    amount,
    reference,
    providerId: session.providerCode,
    timestamp: Date.now(),
    roundDetails: "spin",
    platform: ["WEB", "MOBILE"].includes(session.platform) ? session.platform : "WEB",
    language: session.language || "en",
    token: session.token
  };
  const ipAddress = req.ip && req.ip.replace(/^::ffff:/, "");

  if (ipAddress) {
    operatorBet.ipAddress = ipAddress === "::1" ? "127.0.0.1" : ipAddress;
  }

  for (const field of ["bonusCode", "jackpotId", "jackpotContribution", "jackpotDetails"]) {
    if (session[field] !== undefined && session[field] !== null && session[field] !== "") {
      operatorBet[field] = session[field];
    }
  }

  try {
    const operatorResponse = await placeBet(operatorBet);

    if (!operatorResponse || typeof operatorResponse !== "object") {
      return res.status(502).json({ error: "Invalid operator bet response" });
    }

    if (operatorResponse.error === undefined || operatorResponse.error === null) {
      return res.status(502).json({ error: "Invalid operator bet response" });
    }

    if (operatorResponse.error !== 0 && operatorResponse.error !== "0") {
      return res.status(422).json({ error: "Bet rejected by operator" });
    }

    const bonus = operatorResponse.bonus ?? 0;
    const usedPromo = operatorResponse.usedPromo ?? 0;
    const transactionIdIsValid = (
      typeof operatorResponse.transactionId === "string" && operatorResponse.transactionId !== ""
    ) || (
      typeof operatorResponse.transactionId === "number" && Number.isFinite(operatorResponse.transactionId)
    );
    const invalidResponse = !transactionIdIsValid
      || !operatorResponse.currency
      || !Number.isFinite(operatorResponse.cash)
      || !Number.isFinite(bonus)
      || !Number.isFinite(usedPromo)
      || operatorResponse.currency !== session.currency;

    if (invalidResponse) {
      return res.status(502).json({ error: "Invalid operator bet response" });
    }

    const frontendResponse = {
      roundId,
      transactionId: operatorResponse.transactionId,
      reference,
      amount,
      currency: operatorResponse.currency,
      cash: operatorResponse.cash,
      bonus,
      usedPromo,
      status: "BET_ACCEPTED"
    };

    createRound({
      roundId,
      sessionId: session.sessionId,
      userId: session.playerId,
      providerId: session.providerCode,
      gameId: session.gameCode,
      betReference: reference,
      betTransactionId: operatorResponse.transactionId,
      betAmount: amount,
      currency: operatorResponse.currency,
      cashAfterBet: operatorResponse.cash,
      bonusAfterBet: bonus,
      usedPromo,
      status: "BET_ACCEPTED"
    });

    session.cash = operatorResponse.cash;
    session.bonus = bonus;
    touchSession(session.sessionId);
    saveBetResponse(reference, frontendResponse);

    return res.status(200).json(frontendResponse);
  } catch {
    return res.status(502).json({ error: "Operator bet request failed" });
  }
});

app.post("/api/rounds/:roundId/result", async (req, res) => {
  const round = getRound(req.params.roundId);

  if (!round) {
    return res.status(404).json({ error: "Round not found" });
  }

  if (round.status === "COMPLETED") {
    const previousResponse = getResultResponse(round.resultReference);
    return previousResponse
      ? res.status(200).json(previousResponse)
      : res.status(409).json({ error: "Round is already completed" });
  }

  if (round.status !== "BET_ACCEPTED") {
    return res.status(409).json({ error: "Round cannot accept a result" });
  }

  const session = getSession(round.sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status !== "ACTIVE") {
    return res.status(409).json({ error: "Session is not active" });
  }

  const requestedAmount = req.body?.amount;
  if (typeof requestedAmount !== "number" || !Number.isFinite(requestedAmount) || requestedAmount < 0) {
    return res.status(400).json({ error: "amount must be a non-negative number" });
  }

  const amount = Math.round((requestedAmount + Number.EPSILON) * 100) / 100;
  const roundDetails = typeof req.body?.roundDetails === "string" && req.body.roundDetails
    ? req.body.roundDetails
    : "spin";
  let reference = round.resultReference;

  if (!reference) {
    do {
      reference = crypto.randomUUID();
    } while (reference === round.betReference);
    setResultReference(round.roundId, reference);
  }

  const previousResponse = getResultResponse(reference);
  if (previousResponse) {
    return res.status(200).json(previousResponse);
  }

  const operatorResult = {
    userId: round.userId || session.playerId,
    gameId: round.gameId || session.gameCode,
    roundId: round.roundId,
    amount,
    reference,
    providerId: round.providerId || session.providerCode,
    timestamp: Date.now(),
    roundDetails,
    platform: ["WEB", "MOBILE"].includes(session.platform) ? session.platform : "WEB",
    token: session.token
  };

  for (const field of [
    "bonusCode",
    "promoWinAmount",
    "promoWinReference",
    "promoCampaignID",
    "promoCampaignType"
  ]) {
    const value = round[field] ?? session[field];
    if (value !== undefined && value !== null && value !== "") {
      operatorResult[field] = value;
    }
  }

  try {
    const operatorResponse = await sendResult(operatorResult);

    if (!operatorResponse || typeof operatorResponse !== "object") {
      return res.status(502).json({ error: "Invalid operator result response" });
    }

    if (operatorResponse.error === undefined || operatorResponse.error === null) {
      return res.status(502).json({ error: "Invalid operator result response" });
    }

    if (operatorResponse.error !== 0 && operatorResponse.error !== "0") {
      return res.status(422).json({ error: "Result rejected by operator" });
    }

    const bonus = operatorResponse.bonus ?? 0;
    const transactionIdIsValid = (
      typeof operatorResponse.transactionId === "string" && operatorResponse.transactionId !== ""
    ) || (
      typeof operatorResponse.transactionId === "number" && Number.isFinite(operatorResponse.transactionId)
    );
    const invalidResponse = !transactionIdIsValid
      || !operatorResponse.currency
      || !Number.isFinite(operatorResponse.cash)
      || !Number.isFinite(bonus)
      || operatorResponse.currency !== session.currency;

    if (invalidResponse) {
      return res.status(502).json({ error: "Invalid operator result response" });
    }

    const frontendResponse = {
      roundId: round.roundId,
      transactionId: operatorResponse.transactionId,
      reference,
      amount,
      currency: operatorResponse.currency,
      cash: operatorResponse.cash,
      bonus,
      status: "COMPLETED"
    };

    saveResultResponse(reference, frontendResponse);
    completeRound(round.roundId, {
      resultTransactionId: operatorResponse.transactionId,
      winAmount: amount,
      cashAfterResult: operatorResponse.cash,
      bonusAfterResult: bonus,
      resultDescription: operatorResponse.description || ""
    });

    session.cash = operatorResponse.cash;
    session.bonus = bonus;
    touchSession(session.sessionId);

    return res.status(200).json(frontendResponse);
  } catch {
    return res.status(502).json({ error: "Operator result request failed" });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Mock game provider is running on port ${port}`);
});
