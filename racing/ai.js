// ============ إعدادات AI ============
const SENSOR_OFFSETS = [0, -Math.PI/6, Math.PI/6, -Math.PI/3, Math.PI/3];
const SENSOR_MAX = 130;
const NUM_BINS = 4;
const NUM_ACTIONS = 4;  // 0=gas, 1=brake, 2=left, 3=right

let Q_AI = {};
let epsilon = 1.0;
const EPSILON_MIN = 0.05;
const EPSILON_DECAY = 0.9995;
const ALPHA = 0.2;
const GAMMA = 0.95;

// ============ الحساسات ============
function distanceToBin(d) {
  const ratio = d / SENSOR_MAX;
  return Math.min(NUM_BINS - 1, Math.floor(ratio * NUM_BINS));
}

function getSensorBins(car) {
  return SENSOR_OFFSETS.map(off => {
    const d = raycast(car.x, car.y, car.angle + off, SENSOR_MAX);
    return distanceToBin(d);
  });
}

function speedToBin(speed) {
  const s = Math.abs(speed) / 4;
  if (s < 0.33) return 0;
  if (s < 0.66) return 1;
  return 2;
}

function getState(car) {
  const bins = getSensorBins(car);
  const sp = speedToBin(car.speed);
  return bins.join('') + '|' + sp;
}

// ============ Q-Learning ============
function getQ(state) {
  if (!Q_AI[state]) Q_AI[state] = [0, 0, 0, 0];
  return Q_AI[state];
}

function chooseAction(state, explore = true) {
  if (explore && Math.random() < epsilon) {
    return Math.floor(Math.random() * NUM_ACTIONS);
  }
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
const AI_SAVE_KEY = 'racing_ai_brain_v1';

function saveAI() {
  try {
    localStorage.setItem(AI_SAVE_KEY, JSON.stringify({
      Q: Q_AI,
      epsilon,
      episodes: totalEpisodes,
      bestLapSteps: bestLapSteps,
      bestReward: bestReward,
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
    totalEpisodes = d.episodes || 0;
    bestLapSteps = d.bestLapSteps || null;
    bestReward = d.bestReward ?? -Infinity;
    return true;
  } catch(e) { return false; }
}

// ============ إحصاءات التدريب ============
let totalEpisodes = 0;
let bestLapSteps = null;
let bestReward = -Infinity;