// ============ إعدادات ============
const GRID = 10;
const CELL = 42;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = GRID * CELL;
canvas.height = GRID * CELL;

const SAVE_KEY = 'lab_bot_brain_v1';

// ============ الحالة ============
const startPos = { x: 0, y: 0 };
const goal = { x: 9, y: 9 };
const walls = [
  {x:3,y:0},{x:3,y:1},{x:3,y:2},{x:3,y:3},
  {x:6,y:6},{x:6,y:7},{x:6,y:8},{x:6,y:9},
  {x:1,y:5},{x:2,y:5},{x:3,y:5},{x:4,y:5},
];

let agent = { ...startPos };
let Q = {};
let totalEpisodes = 0;
let totalWins = 0;
let trainingStartTime = null;
let totalTrainingMs = 0;

const alpha = 0.15;
const gamma = 0.95;
let epsilon = 1.0;
const epsilonMin = 0.05;
const epsilonDecay = 0.998;

let autoTraining = false;
let stopFlag = false;

// ============ حفظ / تحميل ============
let lastCloudSave = 0;
const CLOUD_INTERVAL = 30000;

function saveLocal() {
  const data = {
    Q, totalEpisodes, totalWins, epsilon,
    totalTrainingMs: totalTrainingMs + (trainingStartTime ? Date.now() - trainingStartTime : 0)
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e) {}
}

async function saveCloud() {
  if (!window.Firebase) return;
  await window.Firebase.ready;
  const data = {
    Q, totalEpisodes, totalWins, epsilon,
    totalTrainingMs: totalTrainingMs + (trainingStartTime ? Date.now() - trainingStartTime : 0)
  };
  const ok = await window.Firebase.save(data);
  const el = document.getElementById('cloud-status');
  if (el) el.textContent = ok ? '☁️ محفوظ سحابياً' : '⚠️ فشل الحفظ السحابي';
}

function save() {
  saveLocal();
  if (Date.now() - lastCloudSave > CLOUD_INTERVAL) {
    lastCloudSave = Date.now();
    saveCloud();
  }
}

async function load() {
  let localData = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) localData = JSON.parse(raw);
  } catch(e) {}

  let cloudData = null;
  if (window.Firebase) {
    const el = document.getElementById('cloud-status');
    if (el) el.textContent = '⏳ جاري الاتصال...';
    await window.Firebase.ready;
    cloudData = await window.Firebase.load();
  }

  let chosen = null;
  const localEp = localData?.totalEpisodes || 0;
  const cloudEp = cloudData?.totalEpisodes || 0;
  const el = document.getElementById('cloud-status');

  if (cloudData && (!localData || cloudEp > localEp)) {
    chosen = cloudData;
    if (el) el.textContent = '☁️ حُمّلت من السحابة';
  } else if (localData) {
    chosen = localData;
    if (el) el.textContent = '💾 حُمّلت محلياً';
    if (!cloudData || localEp > cloudEp) saveCloud();
  } else {
    if (el) el.textContent = '🆕 بداية جديدة';
  }

  if (!chosen) return false;

  Q = chosen.Q || {};
  totalEpisodes = chosen.totalEpisodes || 0;
  totalWins = chosen.totalWins || 0;
  epsilon = chosen.epsilon ?? 1.0;
  totalTrainingMs = chosen.totalTrainingMs || 0;
  return true;
}

// ============ ذاكرة AI ============
function getQ(x, y) {
  const key = `${x},${y}`;
  if (!Q[key]) Q[key] = [0, 0, 0, 0];
  return Q[key];
}

// ============ خطوة ============
function step(action) {
  let nx = agent.x, ny = agent.y;
  if (action === 0) ny--;
  if (action === 1) ny++;
  if (action === 2) nx--;
  if (action === 3) nx++;

  let reward = -0.02;
  let done = false;

  const hitWall = nx < 0 || nx >= GRID || ny < 0 || ny >= GRID ||
                  walls.some(w => w.x === nx && w.y === ny);

  if (hitWall) reward = -1;
  else { agent.x = nx; agent.y = ny; }

  if (agent.x === goal.x && agent.y === goal.y) {
    reward = 10;
    done = true;
  }
  return { reward, done };
}

// ============ حلقة تدريب واحدة ============
function trainOneEpisode() {
  agent = { ...startPos };
  let done = false, steps = 0;

  while (!done && steps < 150) {
    const q = getQ(agent.x, agent.y);
    let action;
    if (Math.random() < epsilon) action = Math.floor(Math.random() * 4);
    else action = q.indexOf(Math.max(...q));

    const ox = agent.x, oy = agent.y;
    const { reward, done: d } = step(action);
    done = d;
    if (done) totalWins++;

    const oldQ = getQ(ox, oy);
    const newQ = getQ(agent.x, agent.y);
    oldQ[action] += alpha * (reward + gamma * Math.max(...newQ) - oldQ[action]);
    steps++;
  }

  epsilon = Math.max(epsilonMin, epsilon * epsilonDecay);
  totalEpisodes++;
}

