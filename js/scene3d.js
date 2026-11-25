/* ---------------------------------------------------------------------
 * Scroll-driven 3D vehicles (three.js, built in code, no model downloads).
 *   <canvas data-3d="keke" data-dir="right">   hero: drives right as you scroll down
 *   <canvas data-3d="bike" data-dir="left">    band: rider pedals left as you scroll
 * Scrolling back up drives them back. Colours: deep blue bodies with RCCG
 * green/red accents, white and black details.
 * ------------------------------------------------------------------- */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const NAVY = 0x241F5E, GREEN = 0x098A44, RED = 0xD52027, WHITE = 0xFFFFFF, BLACK = 0x000000;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.42, metalness: o.m ?? 0.18, transparent: o.t != null, opacity: o.t ?? 1, emissive: o.e ?? BLACK, emissiveIntensity: o.ei ?? 0 });
const M = {
  navy: mat(NAVY, { r: 0.32, m: 0.35 }), green: mat(GREEN, { r: 0.4 }), red: mat(RED, { r: 0.4 }),
  white: mat(WHITE, { r: 0.3, m: 0.1 }), black: mat(BLACK, { r: 0.65, m: 0.05 }), chrome: mat(WHITE, { r: 0.15, m: 0.9 }),
  glass: mat(WHITE, { r: 0.05, m: 0.1, t: 0.22 }), lamp: mat(WHITE, { e: WHITE, ei: 1.2 }), tail: mat(RED, { e: RED, ei: 0.9 }),
};

// cylinder from a to b (Vector3s)
const UP = new THREE.Vector3(0, 1, 0);
function rod(a, b, r, material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), material);
  placeRod(m, a, b); return m;
}
function placeRod(m, a, b) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length() || 0.0001;
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.clone().divideScalar(len));
  m.scale.set(1, len, 1);
}
function wheel(radius, tire, spokes = 0, rimMat = M.white) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.TorusGeometry(radius - tire / 2, tire / 2, 14, 40), M.black); g.add(t);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius - tire, tire * 0.18, 8, 40), rimMat); g.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, tire * 1.1, 16), M.chrome); hub.rotation.x = Math.PI / 2; g.add(hub);
  if (spokes) for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const s = rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * (radius - tire), Math.sin(a) * (radius - tire), 0), 0.006, M.white); g.add(s);
  } else {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius - tire, radius - tire, tire * 0.6, 24), M.navy); disc.rotation.x = Math.PI / 2; g.add(disc);
  }
  return g;
}
function shadowBlob(w, d) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.005; return m;
}

