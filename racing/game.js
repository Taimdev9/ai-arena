const canvas = document.getElementById('game');
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

// ============ حالة الـ Joystick ============
const joystick = { x: 0, y: 0, active: false };
const keyboard = { x: 0, y: 0 };

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
  // دمج إدخال الجويستيك + الكيبورد
  const ix = joystick.active ? joystick.x : keyboard.x;
  const iy = joystick.active ? joystick.y : keyboard.y;

  // y سالب = للأعلى (غاز) | y موجب = للأسفل (فرملة)
  const gasInput = Math.max(0, -iy);
  const brakeInput = Math.max(0, iy);
  const steer = ix;

  const acc = gasInput - brakeInput;
  car.speed += acc * car.accel;

  if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
  if (car.speed < -car.maxSpeed * 0.5) car.speed = -car.maxSpeed * 0.5;

  car.speed *= car.friction;
  if (Math.abs(car.speed) < 0.01) car.speed = 0;

  // التوجيه (كل ما زاد التحريك، زادت زاوية الدوران)
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

// ============ رسم السيارة ============
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

// ============ Joystick ============
const joystickEl = document.getElementById('joystick');
const knobEl = document.getElementById('joystickKnob');

let joyCenterX = 0, joyCenterY = 0;
let joyMaxRadius = 42;

function computeJoyCenter() {
  const rect = joystickEl.getBoundingClientRect();
  joyCenterX = rect.left + rect.width / 2;
  joyCenterY = rect.top + rect.height / 2;
  // نصف قطر منطقة الحركة (ناقص نصف حجم الزر)
  joyMaxRadius = (rect.width / 2) - 32;
}

function setJoystick(clientX, clientY) {
  let dx = clientX - joyCenterX;
  let dy = clientY - joyCenterY;
  const dist = Math.hypot(dx, dy);

  if (dist > joyMaxRadius) {
    dx = dx / dist * joyMaxRadius;
    dy = dy / dist * joyMaxRadius;
  }

  knobEl.style.transform = `translate(${dx}px, ${dy}px)`;

  // قيم معيارية -1 إلى 1
  joystick.x = dx / joyMaxRadius;
  joystick.y = dy / joyMaxRadius;

  // منطقة ميتة صغيرة
  if (Math.abs(joystick.x) < 0.08) joystick.x = 0;
  if (Math.abs(joystick.y) < 0.08) joystick.y = 0;
}

function resetJoystick() {
  knobEl.style.transform = 'translate(0, 0)';
  joystick.x = 0;
  joystick.y = 0;
  joystick.active = false;
  joystickEl.classList.remove('active');
}

function startJoystick(clientX, clientY) {
  computeJoyCenter();
  joystick.active = true;
  joystickEl.classList.add('active');
  setJoystick(clientX, clientY);
}

// --- أحداث اللمس ---
joystickEl.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  startJoystick(t.clientX, t.clientY);
}, { passive: false });

joystickEl.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!joystick.active) return;
  const t = e.touches[0];
  setJoystick(t.clientX, t.clientY);
}, { passive: false });

joystickEl.addEventListener('touchend', e => {
  e.preventDefault();
  resetJoystick();
}, { passive: false });

joystickEl.addEventListener('touchcancel', () => resetJoystick());

// --- أحداث الماوس (للابتوب) ---
joystickEl.addEventListener('mousedown', e => {
  e.preventDefault();
  startJoystick(e.clientX, e.clientY);
});

window.addEventListener('mousemove', e => {
  if (!joystick.active) return;
  setJoystick(e.clientX, e.clientY);
});

window.addEventListener('mouseup', () => {
  if (joystick.active) resetJoystick();
});

// --- كيبورد (لو فتحت من كمبيوتر) ---
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp' || e.key === 'w') keyboard.y = -1;
  if (e.key === 'ArrowDown' || e.key === 's') keyboard.y = 1;
  if (e.key === 'ArrowLeft' || e.key === 'a') keyboard.x = -1;
  if (e.key === 'ArrowRight' || e.key === 'd') keyboard.x = 1;
});
window.addEventListener('keyup', e => {
  if (['ArrowUp','w','ArrowDown','s'].includes(e.key)) keyboard.y = 0;
  if (['ArrowLeft','a','ArrowRight','d'].includes(e.key)) keyboard.x = 0;
});

// ============ تشغيل ============
loop();