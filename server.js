const express = require("express");
const path = require("path");
const {
  createSession,
  getPublicSession
} = require("./src/sessions/session-store");

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

app.listen(port, "0.0.0.0", () => {
  console.log(`Mock game provider is running on port ${port}`);
});
