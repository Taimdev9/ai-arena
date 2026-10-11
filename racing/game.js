try {
  if (typeof TRACK === 'undefined') throw new Error('track.js ما تحمّل');

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  if (!canvas) throw new Error('canvas ما موجود');

  // ============ الحالة ============
  let mode = 'manual';   // 'manual' | 'ai' | 'train'
  let showSensors = true;

  const startCar = () => ({
    x: TRACK.cx + (TRACK.outer.a + TRACK.inner.a) / 2,
    y: TRACK.cy,
    angle: -Math.PI / 2,
    speed: 0,
    maxSpeed: 4,
    accel: 0.15,
    friction: 0.97,
    turnSpeed: 0.06,
    offTrack: false,
  });

  let car = startCar();

  const input = { gas: false, brake: false, left: false, right: false };

  // ============ حالة الحلقة ============
  let lap = 0;
  let startTime = performance.now();
  let offtrackFrames = 0;
  let totalFrames = 0;
  let lastPolar = null;
  let accumulated = 0;

  // للتدريب
  let training = false;
  let trainSteps = 0;
  let trainReward = 0;
  let lastSave = 0;
  let episodeStartPolar = null;

  // ============ فيزياء السيارة ============
  function updateCarPhysics() {
    const acc = (input.gas ? 1 : 0) - (input.brake ? 1 : 0);
    car.speed += acc * car.accel;

    if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
    if (car.speed < -car.maxSpeed * 0.5) car.speed = -car.maxSpeed * 0.5;
    if (!input.gas && !input.brake) car.speed *= car.friction;
    if (Math.abs(car.speed) < 0.01) car.speed = 0;

    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (Math.abs(car.speed) > 0.1) {
      car.angle += steer * car.turnSpeed * Math.sign(car.speed);
    }

    const nx = car.x + Math.cos(car.angle) * car.speed;
    const ny = car.y + Math.sin(car.angle) * car.speed;

    const onTrack = isOnTrack(nx, ny);
    car.offTrack = !onTrack;

    if (onTrack) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed *= 0.7;
      car.x = nx;
      car.y = ny;
    }

    totalFrames++;
    if (car.offTrack) offtrackFrames++;

    // تتبع اللفات
    const dx = car.x - TRACK.cx;
    const dy = car.y - TRACK.cy;
    const polar = Math.atan2(dy, dx);
    if (lastPolar !== null) {
      let delta = polar - lastPolar;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      accumulated += delta;
      if (Math.abs(accumulated) >= 2 * Math.PI) {
        lap++;
        accumulated -= Math.sign(accumulated) * 2 * Math.PI;
      }
    }
    lastPolar = polar;
  }

  // ============ الرسم ============
  function drawCar() {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    const color = car.offTrack ? '#ff5252' : '#4fc3f7';
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = color;

    const w = 26, h = 14, r = 4;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w/2, -h/2, w, h, r);
    else ctx.rect(-w/2, -h/2, w, h);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(w/2 - 2, -4);
    ctx.lineTo(w/2 + 3, 0);
    ctx.lineTo(w/2 - 2, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawSensors() {
    if (!showSensors) return;
    SENSOR_OFFSETS.forEach(off => {
      const p = sensorEndPoint(car, off, SENSOR_MAX);
      // لون حسب القرب: أخضر بعيد، أصفر متوسط، أحمر قريب
      const ratio = p.dist / SENSOR_MAX;
      const r = Math.round(255 * (1 - ratio));
      const g = Math.round(200 * ratio + 55);
      ctx.strokeStyle = `rgba(${r},${g},80,0.55)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(car.x, car.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // نقطة النهاية
      ctx.fillStyle = `rgba(${r},${g},80,0.9)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ============ الحلقة الرئيسية ============
  function loop() {
    if (mode === 'ai') {
      // AI يقرر
      const state = getState(car);
      const action = chooseAction(state, false);
      applyAction(action);
      updateCarPhysics();
    } else if (mode === 'manual') {
      updateCarPhysics();
    }
    // في وضع التدريب، الحلقة منفصلة (trainLoop)

    drawTrack(ctx);
    if (showSensors) drawSensors();
    drawCar();

    // UI
    const elapsed = (performance.now() - startTime) / 1000;
    document.getElementById('speed').textContent = Math.round(Math.abs(car.speed) * 60);
    document.getElementById('lap').textContent = lap;
    document.getElementById('time').textContent = elapsed.toFixed(1) + 's';
    const offPct = totalFrames > 0 ? Math.round((offtrackFrames / totalFrames) * 100) : 0;
    document.getElementById('offtrack').textContent = offPct + '%';

    requestAnimationFrame(loop);
  }

  function applyAction(a) {
    input.gas = (a === 0);
    input.brake = (a === 1);
    input.left = (a === 2);
    input.right = (a === 3);
  }

  // ============ التدريب ============
  function resetEpisode() {
    car = startCar();
    lastPolar = null;
    accumulated = 0;
    episodeStartPolar = null;
    trainSteps = 0;
    trainReward = 0;
    offtrackFrames = 0;
    totalFrames = 0;
  }

  function trainStep() {
    const state = getState(car);
    const action = chooseAction(state, true);
    applyAction(action);
    updateCarPhysics();

    let reward = 0;
    if (car.offTrack) reward = -5;
    else reward = 0.5 + (Math.abs(car.speed) > 2 ? 0.3 : 0);

    const nextState = getState(car);
    const done = car.offTrack || trainSteps > 1500;

    learnStep(state, action, reward, nextState, done);
    trainReward += reward;
    trainSteps++;

    if (done) {
      totalEpisodes++;
      if (trainReward > bestReward) bestReward = trainReward;
      if (!car.offTrack && (bestLapSteps === null || trainSteps < bestLapSteps)) {
        bestLapSteps = trainSteps;
      }
      epsilon = Math.max(EPSILON_MIN, epsilon * EPSILON_DECAY);
      resetEpisode();
    }
  }

  async function trainLoop() {
    training = true;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    while (training) {
      const start = performance.now();
      // 50ms تدريب متواصل
      while (performance.now() - start < 50) {
        for (let i = 0; i < 20; i++) trainStep();
      }
      updateTrainingUI();
      // رسم السيارة فقط
      drawTrack(ctx);
      if (showSensors) drawSensors();
      drawCar();

      // حفظ كل 5 ثواني
      const now = performance.now();
      if (now - lastSave > 5000) {
        saveAI();
        lastSave = now;
      }

      await sleep(0);
    }
  }

  function updateTrainingUI() {
    document.getElementById('trEpisodes').textContent = totalEpisodes.toLocaleString();
    document.getElementById('trBestLap').textContent = bestLapSteps ?? '-';
    document.getElementById('trEpsilon').textContent = epsilon.toFixed(3);
    document.getElementById('trReward').textContent = Math.round(trainReward);
    document.getElementById('speed').textContent = Math.round(Math.abs(car.speed) * 60);
  }

  // ============ تبديل الأوضاع ============
  const modes = ['btnManual', 'btnAI', 'btnTrain'];
  function setMode(m) {
    if (training) return; // لا تبدل وانت تدرّب
    mode = m;
    modes.forEach(id => document.getElementById(id).classList.remove('active'));
    document.getElementById('btn' + m.charAt(0).toUpperCase() + m.slice(1)).classList.add('active');

    if (m === 'manual') {
      document.getElementById('trainPanel').classList.add('hidden');
      document.getElementById('controls').classList.remove('hidden');
      document.getElementById('status').textContent = 'اضغط GO لتشغيل السيارة';
      car = startCar();
      resetStats();
    } else if (m === 'ai') {
      document.getElementById('trainPanel').classList.add('hidden');
      document.getElementById('controls').classList.add('hidden');
      document.getElementById('status').textContent = '🤖 AI يقود...';
      car = startCar();
      resetStats();
    } else if (m === 'train') {
      document.getElementById('trainPanel').classList.remove('hidden');
      document.getElementById('controls').classList.add('hidden');
      document.getElementById('status').textContent = '🎓 AI يتدرب... اتركه ساعات لو بدك';
      startTraining();
    }
  }

  function resetStats() {
    lap = 0;
    startTime = performance.now();
    offtrackFrames = 0;
    totalFrames = 0;
    lastPolar = null;
    accumulated = 0;
  }

  function startTraining() {
    if (training) return;
    resetEpisode();
    trainLoop();
  }

  function stopTraining() {
    training = false;
    saveAI();
    document.getElementById('status').textContent = '⏸️ وقف التدريب — محفوظ';
  }

  // ============ ربط الأزرار ============
  function bindMomentary(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const press = e => { e.preventDefault(); input[key] = true; el.classList.add('pressed'); };
    const release = e => { if (e) e.preventDefault(); input[key] = false; el.classList.remove('pressed'); };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release);
    el.addEventListener('touchcancel', release);
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
  }

  bindMomentary('btnLeft', 'left');
  bindMomentary('btnRight', 'right');
  bindMomentary('btnBrake', 'brake');

  const btnGo = document.getElementById('btnGo');
  let lastToggle = 0;
  function toggleGo(e) {
    if (e) e.preventDefault();
    const now = Date.now();
    if (now - lastToggle < 300) return;
    lastToggle = now;
    input.gas = !input.gas;
    btnGo.classList.toggle('active', input.gas);
  }
  btnGo.addEventListener('touchstart', toggleGo, { passive: false });
  btnGo.addEventListener('click', e => { if (e.detail === 0) toggleGo(e); });

  // أزرار الأوضاع
  document.getElementById('btnManual').onclick = () => setMode('manual');
  document.getElementById('btnAI').onclick = () => setMode('ai');
  document.getElementById('btnTrain').onclick = () => {
    if (training) stopTraining();
    else setMode('train');
  };

  // checkbox الحساسات
  document.getElementById('showSensors').onchange = e => {
    showSensors = e.target.checked;
  };

  // كيبورد
  window.addEventListener('keydown', e => {
    if (mode !== 'manual') return;
    if (e.key === 'ArrowUp' || e.key === 'w') { input.gas = true; btnGo.classList.add('active'); }
    if (e.key === 'ArrowDown' || e.key === 's') input.brake = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') input.right = true;
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowDown' || e.key === 's') input.brake = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') input.right = false;
  });

  // ============ تشغيل ============
  loadAI();
  updateTrainingUI();
  loop();

} catch (err) {
  const s = document.getElementById('status');
  if (s) s.textContent = '⚠️ ' + err.message;
  console.error(err);
}