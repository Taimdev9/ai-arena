// تعريف المضمار
const TRACK = {
  cx: 350, cy: 250,
  outer: { a: 320, b: 220 },
  inner: { a: 180, b: 100 },
};

function isOnTrack(x, y) {
  const dx = x - TRACK.cx;
  const dy = y - TRACK.cy;
  const inOuter = (dx*dx)/(TRACK.outer.a*TRACK.outer.a) +
                  (dy*dy)/(TRACK.outer.b*TRACK.outer.b) < 1;
  const inInner = (dx*dx)/(TRACK.inner.a*TRACK.inner.a) +
                  (dy*dy)/(TRACK.inner.b*TRACK.inner.b) < 1;
  return inOuter && !inInner;
}

// حساس: يرمي شعاع وينطق بأول مسافة يلقى فيها حائط (خروج عن المضمار)
function raycast(x, y, angle, maxDist) {
  const step = 4;
  let d = 0;
  while (d < maxDist) {
    const px = x + Math.cos(angle) * d;
    const py = y + Math.sin(angle) * d;
    if (!isOnTrack(px, py)) return d;
    d += step;
  }
  return maxDist;
}

// حساب نقطة نهاية الحساس (للرسم)
function sensorEndPoint(car, angleOffset, maxDist) {
  const a = car.angle + angleOffset;
  const d = raycast(car.x, car.y, a, maxDist);
  return {
    x: car.x + Math.cos(a) * d,
    y: car.y + Math.sin(a) * d,
    dist: d,
  };
}

function drawTrack(ctx) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  ctx.fillStyle = '#16281a';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(TRACK.cx, TRACK.cy, TRACK.outer.a, TRACK.outer.b, 0, 0, Math.PI*2);
  ctx.fillStyle = '#2a2a35';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(TRACK.cx, TRACK.cy, TRACK.inner.a, TRACK.inner.b, 0, 0, Math.PI*2);
  ctx.fillStyle = '#16281a';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 14]);
  ctx.beginPath();
  const midA = (TRACK.outer.a + TRACK.inner.a) / 2;
  const midB = (TRACK.outer.b + TRACK.inner.b) / 2;
  ctx.ellipse(TRACK.cx, TRACK.cy, midA, midB, 0, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(TRACK.cx + TRACK.inner.a, TRACK.cy);
  ctx.lineTo(TRACK.cx + TRACK.outer.a, TRACK.cy);
  ctx.stroke();
  ctx.restore();
}