// ============ التدريب المستمر ============
async function autoTrain() {
  if (autoTraining) return;
  autoTraining = true;
  stopFlag = false;
  trainingStartTime = Date.now();
  setButtons();

  let lastSave = Date.now();
  let lastRender = Date.now();

  while (!stopFlag) {
    for (let i = 0; i < 100; i++) {
      trainOneEpisode();
      if (stopFlag) break;
    }

    const now = Date.now();
    if (now - lastRender > 500) {
      updateUI();
      render();
      lastRender = now;
    }

    if (now - lastSave > 5000) {
      saveLocal();
      lastSave = now;
    }

    if (now - lastCloudSave > CLOUD_INTERVAL) {
      lastCloudSave = now;
      saveCloud();
    }

    await sleep(0);
  }

  autoTraining = false;
  saveLocal();
  saveCloud();
  setButtons();
}

// ============ مشاهدة ============
async function watch() {
  if (autoTraining) return;
  stopFlag = false;
  agent = { ...startPos };
  document.getElementById('status').textContent = '👀 AI يلعب...';

  for (let i = 0; i < 150; i++) {
    if (stopFlag) break;
    const q = getQ(agent.x, agent.y);
    const action = q.indexOf(Math.max(...q));
    const { done } = step(action);
    render();
    await sleep(80);
    if (done) {
      document.getElementById('status').textContent = '🎉 وصل الهدف!';
      return;
    }
  }
  document.getElementById('status').textContent = '❌ ما وصل — لسا يحتاج تدريب';
}

// ============ رسم ============
function render() {
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#0e1526');
  grad.addColorStop(1, '#131c33');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i*CELL, 0); ctx.lineTo(i*CELL, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i*CELL); ctx.lineTo(canvas.width, i*CELL); ctx.stroke();
  }

  walls.forEach(w => {
    ctx.fillStyle = '#2c3a5c';
    roundRect(w.x*CELL+2, w.y*CELL+2, CELL-4, CELL-4, 6);
    ctx.fill();
  });

  ctx.shadowColor = '#ffd54f';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffd54f';
  roundRect(goal.x*CELL+6, goal.y*CELL+6, CELL-12, CELL-12, 8);
  ctx.fill();
  ctx.shadowBlur = 0;

  const cx = agent.x*CELL + CELL/2;
  const cy = agent.y*CELL + CELL/2;
  ctx.shadowColor = '#4fc3f7';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.arc(cx, cy, CELL/3, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#0e1526';
  ctx.beginPath(); ctx.arc(cx-4, cy-3, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+4, cy-3, 2.5, 0, Math.PI*2); ctx.fill();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

// ============ واجهة ============
const sleep = ms => new Promise(r => setTimeout(r, ms));

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function updateUI() {
  const elapsed = totalTrainingMs + (trainingStartTime && autoTraining ? Date.now() - trainingStartTime : 0);
  document.getElementById('episodes').textContent = totalEpisodes.toLocaleString();
  document.getElementById('wins').textContent = totalWins.toLocaleString();
  document.getElementById('rate').textContent =
    totalEpisodes > 0 ? Math.round((totalWins / totalEpisodes) * 100) + '%' : '0%';
  document.getElementById('timer').textContent = formatTime(elapsed);
  document.getElementById('epsilon').textContent = epsilon.toFixed(2);
}

function setButtons() {
  document.getElementById('btnTrain').disabled = autoTraining;
  document.getElementById('btnWatch').disabled = autoTraining;
  document.getElementById('btnStop').disabled = !autoTraining;
}

// ============ تشغيل ============
document.getElementById('btnTrain').onclick = () => {
  document.getElementById('status').textContent = '🧠 AI يتدرب لحاله... خلي الصفحة مفتوحة';
  autoTrain();
};
document.getElementById('btnWatch').onclick = watch;
document.getElementById('btnStop').onclick = () => {
  stopFlag = true;
  saveLocal();
  saveCloud();
  document.getElementById('status').textContent = '⏸️ وقف التدريب — محفوظ محلياً وسحابياً';
};
document.getElementById('btnReset').onclick = () => {
  if (!confirm('متأكد؟ رح تمسح كل ذاكرة AI')) return;
  localStorage.removeItem(SAVE_KEY);
  Q = {}; epsilon = 1.0; totalEpisodes = 0; totalWins = 0; totalTrainingMs = 0;
  updateUI(); render();
  document.getElementById('status').textContent = '🗑️ تصفّرت الذاكرة';
};

// تحميل
(async () => {
  const loaded = await load();
  if (loaded) {
    document.getElementById('status').textContent =
      `💾 تحمّلت ذاكرة — ${totalEpisodes.toLocaleString()} حلقة سابقة`;
  } else {
    document.getElementById('status').textContent = '🆕 ذاكرة فاضية — ابدأ التدريب';
  }
  updateUI();
  render();
})();

window.addEventListener('beforeunload', saveLocal); 