/* ------------------------------ Keke ------------------------------ */
function buildKeke() {
  const g = new THREE.Group(); const W = 1.22;
  // lower body: side profile extruded across the width (faces +X)
  const p = new THREE.Shape();
  p.moveTo(-1.25, 0.32); p.lineTo(0.98, 0.32); p.quadraticCurveTo(1.34, 0.34, 1.34, 0.64);
  p.lineTo(1.24, 1.02); p.lineTo(0.72, 1.02); p.lineTo(0.56, 0.76); p.lineTo(-1.02, 0.76); p.lineTo(-1.25, 0.94); p.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(p, { depth: W, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 16 }), M.navy);
  body.position.z = -W / 2; g.add(body);
  // side stripes (green + red) on both sides
  for (const z of [W / 2 + 0.056, -W / 2 - 0.056]) {
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.012), M.green); s1.position.set(-0.08, 0.5, z); g.add(s1);
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.035, 0.012), M.red); s2.position.set(-0.18, 0.61, z); g.add(s2);
  }
  // roof canopy (rounded front) + white trim
  const r = new THREE.Shape();
  r.moveTo(-1.32, 1.74); r.lineTo(0.82, 1.74); r.quadraticCurveTo(1.12, 1.74, 1.18, 1.6); r.lineTo(1.12, 1.6); r.quadraticCurveTo(1.04, 1.68, 0.8, 1.68); r.lineTo(-1.32, 1.68); r.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(r, { depth: W + 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }), M.navy);
  roof.position.z = -(W + 0.16) / 2; g.add(roof);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.03, W + 0.24), M.white); trim.position.set(-0.22, 1.67, 0); g.add(trim);
  // pillars
  for (const z of [W / 2 - 0.03, -W / 2 + 0.03]) {
    g.add(rod(new THREE.Vector3(0.98, 1.0, z), new THREE.Vector3(0.96, 1.68, z), 0.028, M.chrome));
    g.add(rod(new THREE.Vector3(-1.2, 0.92, z), new THREE.Vector3(-1.24, 1.68, z), 0.03, M.chrome));
    g.add(rod(new THREE.Vector3(-0.18, 0.76, z), new THREE.Vector3(-0.18, 1.68, z), 0.022, M.chrome));
  }
  // windscreen
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 0.72), M.glass);
  ws.position.set(1.08, 1.34, 0); ws.rotation.y = Math.PI / 2; ws.rotation.x = 0; ws.rotation.z = -0.22; g.add(ws);
  // rear back panel + seat
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, W), M.navy); back.position.set(-1.26, 1.3, 0); g.add(back);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, W - 0.15), M.black); seat.position.set(-0.85, 0.86, 0); g.add(seat);
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, W - 0.15), M.black); seatBack.position.set(-1.12, 1.1, 0); g.add(seatBack);
  // handlebar + driver seat
  g.add(rod(new THREE.Vector3(0.8, 1.02, 0), new THREE.Vector3(0.7, 1.18, 0), 0.025, M.black));
  g.add(rod(new THREE.Vector3(0.7, 1.18, -0.28), new THREE.Vector3(0.7, 1.18, 0.28), 0.022, M.black));
  const dseat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.4), M.black); dseat.position.set(0.25, 0.86, 0); g.add(dseat);
  // lights
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), M.lamp); lamp.position.set(1.34, 0.82, 0); g.add(lamp);
  for (const z of [W / 2 - 0.08, -W / 2 + 0.08]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.12), M.tail); t.position.set(-1.29, 0.62, z); g.add(t); }
  // front fender
  const fender = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.05, 8, 20, Math.PI), M.navy); fender.position.set(1.02, 0.27, 0); g.add(fender);
  // wheels
  const wheels = [];
  const fw = wheel(0.26, 0.11); fw.position.set(1.02, 0.26, 0); g.add(fw); wheels.push(fw);
  for (const z of [W / 2 + 0.08, -W / 2 - 0.08]) { const w = wheel(0.26, 0.12); w.position.set(-0.82, 0.26, z); g.add(w); wheels.push(w); }
  g.add(shadowBlob(3.4, 1.9));
  return { group: g, wheels, radius: 0.26, length: 2.7, height: 1.8 };
}

