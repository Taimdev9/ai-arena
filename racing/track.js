// تعريف المضمار (حلقة بيضاوية)
const TRACK = {
  cx: 350, cy: 250,
  outer: { a: 320, b: 220 },
  inner: { a: 180, b: 100 },
};

// هل النقطة داخل المضمار؟
function isOnTrack(x, y) {
  const dx = x - TRACK.cx;
  const dy = y - TRACK.cy;
  const inOuter = (dx*dx)/(TRACK.outer.a*TRACK.outer.a) +
                  (dy*dy)/(TRACK.outer.b*TRACK.outer.b) < 1;
  const inInner = (dx*dx)/(TRACK.inner.a*TRACK.inner.a) +
                  (dy*dy)/(TRACK.inner.b*TRACK.inner.b) < 1;
  return inOuter && !inInner;
}

// رسم المضمار
function drawTrack(ctx) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // الخلفية (عشب)
  ctx.fillStyle = '#16281a';
  ctx.fillRect(0, 0, W, H);

  // المسار (الإهليلج الخارجي)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(TRACK.cx, TRACK.cy, TRACK.outer.a, TRACK.outer.b, 0, 0, Math.PI*2);
  ctx.fillStyle = '#2a2a35';
  ctx.fill();
  ctx.restore();

  // الداخل (عشب)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(TRACK.cx, TRACK.cy, TRACK.inner.a, TRACK.inner.b, 0, 0, Math.PI*2);
  ctx.fillStyle = '#16281a';
  ctx.fill();
  ctx.restore();

  // الخط المتقطع في منتصف المسار
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

  // خط البداية (خط أبيض على اليمين)
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(TRACK.cx + TRACK.inner.a, TRACK.cy);
  ctx.lineTo(TRACK.cx + TRACK.outer.a, TRACK.cy);
  ctx.stroke();
  ctx.restore();
}