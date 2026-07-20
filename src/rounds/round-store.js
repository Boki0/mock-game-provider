const rounds = new Map();
const betResponses = new Map();

const createRound = (data) => {
  const now = new Date().toISOString();
  const round = {
    ...data,
    createdAt: now,
    updatedAt: now
  };

  rounds.set(round.roundId, round);
  return round;
};

const getRound = (roundId) => rounds.get(roundId) || null;

const getRoundsBySessionId = (sessionId) => (
  [...rounds.values()].filter((round) => round.sessionId === sessionId)
);

const getBetResponse = (reference) => betResponses.get(reference) || null;

const saveBetResponse = (reference, response) => {
  betResponses.set(reference, response);
  return response;
};

module.exports = {
  createRound,
  getRound,
  getRoundsBySessionId,
  getBetResponse,
  saveBetResponse
};
