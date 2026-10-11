const LB_KEY = 'racing_leaderboard_v1';
const MAX_ENTRIES = 20;

let leaderboard = [];  // [{date, name, time, type}]

function loadLB() {
  try {
    const raw = localStorage.getItem(LB_KEY);
    if (raw) leaderboard = JSON.parse(raw) || [];
  } catch(e) { leaderboard = []; }
}

function saveLB() {
  try { localStorage.setItem(LB_KEY, JSON.stringify(leaderboard)); } catch(e) {}
}

function addResult(name, time, type) {
  leaderboard.unshift({
    date: Date.now(),
    name,
    time: parseFloat(time.toFixed(2)),
    type,
  });
  if (leaderboard.length > MAX_ENTRIES) leaderboard.length = MAX_ENTRIES;
  saveLB();
  renderLeaderboard();
}

function renderLeaderboard() {
  // أسرع 5
  const fastest = [...leaderboard].sort((a, b) => a.time - b.time).slice(0, 5);
  const fastEl = document.getElementById('fastestList');
  if (fastEl) {
    fastEl.innerHTML = fastest.length === 0
      ? '<li class="empty">لا سجلات بعد</li>'
      : fastest.map((r, i) => `
        <li class="${r.type}">
          <span class="rank">${i+1}</span>
          <span class="who">${r.type === 'ai' ? '🤖' : '👤'} ${r.name}</span>
          <span class="t">${r.time.toFixed(2)}s</span>
        </li>`).join('');
  }

  // آخر 5
  const recent = leaderboard.slice(0, 5);
  const recEl = document.getElementById('recentList');
  if (recEl) {
    recEl.innerHTML = recent.length === 0
      ? '<li class="empty">لا سجلات بعد</li>'
      : recent.map(r => `
        <li class="${r.type}">
          <span class="who">${r.type === 'ai' ? '🤖' : '👤'} ${r.name}</span>
          <span class="t">${r.time.toFixed(2)}s</span>
        </li>`).join('');
  }
}

loadLB();