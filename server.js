const express = require("express");

const app = express();
const port = process.env.PORT || 8090;

app.use(express.json());

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

app.listen(port, "0.0.0.0", () => {
  console.log(`Mock game provider is running on port ${port}`);
});