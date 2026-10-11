// تشخيص سريع
function showError(msg) {
  const s = document.getElementById('status');
  if (s) s.textContent = '⚠️ ' + msg;
  console.error(msg);
}

window.addEventListener('error', e => showError(e.message));

try {
  if (typeof TRACK === 'undefined') {
    throw new Error('track.js ما تحمّل');
  }

  const canvas = document.getElementById('game');
  if (!canvas) throw new Error('canvas ما موجود');
  const ctx = canvas.getContext('2d');

  // ============ السيارة ============
  const car = {
    x: TRACK.cx + (TRACK.outer.a + TRACK.inner.a) / 2,
    y: TRACK.cy,
    angle: -Math.PI / 2,
    speed: 0,
    maxSpeed: 4,
    accel: 0.15,
    friction: 0.97,
    turnSpeed: 0.06,
    offTrack: false,
  };

  const input = { gas: false, brake: false, left: false, right: false };

  let lap = 0;
  const startTime = performance.now();
  let offtrackFrames = 0;
  let totalFrames = 0;
  let lastPolar = null;
  let accumulated = 0;

  function updateCar() {
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
    if (ctx.roundRect) {
      ctx.roundRect(-w/2, -h/2, w, h, r);
    } else {
      ctx.rect(-w/2, -h/2, w, h);
    }
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

  function loop() {
    try {
      updateCar();
      drawTrack(ctx);
      drawCar();

      const elapsed = (performance.now() - startTime) / 1000;
      document.getElementById('speed').textContent = Math.round(Math.abs(car.speed) * 60);
      document.getElementById('lap').textContent = lap;
      document.getElementById('time').textContent = elapsed.toFixed(1) + 's';
      const offPct = totalFrames > 0
        ? Math.round((offtrackFrames / totalFrames) * 100) : 0;
      document.getElementById('offtrack').textContent = offPct + '%';
    } catch(e) {
      showError(e.message);
      return;
    }
    requestAnimationFrame(loop);
  }

  // ============ ربط الأزرار ============
  function bindMomentary(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const press = e => {
      e.preventDefault();
      input[key] = true;
      el.classList.add('pressed');
    };
    const release = e => {
      if (e) e.preventDefault();
      input[key] = false;
      el.classList.remove('pressed');
    };
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
  const statusEl = document.getElementById('status');

  let lastToggle = 0;
  function toggleGo(e) {
    if (e) e.preventDefault();
    // يمنع الحرق المزدوج (touch + click)
    const now = Date.now();
    if (now - lastToggle < 300) return;
    lastToggle = now;

    input.gas = !input.gas;
    btnGo.classList.toggle('active', input.gas);
    statusEl.textContent = input.gas
      ? '🟢 شغالة — استخدم ◀ ▶ للتوجيه'
      : 'اضغط GO لتشغيل السيارة';
  }

  btnGo.addEventListener('touchstart', toggleGo, { passive: false });
  btnGo.addEventListener('click', e => {
    if (e.detail === 0) toggleGo(e);
  });

  // ============ كيبورد ============
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'w') {
      if (!input.gas) {
        input.gas = true;
        btnGo.classList.add('active');
        statusEl.textContent = '🟢 شغالة — استخدم ◀ ▶ للتوجيه';
      }
    }
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
  loop();

} catch (err) {
  showError(err.message);
}