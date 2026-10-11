const SENSOR_OFFSETS = [0, -Math.PI/6, Math.PI/6, -Math.PI/3, Math.PI/3];
const SENSOR_MAX = 130;
const NUM_BINS = 4;
const NUM_ACTIONS = 4;

let Q_AI = {};
let epsilon = 1.0;
const EPSILON_MIN = 0.05;
const EPSILON_DECAY = 0.9997;
const ALPHA = 0.2;
const GAMMA = 0.95;

let totalEpisodes = 0;
let bestReward = -Infinity;
let bestLapSteps = null;
let progressHistory = [];  // [{episode, bestReward, bestLapSteps}]
let lastEpisodeReward = 0;

function distanceToBin(d) {
  const ratio = d / SENSOR_MAX;
  return Math.min(NUM_BINS - 1, Math.floor(ratio * NUM_BINS));
}

function getSensorBins(car) {
  return SENSOR_OFFSETS.map(off => distanceToBin(raycast(car.x, car.y, car.angle + off, SENSOR_MAX)));
}

function speedToBin(speed) {
  const s = Math.abs(speed) / 4;
  if (s < 0.33) return 0;
  if (s < 0.66) return 1;
  return 2;
}

function getState(car) {
  return getSensorBins(car).join('') + '|' + speedToBin(car.speed);
}

function getQ(state) {
  if (!Q_AI[state]) Q_AI[state] = [0, 0, 0, 0];
  return Q_AI[state];
}

function chooseAction(state, explore = true) {
  if (explore && Math.random() < epsilon) return Math.floor(Math.random() * NUM_ACTIONS);
  const q = getQ(state);
  return q.indexOf(Math.max(...q));
}

function learnStep(state, action, reward, nextState, done) {
  const q = getQ(state);
  const nextQ = getQ(nextState);
  const target = reward + (done ? 0 : GAMMA * Math.max(...nextQ));
  q[action] += ALPHA * (target - q[action]);
}

// ============ حفظ / تحميل ============
const AI_SAVE_KEY = 'racing_ai_brain_v2';

function saveAI() {
  try {
    localStorage.setItem(AI_SAVE_KEY, JSON.stringify({
      Q: Q_AI, epsilon, totalEpisodes, bestReward, bestLapSteps, progressHistory,
    }));
  } catch(e) {}
}

function loadAI() {
  try {
    const raw = localStorage.getItem(AI_SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    Q_AI = d.Q || {};
    epsilon = d.epsilon ?? 1.0;
    totalEpisodes = d.totalEpisodes || 0;
    bestReward = d.bestReward ?? -Infinity;
    bestLapSteps = d.bestLapSteps ?? null;
    progressHistory = d.progressHistory || [];
    return true;
  } catch(e) { return false; }
}

function resetAI() {
  Q_AI = {};
  epsilon = 1.0;
  totalEpisodes = 0;
  bestReward = -Infinity;
  bestLapSteps = null;
  progressHistory = [];
  lastEpisodeReward = 0;
  try { localStorage.removeItem(AI_SAVE_KEY); } catch(e) {}
}