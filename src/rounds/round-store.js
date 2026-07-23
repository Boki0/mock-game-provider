const rounds = new Map();
const betResponses = new Map();
const resultResponses = new Map();

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

const setResultReference = (roundId, reference) => {
  const round = getRound(roundId);
  if (!round) {
    return null;
  }

  round.resultReference = reference;
  round.updatedAt = new Date().toISOString();
  return round;
};

const completeRound = (roundId, data) => {
  const round = getRound(roundId);
  if (!round) {
    return null;
  }

  const completedAt = new Date().toISOString();
  Object.assign(round, data, {
    status: "COMPLETED",
    completedAt,
    updatedAt: completedAt
  });
  return round;
};

const getResultResponse = (reference) => resultResponses.get(reference) || null;

const saveResultResponse = (reference, response) => {
  resultResponses.set(reference, response);
  return response;
};

module.exports = {
  createRound,
  getRound,
  getRoundsBySessionId,
  getBetResponse,
  saveBetResponse,
  setResultReference,
  completeRound,
  getResultResponse,
  saveResultResponse
};
