try {
  if (typeof TRACK === 'undefined') throw new Error('track.js ما تحمّل');

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const chart = document.getElementById('chart');
  const chartCtx = chart.getContext('2d');

  // ============ سيارات ============
  function makeCar(offsetY = 0) {
    return {
      x: TRACK.cx + (TRACK.outer.a + TRACK.inner.a) / 2,
      y: TRACK.cy + offsetY,
      angle: -Math.PI / 2,
      speed: 0,
      maxSpeed: 4,
      accel: 0.15,
      friction: 0.97,
      turnSpeed: 0.06,
      offTrack: false,
      input: { gas: false, brake: false, left: false, right: false },
      lap: 0,
      lastPolar: null,
      accumulated: 0,
      offtrackFrames: 0,
      totalFrames: 0,
    };
  }

  let carHuman = makeCar(-6);
  let carAI = makeCar(6);
  let mode = 'manual';
  let showSensors = true;
  let trainSpeed = 1;

  // ============ سباق ============
  let raceRunning = false;
  let raceStartTime = 0;
  let raceFinished = false;

  // ============ تدريب ============
  let training = false;
  let trainReward = 0;
  let trainSteps = 0;
  let lastSave = 0;
  let lastHistoryPush = 0;

  // ============ فيزياء عامة ============
  function updateCarPhysics(car) {
    const inp = car.input;
    const acc = (inp.gas ? 1 : 0) - (inp.brake ? 1 : 0);
    car.speed += acc * car.accel;

    if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
    if (car.speed < -car.maxSpeed * 0.5) car.speed = -car.maxSpeed * 0.5;
    if (!inp.gas && !inp.brake) car.speed *= car.friction;
    if (Math.abs(car.speed) < 0.01) car.speed = 0;

    const steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (Math.abs(car.speed) > 0.1) {
      car.angle += steer * car.turnSpeed * Math.sign(car.speed);
    }

    const nx = car.x + Math.cos(car.angle) * car.speed;
    const ny = car.y + Math.sin(car.angle) * car.speed;

    const onTrack = isOnTrack(nx, ny);
    car.offTrack = !onTrack;

    if (onTrack) {
      car.x = nx; car.y = ny;
    } else {
      car.speed *= 0.7;
      car.x = nx; car.y = ny;
    }

    car.totalFrames++;
    if (car.offTrack) car.offtrackFrames++;

    const dx = car.x - TRACK.cx;
    const dy = car.y - TRACK.cy;
    const polar = Math.atan2(dy, dx);
    if (car.lastPolar !== null) {
      let delta = polar - car.lastPolar;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      car.accumulated += delta;
      if (Math.abs(car.accumulated) >= 2 * Math.PI) {
        car.lap++;
        car.accumulated -= Math.sign(car.accumulated) * 2 * Math.PI;
      }
    }
    car.lastPolar = polar;
  }

  // ============ رسم ============
  function drawCar(car, colorOverride) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    const color = colorOverride || (car.offTrack ? '#ff5252' : '#4fc3f7');
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

  function drawSensors(car) {
    if (!showSensors) return;
    SENSOR_OFFSETS.forEach(off => {
      const p = sensorEndPoint(car, off, SENSOR_MAX);
      const ratio = p.dist / SENSOR_MAX;
      const r = Math.round(255 * (1 - ratio));
      const g = Math.round(200 * ratio + 55);
      ctx.strokeStyle = `rgba(${r},${g},80,0.4)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(car.x, car.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
  }

  function drawChart() {
    const W = chart.width, H = chart.height;
    chartCtx.clearRect(0, 0, W, H);
    chartCtx.fillStyle = 'rgba(0,0,0,0.25)';
    chartCtx.fillRect(0, 0, W, H);

    if (progressHistory.length < 2) {
      chartCtx.fillStyle = '#5a6a8f';
      chartCtx.font = '12px sans-serif';
      chartCtx.textAlign = 'center';
      chartCtx.fillText('مخطط التطور — يحتاج تدريب أكثر', W/2, H/2 + 4);
      return;
    }

    // نطاق المكافآت
    let minR = Infinity, maxR = -Infinity;
    progressHistory.forEach(p => {
      if (p.bestReward < minR) minR = p.bestReward;
      if (p.bestReward > maxR) maxR = p.bestReward;
    });
    if (maxR === minR) maxR = minR + 1;

    const pad = 10;
    const plotW = W - pad * 2;
    const plotH = H - pad * 2;

    // خط التدرج
    const grad = chartCtx.createLinearGradient(0, pad, 0, H - pad);
    grad.addColorStop(0, 'rgba(79,195,247,0.4)');
    grad.addColorStop(1, 'rgba(79,195,247,0)');

    chartCtx.beginPath();
    progressHistory.forEach((p, i) => {
      const x = pad + (i / (progressHistory.length - 1)) * plotW;
      const y = pad + plotH - ((p.bestReward - minR) / (maxR - minR)) * plotH;
      if (i === 0) chartCtx.moveTo(x, y);
      else chartCtx.lineTo(x, y);
    });
    // لإغلاق التدرج
    const pathStr = chartCtx.toString;
    chartCtx.strokeStyle = '#4fc3f7';
    chartCtx.lineWidth = 2;
    chartCtx.stroke();

    // نقاط
    progressHistory.forEach((p, i) => {
      const x = pad + (i / (progressHistory.length - 1)) * plotW;
      const y = pad + plotH - ((p.bestReward - minR) / (maxR - minR)) * plotH;
      chartCtx.fillStyle = '#4fc3f7';
      chartCtx.beginPath();
      chartCtx.arc(x, y, 2.5, 0, Math.PI * 2);
      chartCtx.fill();
    });

    // نصوص
    chartCtx.fillStyle = '#8a9bc7';
    chartCtx.font = '10px sans-serif';
    chartCtx.textAlign = 'left';
    chartCtx.fillText(`أفضل مكافأة: ${Math.round(maxR)}`, pad, pad + 10);
    chartCtx.textAlign = 'right';
    chartCtx.fillText(`${progressHistory.length * 100} حلقة`, W - pad, H - pad + 8);
  }

  // ============ أوضاع ============
  function resetStats() {
    [carHuman, carAI].forEach(c => {
      c.lap = 0;
      c.offtrackFrames = 0;
      c.totalFrames = 0;
      c.lastPolar = null;
      c.accumulated = 0;
    });
    raceRunning = false;
    raceFinished = false;
  }

  function setMode(m) {
    if (training && m !== 'train') {
      // وقف التدريب قبل التبديل
      training = false;
      saveAI();
    }
    mode = m;

    ['Manual', 'Race', 'Train'].forEach(x => {
      const el = document.getElementById('btn' + x);
      if (el) el.classList.toggle('active', x.toLowerCase() === m);
    });

    document.getElementById('trainPanel').classList.toggle('hidden', m !== 'train');
    document.getElementById('speedPanel').classList.toggle('hidden', m !== 'train');
    document.getElementById('raceInfo').classList.toggle('hidden', m !== 'race');
    document.getElementById('controls').classList.toggle('hidden', m !== 'manual');
    document.getElementById('raceStartBtn').classList.toggle('hidden', m !== 'race');

    carHuman = makeCar(-6);
    carAI = makeCar(6);
    resetStats();

    if (m === 'manual') {
      document.getElementById('status').textContent = 'اضغط GO للانطلاق';
    } else if (m === 'race') {
      document.getElementById('status').textContent = '🏁 اضغط "ابدأ السباق"';
      document.getElementById('raceResult').textContent = '';
    } else if (m === 'train') {
      document.getElementById('status').textContent = '🎓 اضغط "تدريب" لبدء التعلم';
      startTraining();
    }

    drawChart();
    updateTrainUI();
  }

  // ============ الرسم الرئيسي ============
  function loop() {
    // 1 خطوة فيديو
    if (mode === 'manual') {
      updateCarPhysics(carHuman);
    } else if (mode === 'race') {
      if (raceRunning && !raceFinished) {
        // الإنسان
        updateCarPhysics(carHuman);
        // AI
        const s = getState(carAI);
        const a = chooseAction(s, false); // بدون استكشاف في السباق
        applyAI(carAI, a);
        updateCarPhysics(carAI);

        // فحص الفائز
        if (carHuman.lap >= 1 && carAI.lap >= 1) {
          // كلاهما أنهى — الأسرع زمن
          // (سبقنا الحالة، ننهي بالزمن)
        }
        if (carHuman.lap >= 1) {
          finishRace('human');
        } else if (carAI.lap >= 1) {
          finishRace('ai');
        }
      }
    } else if (mode === 'train') {
      if (training) {
        for (let i = 0; i < trainSpeed; i++) trainStep();
      }
    }

    drawTrack(ctx);
    if (mode === 'manual') {
      if (showSensors) drawSensors(carHuman);
      drawCar(carHuman);
    } else if (mode === 'race') {
      if (showSensors) drawSensors(carAI);
      drawCar(carAI, '#ff8a80');  // AI أحمر
      drawCar(carHuman, '#4fc3f7'); // إنت أزرق
    } else if (mode === 'train') {
      if (showSensors) drawSensors(carAI);
      drawCar(carAI);
    }

    // UI
    if (mode === 'manual') {
      updateStats(carHuman);
    } else if (mode === 'race') {
      updateRaceUI();
    } else if (mode === 'train') {
      updateTrainUI();
    }

    requestAnimationFrame(loop);
  }

  function applyAI(car, a) {
    car.input.gas = (a === 0);
    car.input.brake = (a === 1);
    car.input.left = (a === 2);
    car.input.right = (a === 3);
  }

  function updateStats(car) {
    document.getElementById('speed').textContent = Math.round(Math.abs(car.speed) * 60);
    document.getElementById('lap').textContent = car.lap;
    document.getElementById('time').textContent =
      ((performance.now() - raceStartTime) / 1000).toFixed(1) + 's';
    const pct = car.totalFrames > 0 ? Math.round((car.offtrackFrames / car.totalFrames) * 100) : 0;
    document.getElementById('offtrack').textContent = pct + '%';
  }

  function updateRaceUI() {
    const now = performance.now();
    const t = raceRunning ? (now - raceStartTime) / 1000 : 0;
    document.getElementById('speed').textContent = Math.round(Math.abs(carHuman.speed) * 60);
    document.getElementById('lap').textContent = carHuman.lap;
    document.getElementById('time').textContent = t.toFixed(1) + 's';
    const pct = carHuman.totalFrames > 0 ? Math.round((carHuman.offtrackFrames / carHuman.totalFrames) * 100) : 0;
    document.getElementById('offtrack').textContent = pct + '%';

    if (raceRunning) {
      document.getElementById('raceResult').textContent =
        `أنت: ${carHuman.lap} لفة | 🤖 AI: ${carAI.lap} لفة`;
    }
  }

  function updateTrainUI() {
    document.getElementById('trEpisodes').textContent = totalEpisodes.toLocaleString();
    document.getElementById('trBestLap').textContent = bestLapSteps ?? '-';
    document.getElementById('trEpsilon').textContent = epsilon.toFixed(3);
    document.getElementById('trReward').textContent = Math.round(lastEpisodeReward);
    document.getElementById('speed').textContent = Math.round(Math.abs(carAI.speed) * 60);
    document.getElementById('lap').textContent = carAI.lap;
    document.getElementById('time').textContent = '—';
    const pct = carAI.totalFrames > 0 ? Math.round((carAI.offtrackFrames / carAI.totalFrames) * 100) : 0;
    document.getElementById('offtrack').textContent = pct + '%';
    if (training) drawChart();
  }

  // ============ سباق ============
  function startRace() {
    carHuman = makeCar(-6);
    carAI = makeCar(6);
    raceRunning = true;
    raceFinished = false;
    raceStartTime = performance.now();
    document.getElementById('raceResult').textContent = 'انطلق!';
    document.getElementById('status').textContent = '🏁 السباق شغال';
  }

  function finishRace(winner) {
    raceFinished = true;
    raceRunning = false;
    const elapsed = (performance.now() - raceStartTime) / 1000;
    const label = winner === 'human' ? '👤 أنت' : '🤖 AI';
    document.getElementById('status').textContent = `🏆 فاز ${label}! الوقت: ${elapsed.toFixed(2)}s`;

    addResult(winner === 'human' ? 'أنت' : 'AI', elapsed, winner === 'human' ? 'human' : 'ai');
  }

  // ============ تدريب ============
  function trainStep() {
    const s = getState(carAI);
    const a = chooseAction(s, true);
    applyAI(carAI, a);
    updateCarPhysics(carAI);

    let reward;
    if (carAI.offTrack) reward = -5;
    else reward = 0.5 + (Math.abs(carAI.speed) > 2 ? 0.3 : 0);

    const s2 = getState(carAI);
    const done = carAI.offTrack || trainSteps > 1500;

    learnStep(s, a, reward, s2, done);
    trainReward += reward;
    trainSteps++;

    if (done) {
      totalEpisodes++;
      lastEpisodeReward = trainReward;
      if (trainReward > bestReward) bestReward = trainReward;
      if (!carAI.offTrack && (bestLapSteps === null || trainSteps < bestLapSteps)) {
        bestLapSteps = trainSteps;
      }
      epsilon = Math.max(EPSILON_MIN, epsilon * EPSILON_DECAY);
      trainReward = 0;
      trainSteps = 0;

      // سجّل نقطة كل 100 حلقة
      if (totalEpisodes % 100 === 0) {
        progressHistory.push({
          episode: totalEpisodes,
          bestReward: bestReward,
          bestLapSteps: bestLapSteps,
        });
        if (progressHistory.length > 100) progressHistory.shift();
      }

      // إعادة ضبط السيارة
      carAI = makeCar();
    }
  }

  function startTraining() {
    if (training) return;
    training = true;
    trainReward = 0;
    trainSteps = 0;
    carAI = makeCar();
    lastSave = performance.now();
    document.getElementById('status').textContent = '🎓 AI يتدرب... اتركه وقت طويل';
    document.getElementById('btnTrainToggle').textContent = '⏸️ إيقاف التدريب';
  }

  function stopTraining() {
    training = false;
    saveAI();
    document.getElementById('status').textContent = '⏸️ وقف التدريب — محفوظ في المتصفح';
    document.getElementById('btnTrainToggle').textContent = '▶️ ابدأ التدريب';
  }

  // ============ الأزرار ============
  function bindMomentary(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const press = e => { e.preventDefault(); carHuman.input[key] = true; el.classList.add('pressed'); };
    const release = e => { if (e) e.preventDefault(); carHuman.input[key] = false; el.classList.remove('pressed'); };
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
    carHuman.input.gas = !carHuman.input.gas;
    btnGo.classList.toggle('active', carHuman.input.gas);
  }
  btnGo.addEventListener('touchstart', toggleGo, { passive: false });
  btnGo.addEventListener('click', e => { if (e.detail === 0) toggleGo(e); });

  // أوضاع
  document.getElementById('btnManual').onclick = () => setMode('manual');
  document.getElementById('btnRace').onclick = () => setMode('race');
  document.getElementById('btnTrain').onclick = () => setMode('train');

  document.getElementById('raceStartBtn').onclick = startRace;

  // زر التدريب الرئيسي
  document.getElementById('btnTrainToggle').onclick = () => {
    if (training) stopTraining();
    else startTraining();
  };

  // إعادة ضبط الذاكرة
  document.getElementById('btnResetBrain').onclick = () => {
    if (!confirm('متأكد؟ رح تمسح كل ذاكرة AI')) return;
    resetAI();
    updateTrainUI();
    drawChart();
    document.getElementById('status').textContent = '🗑️ تصفير AI';
  };

  // سرعة التدريب
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      trainSpeed = parseInt(btn.dataset.speed);
    };
  });

  // عرض الحساسات
  document.getElementById('showSensors').onchange = e => {
    showSensors = e.target.checked;
  };

  // كيبورد
  window.addEventListener('keydown', e => {
    if (mode !== 'manual' && mode !== 'race') return;
    if (e.key === 'ArrowUp' || e.key === 'w') { carHuman.input.gas = true; btnGo.classList.add('active'); }
    if (e.key === 'ArrowDown' || e.key === 's') carHuman.input.brake = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') carHuman.input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') carHuman.input.right = true;
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowDown' || e.key === 's') carHuman.input.brake = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') carHuman.input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') carHuman.input.right = false;
  });

  // حفظ كل 5 ثواني
  setInterval(() => {
    if (training) saveAI();
  }, 5000);

  // ============ تشغيل ============
  loadAI();
  renderLeaderboard();
  updateTrainUI();
  drawChart();
  loop();

} catch (err) {
  const s = document.getElementById('status');
  if (s) s.textContent = '⚠️ ' + err.message;
  console.error(err);
}