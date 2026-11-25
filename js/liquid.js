/* Liquid gradient background: RCCG green / red / deep-blue blobs that drift on
 * their own and slosh toward the way you tilt your phone (or move the mouse).
 * iOS asks for motion permission. RCLiquid.needsPermission tells the landing
 * page to show an "Enable motion" chip, and RCLiquid.requestMotion() asks. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.className = 'liquid';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span><span class="blob b4"></span>';
  document.addEventListener('DOMContentLoaded', () => document.body.prepend(el));

  let tx = 0, ty = 0, cx = 0, cy = 0, running = false, motionOn = false;
  const MAX = Math.min(window.innerWidth, 900) * 0.12; // how far blobs slosh (px)

  function loop() {
    // ease toward the target → liquid lag
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
    el.style.setProperty('--tx', cx.toFixed(1) + 'px');
    el.style.setProperty('--ty', cy.toFixed(1) + 'px');
    if (Math.abs(tx - cx) > 0.2 || Math.abs(ty - cy) > 0.2) requestAnimationFrame(loop); else running = false;
  }
  function kick() { if (!running && !reduce) { running = true; requestAnimationFrame(loop); } }

  window.addEventListener('pointermove', (e) => {
    if (motionOn || e.pointerType === 'touch') return;
    tx = ((e.clientX / window.innerWidth) - 0.5) * 2 * MAX;
    ty = ((e.clientY / window.innerHeight) - 0.5) * 2 * MAX;
    kick();
  }, { passive: true });

  function onTilt(e) {
    if (e.gamma == null) return;
    motionOn = true;
    const g = Math.max(-35, Math.min(35, e.gamma)) / 35;        // left/right tilt
    const b = Math.max(-35, Math.min(35, (e.beta || 0) - 45)) / 35; // forward/back, relative to a natural holding angle
    tx = g * MAX * 1.4; ty = b * MAX * 1.4;
    kick();
  }

  const needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
  if (!needsPermission && 'DeviceOrientationEvent' in window) window.addEventListener('deviceorientation', onTilt, { passive: true });

  window.RCLiquid = {
    get needsPermission() { return needsPermission && !motionOn; },
    async requestMotion() {
      try {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r === 'granted') { window.addEventListener('deviceorientation', onTilt, { passive: true }); return true; }
      } catch (e) { /* ignore */ }
      return false;
    },
  };
})();