/* ---------------------- Bicycle + pedalling rider ---------------------- */
function buildBike() {
  const g = new THREE.Group();
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  // faces -X (rides left)
  const R = 0.36, rear = V(0.58, R), front = V(-0.6, R), bb = V(0.04, 0.34), seatTop = V(0.2, 0.98), headTop = V(-0.44, 0.98), headBot = V(-0.48, 0.78);
  const tubes = [[bb, seatTop], [seatTop, headTop], [bb, headBot], [headBot, headTop]];
  tubes.forEach(([a, b]) => g.add(rod(a, b, 0.03, M.navy)));
  for (const z of [0.06, -0.06]) {
    g.add(rod(V(bb.x, bb.y, z), V(rear.x, rear.y, z), 0.018, M.navy));
    g.add(rod(V(seatTop.x - 0.02, seatTop.y - 0.04, z), V(rear.x, rear.y, z), 0.016, M.navy));
    g.add(rod(V(headBot.x, headBot.y, z * 0.8), V(front.x, front.y, z), 0.018, M.navy));
  }
  const wheels = [];
  const wr = wheel(R, 0.05, 10, M.green); wr.position.copy(rear); g.add(wr); wheels.push(wr);
  const wf = wheel(R, 0.05, 10, M.red); wf.position.copy(front); g.add(wf); wheels.push(wf);
  // saddle, handlebar, rack + delivery box
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.12), M.black); saddle.position.set(0.22, 1.03, 0); g.add(saddle);
  g.add(rod(headTop, V(-0.4, 1.12), 0.022, M.black));
  g.add(rod(V(-0.4, 1.12, -0.24), V(-0.4, 1.12, 0.24), 0.02, M.black));
  g.add(rod(V(0.32, 0.92), V(0.66, 0.92), 0.015, M.chrome));
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), M.green); box.position.set(0.6, 1.13, 0); g.add(box);
  const boxBand = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.06, 0.43), M.white); boxBand.position.set(0.6, 1.13, 0); g.add(boxBand);
  // crank + pedals (animated)
  const crank = new THREE.Group(); crank.position.copy(bb); g.add(crank);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 24), M.chrome); crank.add(ring);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.02), M.chrome); armL.position.set(0, -0.085, 0.07); crank.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.02), M.chrome); armR.position.set(0, 0.085, -0.07); crank.add(armR);
  // rider
  const hip = V(0.18, 1.1), shoulder = V(-0.12, 1.5), hand = V(-0.4, 1.13);
  const torso = rod(hip, shoulder, 0.13, M.green); g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), M.black); head.position.set(-0.2, 1.7, 0); g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.red); helmet.position.set(-0.19, 1.72, 0); helmet.rotation.z = 0.25; g.add(helmet);
  for (const z of [0.15, -0.15]) {
    const elbow = V(-0.3, 1.3, z * 1.1);
    g.add(rod(V(shoulder.x, shoulder.y - 0.02, z), elbow, 0.045, M.green));
    g.add(rod(elbow, V(hand.x, hand.y, z * 1.4), 0.04, M.black));
  }
  const legs = [0.11, -0.11].map((z, i) => {
    // white trousers so the pedalling reads against dark backgrounds
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 10), M.white);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 1, 10), M.white);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), M.red);
    g.add(thigh, shin, shoe);
    return { z, phase: i * Math.PI, thigh, shin, shoe };
  });
  const L1 = 0.47, L2 = 0.47, crankLen = 0.17;
  function pose(angle) {
    crank.rotation.z = angle; // same rotation sense as the wheels, so the rider pedals forward
    legs.forEach((leg) => {
      const a = angle + leg.phase - Math.PI / 2;
      const foot = V(bb.x + Math.cos(a) * crankLen, bb.y + Math.sin(a) * crankLen, leg.z);
      const h = V(hip.x, hip.y, leg.z);
      const d = Math.min(foot.distanceTo(h), L1 + L2 - 0.001);
      const dir = new THREE.Vector2(foot.x - h.x, foot.y - h.y).normalize();
      const ang = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
      // knee bends forward (toward -X, the riding direction)
      const k1 = dir.clone().rotateAround(new THREE.Vector2(), ang), k2 = dir.clone().rotateAround(new THREE.Vector2(), -ang);
      const kd = k1.x < k2.x ? k1 : k2;
      const knee = V(h.x + kd.x * L1, h.y + kd.y * L1, leg.z);
      placeRod(leg.thigh, h, knee); placeRod(leg.shin, knee, foot);
      leg.shoe.position.set(foot.x - 0.03, foot.y - 0.02, leg.z);
    });
  }
  pose(0);
  g.add(shadowBlob(2.0, 0.9));
  return { group: g, wheels, radius: R, length: 1.6, height: 1.85, pose };
}

/* ------------------------------ Stages ------------------------------ */
const stages = new Set();

