const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ============ السيارة ============
const car = {
  x: TRACK.cx + (TRACK.outer.a + TRACK.inner.a) / 2,
  y: TRACK.cy,
  angle: -Math.PI / 2,     // تشير للأعلى
  speed: 0,
  maxSpeed: 4,
  accel: 0.15,
  friction: 0.97,
  turnSpeed: 0.06,
  offTrack: false,
};

// ============ المدخلات ============
const keys = { gas: false, brake: false, left: false, right: false };

// ============ إحصاءات ============
let lap = 0;
let startTime = performance.now();
let elapsed = 0;
let offtrackFrames = 0;
let totalFrames = 0;
let lastPolar = null;
let accumulated = 0;

// ============ فيزياء السيارة ============
function updateCar() {
  const acc = (keys.gas ? 1 : 0) - (keys.brake ? 1 : 0);
  car.speed += acc * car.accel;

  if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
  if (car.speed < -car.maxSpeed * 0.5) car.speed = -car.maxSpeed * 0.5;

  car.speed *= car.friction;
  if (Math.abs(car.speed) < 0.01) car.speed = 0;

  // التوجيه (فقط لما تتحرك)
  const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (Math.abs(car.speed) > 0.1) {
    car.angle += steer * car.turnSpeed * Math.sign(car.speed);
  }

  // الموقع الجديد
  const nx = car.x + Math.cos(car.angle) * car.speed;
  const ny = car.y + Math.sin(car.angle) * car.speed;

  const onTrack = isOnTrack(nx, ny);
  car.offTrack = !onTrack;

  if (onTrack) {
    car.x = nx;
    car.y = ny;
  } else {
    // بطّئها وبس
    car.speed *= 0.7;
    car.x = nx;
    car.y = ny;
  }

  totalFrames++;
  if (car.offTrack) offtrackFrames++;

  // تتبع اللفات عبر زاوية الالتفاف حول المركز
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

// ============ رسم السيارة ============
function drawCar() {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  const color = car.offTrack ? '#ff5252' : '#4fc3f7';
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.fillStyle = color;

  // جسم السيارة
  const w = 26, h = 14, r = 4;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(-w/2, -h/2, w, h, r);
  } else {
    ctx.rect(-w/2, -h/2, w, h);
  }
  ctx.fill();

  // مؤشر المقدمة
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

// ============ حلقة اللعبة ============
function loop() {
  updateCar();

  drawTrack(ctx);
  drawCar();

  elapsed = (performance.now() - startTime) / 1000;
  document.getElementById('speed').textContent = Math.round(Math.abs(car.speed) * 60);
  document.getElementById('lap').textContent = lap;
  document.getElementById('time').textContent = elapsed.toFixed(1) + 's';
  const offPct = totalFrames > 0
    ? Math.round((offtrackFrames / totalFrames) * 100) : 0;
  document.getElementById('offtrack').textContent = offPct + '%';

  requestAnimationFrame(loop);
}

// ============ ربط الأزرار ============
function bindButton(id, key) {
  const el = document.getElementById(id);
  const press = e => {
    e.preventDefault();
    keys[key] = true;
    el.classList.add('pressed');
  };
  const release = e => {
    e.preventDefault();
    keys[key] = false;
    el.classList.remove('pressed');
  };
  el.addEventListener('touchstart', press, { passive: false });
  el.addEventListener('touchend', release);
  el.addEventListener('touchcancel', release);
  el.addEventListener('mousedown', press);
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
}

bindButton('btnLeft', 'left');
bindButton('btnRight', 'right');
bindButton('btnGas', 'gas');
bindButton('btnBrake', 'brake');

// كيبورد (للكمبيوتر)
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp' || e.key === 'w') keys.gas = true;
  if (e.key === 'ArrowDown' || e.key === 's') keys.brake = true;
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowUp' || e.key === 'w') keys.gas = false;
  if (e.key === 'ArrowDown' || e.key === 's') keys.brake = false;
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

// ابدأ
loop();