class Stage {
  constructor(canvas) {
    this.canvas = canvas; this.kind = canvas.dataset['3d']; this.dir = canvas.dataset.dir === 'left' ? -1 : 1;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 2, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(WHITE, NAVY, 1.15));
    const key = new THREE.DirectionalLight(WHITE, 2.2); key.position.set(3, 6, 6); this.scene.add(key);
    const rim = new THREE.DirectionalLight(WHITE, 1.6); rim.position.set(-4, 3, -5); this.scene.add(rim); // edge light so deep blue reads on black
    this.v = this.kind === 'bike' ? buildBike() : buildKeke();
    this.v.group.rotation.y = this.kind === 'bike' ? 0.32 : -0.32; // 3/4 view toward the camera
    this.scene.add(this.v.group);
    this.x = null; this.targetX = 0; this.dist = 0; this.visible = false; this.t0 = performance.now();
    this.io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { this.visible = true; this.kick(); } }, { rootMargin: '120px' });
    this.io.observe(canvas);
    this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 200;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // fit the vehicle to ~58% of the canvas height AND at most ~52% of its width (phones are narrow)
    const fov = THREE.MathUtils.degToRad(this.camera.fov), tanH = Math.tan(fov / 2);
    this.camDist = Math.max((this.v.height / 0.58) / (2 * tanH), (this.v.length / 0.52) / (2 * tanH * this.camera.aspect));
    this.camera.position.set(0, this.v.height * 0.55, this.camDist);
    this.camera.lookAt(0, this.v.height * 0.45, 0);
    this.camera.updateProjectionMatrix();
    this.halfW = Math.tan(fov / 2) * this.camDist * this.camera.aspect;
    this.update(true);
  }
  // scroll progress → x position
  // 0 = road has just come fully into view (or page top if it's visible on load),
  // 1 = road has scrolled off the top. Same on phones and desktops.
  progress() {
    const r = this.canvas.getBoundingClientRect(), vh = window.innerHeight, y = window.scrollY;
    const docTop = r.top + y;
    const start = Math.max(0, docTop + r.height - vh);
    const end = docTop + r.height;
    return Math.min(1, Math.max(0, (y - start) / Math.max(1, end - start)));
  }
  update(snap) {
    // own visibility check (doesn't rely on IntersectionObserver, which some embedded browsers don't fire)
    const rr = this.canvas.getBoundingClientRect();
    this.visible = rr.bottom > -120 && rr.top < window.innerHeight + 120 && rr.width > 0;
    const t = this.progress(), L = this.v.length;
    // start fully in view near the edge it drives away from
    const inset = Math.max(0, this.halfW - L * 0.6 - 0.15);
    const start = this.dir > 0 ? -Math.min(inset, this.halfW * 0.45) : Math.min(inset, this.halfW * 0.45);
    const end = this.dir > 0 ? this.halfW + L : -this.halfW - L;
    this.targetX = start + (end - start) * t;
    if (snap || this.x == null) this.x = this.targetX;
    this.kick();
  }
  kick() { if (!this.raf && this.visible) this.raf = requestAnimationFrame(() => this.frame()); }
  frame() {
    this.raf = null;
    if (!this.canvas.isConnected) return this.dispose();
    const prev = this.x;
    this.x += (this.targetX - this.x) * (reduceMotion ? 1 : 0.12);
    const dx = this.x - prev; this.dist += dx;
    const g = this.v.group;
    g.position.x = this.x;
    const spin = -this.dist / this.v.radius;
    this.v.wheels.forEach((w) => { w.rotation.z = spin; });
    if (this.v.pose) this.v.pose(spin * 0.55);
    // idle life: gentle suspension bob
    const tt = (performance.now() - this.t0) / 1000;
    g.position.y = reduceMotion ? 0 : Math.sin(tt * (this.kind === 'bike' ? 5 : 3.2)) * 0.012 + Math.min(0.03, Math.abs(dx) * 0.3) * Math.sin(tt * 18);
    this.renderer.render(this.scene, this.camera);
    if (this.visible && (!reduceMotion || Math.abs(this.targetX - this.x) > 0.001)) this.raf = requestAnimationFrame(() => this.frame());
  }
  dispose() {
    this.io.disconnect(); if (this.raf) cancelAnimationFrame(this.raf);
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.renderer.dispose(); stages.delete(this);
  }
}

function scan() {
  stages.forEach((s) => { if (!s.canvas.isConnected) s.dispose(); });
  document.querySelectorAll('canvas[data-3d]:not([data-mounted])').forEach((c) => {
    c.dataset.mounted = '1';
    try { stages.add(new Stage(c)); } catch (e) { console.warn('3D unavailable:', e); c.closest('.road') && c.closest('.road').classList.add('no-3d'); }
  });
}
let ticking = false;
window.addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; stages.forEach((s) => s.update()); }); }, { passive: true });
window.addEventListener('resize', () => stages.forEach((s) => s.resize()));
document.addEventListener('rc:rendered', scan);
window.RC3D = { scan, stages };
scan();
