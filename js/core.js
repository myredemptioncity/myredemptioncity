/* ------------------------------------------------------------------
 * Core: helpers, router, app shell, event delegation, demo simulation.
 * Role modules (customer.js, rider.js, vendor.js, admin.js) register
 * views into RC.views and handlers into RC.actions / RC.forms / RC.changes.
 * ------------------------------------------------------------------ */
(function () {
  const C = window.RC_CONFIG, S = window.Store, M = window.RCMap;

  /* ---------------- helpers ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const naira = (n) => '₦' + Math.round(n || 0).toLocaleString('en-NG');
  const icon = (n, cls = '') => `<i data-lucide="${n}" class="ic ${cls}" aria-hidden="true"></i>`;
  const vehicleSvg = (kind, size = 24, color = 'currentColor') => M.SVG[kind === 'keke' ? 'keke' : 'bike'](color).replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const round50 = (n) => Math.round(n / 50) * 50;
  const fare = (vehicle, km) => { const f = C.FARES[vehicle]; return Math.max(f.min, round50(f.base + f.perKm * km)); };
  const ago = (ts) => {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  };
  const fmtTime = (ts) => new Date(ts).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const stars = (type, id) => {
    const r = S.rating(type, id);
    if (!r.count) return `<span class="stars muted small">New</span>`;
    return `<span class="stars" aria-label="Rated ${r.avg.toFixed(1)} out of 5 from ${r.count} reviews">${icon('star')}<span>${r.avg.toFixed(1)}</span><span class="muted" style="font-weight:500">(${r.count})</span></span>`;
  };
  const me = () => { const s = S.session(); return s ? S.user(s.userId) : null; };
  const isRider = (u) => u && (u.role === 'keke' || u.role === 'bike');
  const roleLabel = { customer: 'Customer', keke: 'Keke rider', bike: 'Dispatch rider', vendor: 'Vendor', admin: 'Admin' };
  const vendorTypeLabel = { restaurant: 'Restaurant', supermarket: 'Supermarket', retail: 'Retail & services' };
  const vendorIcon = { restaurant: 'utensils', supermarket: 'shopping-basket', retail: 'store' };
  const ACTIVE = ['searching', 'accepted', 'arrived', 'in_progress'];

  /* ---------------- toast / modal ---------------- */
  function toast(msg, kind = 'ok') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = icon(kind === 'bad' ? 'alert-circle' : kind === 'info' ? 'info' : 'check-circle-2') + `<span>${esc(msg)}</span>`;
    box.appendChild(el); refreshIcons();
    setTimeout(() => el.remove(), 4000);
  }
  let lastFocus = null;
  function modal(html, { label = 'Dialog' } = {}) {
    closeModal();
    lastFocus = document.activeElement;
    const back = document.createElement('div');
    back.className = 'modal-back'; back.id = 'modal';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
    back.addEventListener('click', (e) => { if (e.target === back) closeModal(); });
    document.body.appendChild(back); refreshIcons();
    const f = back.querySelector('input, textarea, select, button:not([data-act="close-modal"]), [href]') || back.querySelector('button');
    f && f.focus();
  }
  function closeModal() {
    const m = $('#modal'); if (!m) return;
    m.remove(); lastFocus && lastFocus.focus && lastFocus.focus();
    document.dispatchEvent(new Event('rc:modal-closed')); // e.g. lets the camera turn off
    setTimeout(() => RC.refresh && RC.refresh(), 0); // apply any update that was held while typing in the dialog
  }
  function confirmDialog(title, body, okLabel = 'Confirm', danger = false) {
    return new Promise((resolve) => {
      modal(`<div class="stack"><h3>${esc(title)}</h3><p class="muted">${esc(body)}</p>
        <div class="row" style="justify-content:flex-end"><button class="btn btn-outline" data-act="modal-no">Cancel</button>
        <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-act="modal-yes">${esc(okLabel)}</button></div></div>`, { label: title });
      RC._confirm = resolve;
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#modal')) { closeModal(); RC._confirm && (RC._confirm(false), (RC._confirm = null)); }
    if (e.key === 'Tab' && $('#modal')) {
      const f = $$('#modal button, #modal input, #modal select, #modal textarea, #modal [href]').filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  function refreshIcons() { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } }); }
  async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copied ' + t); } catch (e) { toast('Copy failed — select and copy manually', 'bad'); } }

  /* ---------------- files ---------------- */
  function readFileCompressed(file, maxDim = 520) {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      if (!file.type.startsWith('image/')) return resolve({ name: file.name, type: file.type, preview: null, size: file.size });
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, maxDim / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve({ name: file.name, type: file.type, preview: cv.toDataURL('image/jpeg', 0.7), size: file.size });
        };
        img.onerror = () => resolve({ name: file.name, type: file.type, preview: null, size: file.size });
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ---------------- location ---------------- */
  const UI = { myLoc: null };
  function getMyLocation(force) {
    if (UI.myLoc && !force) return Promise.resolve(UI.myLoc);
    const fallback = () => { const g = C.LANDMARKS[0]; UI.myLoc = { lat: g.lat, lng: g.lng, label: g.label, simulated: true }; return UI.myLoc; };
    if (!navigator.geolocation) return Promise.resolve(fallback());
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!M.inServiceArea(p)) { const f = fallback(); f.outside = true; return resolve(f); }
          const label = await M.reverse(p);
          UI.myLoc = { ...p, label: 'My location · ' + label, simulated: false };
          resolve(UI.myLoc);
        },
        () => resolve(fallback()),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  /* ---------------- trip simulation helpers ---------------- */
  const legMs = (mins) => Math.max(12000, (mins * 60000) / C.DEMO_SPEED);
  function riderPosition(req) {
    const rider = S.user(req.riderId);
    if (!rider) return null;
    if (!rider.bot) return rider.loc || req.pickup;
    const t = Date.now();
    if (req.status === 'accepted' && req.approach) return M.along(req.approach.path, (t - req.acceptedAt) / legMs(req.approach.mins));
    if (req.status === 'arrived') return req.pickup;
    if (req.status === 'in_progress') return M.along(req.path, (t - req.startedAt) / legMs(req.mins));
    if (req.status === 'completed') return req.dropoff;
    return rider.loc;
  }
  function etaMins(req) {
    const pos = riderPosition(req); if (!pos) return null;
    const target = req.status === 'in_progress' ? req.dropoff : req.pickup;
    if (req.status === 'arrived') return 0;
    const km = M.haversineKm(pos, target) * C.ROAD_FACTOR;
    return Math.max(1, Math.ceil((km / C.SPEED_KMH[req.vehicle]) * 60));
  }

  async function routeFor(a, b, vehicle) {
    const r = await M.route(a, b);
    const mins = r.source === 'google' && vehicle === 'keke' ? r.mins : (r.distKm / C.SPEED_KMH[vehicle]) * 60;
    return { path: r.path, distKm: r.distKm, mins, source: r.source };
  }

  function planBotBids(req) {
    const busy = new Set(S.db.requests.filter((r) => ['accepted', 'arrived', 'in_progress'].includes(r.status)).map((r) => r.riderId));
    const bots = S.db.users.filter((u) => u.bot && u.role === req.vehicle && u.online && u.kyc && u.kyc.status === 'approved' && !busy.has(u.id));
    bots.sort(() => Math.random() - 0.5);
    return bots.slice(0, 4).map((b, i) => {
      const counter = Math.random() < 0.55;
      return { riderId: b.id, at: req.createdAt + 2500 + i * 2600 + Math.random() * 2000, counter, bump: round50(100 + Math.random() * 300) };
    });
  }

  const createRequest = (o) => RC.api.createRequest(o);

  async function acceptBid(reqId, riderId) {
    const req = S.request(reqId); if (!req || req.status !== 'searching') return;
    const rider = S.user(riderId);
    const approach = await routeFor((rider && rider.loc) || req.pickup, req.pickup, req.vehicle);
    await RC.api.acceptBid(reqId, riderId, approach);
  }

  function botTick() {
    if (S.LIVE) return; // sample riders/shops only exist in preview mode
    const u = me(); if (!u || u.role !== 'customer') return;
    const t = Date.now();
    const db = S.db;
    const mine = db.requests.filter((r) => r.customerId === u.id && ACTIVE.includes(r.status));
    const myOrders = db.orders.filter((o) => o.customerId === u.id && ['placed', 'preparing'].includes(o.status));
    const ops = [];
    mine.forEach((r) => {
      if (r.status === 'searching') {
        (r.botPlan || []).forEach((p) => {
          if (p.done || p.at > t) return;
          ops.push((db) => {
            const x = db.requests.find((y) => y.id === r.id); if (!x || x.status !== 'searching') return;
            const pp = x.botPlan.find((q) => q.riderId === p.riderId); if (pp.done) return; pp.done = true;
            const rider = db.users.find((q) => q.id === p.riderId);
            if (!rider || x.bids.some((b) => b.riderId === p.riderId)) return;
            const price = p.counter ? Math.max(x.offer + 50, round50(x.suggested + p.bump - 100)) : x.offer;
            x.bids.push({ riderId: p.riderId, price, type: price > x.offer ? 'counter' : 'accept', at: Date.now(), status: 'open' });
          });
        });
        return;
      }
      const rider = S.user(r.riderId); if (!rider || !rider.bot) return;
      if (r.transfer && r.transfer.sent && !r.transfer.confirmed && t - r.transfer.sentAt > 3500) ops.push((db) => { const x = db.requests.find((y) => y.id === r.id); x.transfer.confirmed = true; });
      if (r.status === 'accepted' && t - r.acceptedAt >= legMs(r.approach.mins)) ops.push((db) => { const x = db.requests.find((y) => y.id === r.id); if (x.status === 'accepted') { x.status = 'arrived'; x.arrivedAt = Date.now(); } });
      if (r.status === 'arrived' && t - r.arrivedAt > 6000) {
        const ord = r.orderId && S.order(r.orderId);
        if (!ord || ord.status === 'ready') ops.push((db) => {
          const x = db.requests.find((y) => y.id === r.id); if (x.status !== 'arrived') return;
          x.status = 'in_progress'; x.startedAt = Date.now();
          if (x.orderId) { const o = db.orders.find((q) => q.id === x.orderId); if (o) o.status = 'picked_up'; }
        });
      }
      if (r.status === 'in_progress' && t - r.startedAt >= legMs(r.mins)) ops.push((db) => {
        const x = db.requests.find((y) => y.id === r.id); if (x.status !== 'in_progress') return;
        x.status = 'completed'; x.completedAt = Date.now();
        if (x.orderId) { const o = db.orders.find((q) => q.id === x.orderId); if (o) o.status = 'delivered'; }
        db.users.find((q) => q.id === x.riderId).loc = x.dropoff;
      });
    });
    myOrders.forEach((o) => {
      const v = S.vendor(o.vendorId); if (!v || !v.bot) return;
      if (o.status === 'placed' && t - o.createdAt > 4000) ops.push((db) => { const x = db.orders.find((y) => y.id === o.id); if (x.status === 'placed') { x.status = 'preparing'; x.acceptedAt = Date.now(); } });
      if (o.status === 'preparing' && t - (o.acceptedAt || o.createdAt) > 12000) ops.push((db) => { const x = db.orders.find((y) => y.id === o.id); if (x.status === 'preparing') x.status = 'ready'; });
      if (o.transfer && o.transfer.sent && !o.transfer.confirmed && t - o.transfer.sentAt > 3500) ops.push((db) => { const x = db.orders.find((y) => y.id === o.id); x.transfer.confirmed = true; });
    });
    if (ops.length) S.update((db) => ops.forEach((fn) => fn(db)));
  }

  /* ---------------- router & shell ---------------- */
  const RC = {
    C, S, M, UI, $, $$, esc, naira, icon, vehicleSvg, initials, round50, fare, ago, fmtTime, stars, me, isRider, roleLabel,
    vendorTypeLabel, vendorIcon, ACTIVE, toast, modal, closeModal, confirmDialog, refreshIcons, copyText, readFileCompressed,
    getMyLocation, riderPosition, etaMins, routeFor, createRequest, acceptBid, legMs, planBotBids,
    api: window.RCApi, live: S.LIVE,
    // Run a write, show a friendly error if it fails. Returns true on success.
    async run(promise, okMsg) {
      try { await promise; if (okMsg) toast(okMsg); return true; }
      catch (e) { console.error(e); toast(e.message || 'Something went wrong. Check your connection and try again.', 'bad'); return false; }
    },
    views: {}, actions: {}, forms: {}, changes: {}, inputs: {},
    go(path) { if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; },
  };
  window.RC = RC;

  const NAV = {
    customer: [['c/home', 'Home', 'map'], ['c/shop', 'Shop', 'shopping-bag'], ['c/activity', 'Activity', 'receipt-text'], ['c/account', 'Account', 'user-round']],
    keke: [['r/drive', 'Drive', 'navigation'], ['r/jobs', 'Jobs & earnings', 'wallet'], ['r/account', 'Account', 'user-round']],
    vendor: [['v/orders', 'Orders', 'inbox'], ['v/catalogue', 'Catalogue', 'package'], ['v/account', 'Store', 'store']],
    admin: [['a/approvals', 'Approvals', 'shield-check'], ['a/blog', 'Updates', 'megaphone'], ['a/map', 'Live map', 'map'], ['a/directory', 'Directory', 'users']],
  };
  NAV.bike = NAV.keke;

  function badgeFor(path, u) {
    const db = S.db;
    if (path === 'a/approvals') return db.users.filter((x) => x.kyc && x.kyc.status === 'pending').length;
    if (path === 'v/orders' && u.vendorId) return db.orders.filter((o) => o.vendorId === u.vendorId && o.status === 'placed').length;
    if (path === 'c/activity') return db.requests.filter((r) => r.customerId === u.id && ACTIVE.includes(r.status)).length;
    if (path === 'r/drive' && isRider(u)) return db.requests.filter((r) => r.riderId === u.id && ['accepted', 'arrived', 'in_progress'].includes(r.status)).length;
    return 0;
  }

  function resolve() {
    const hash = location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean);
    for (const [name, v] of Object.entries(RC.views)) {
      const pat = (v.path || name).split('/').filter(Boolean);
      if (pat.length !== parts.length) continue;
      const params = {}; let ok = true;
      pat.forEach((seg, i) => { if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]); else if (seg !== parts[i]) ok = false; });
      if (ok) return { name, view: v, params };
    }
    return { name: 'landing', view: RC.views.landing, params: {} };
  }

  let current = null;
  let pending = false;

  function shell(view, path, u) {
    const nav = u && view.nav !== false ? NAV[u.role] || [] : [];
    const active = view.navKey || path;
    const navItems = (cls) => nav.map(([p, label, ic]) => {
      const n = badgeFor(p, u);
      return `<a class="${cls}" href="#/${p}" ${active.startsWith(p) ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span>${n ? `<span class="nav-badge" aria-label="${n} pending">${n}</span>` : ''}</a>`;
    }).join('');
    return `<div class="app ${nav.length ? '' : 'no-nav'}" data-role="${u ? u.role : ''}">
      ${nav.length ? `<nav class="rail" aria-label="Main">
        <a class="brand" href="#/${nav[0][0]}"><span class="emblem" style="background:#FFFFFF url('assets/rccg-emblem.png') center/cover"></span><span><b>${esc(C.APP_NAME)}</b><small>Redemption City</small></span></a>
        <img class="vision-badge" src="assets/vision-2032.png" alt="RCCG Explosive Growth Drive, Vision 2032" width="380" height="86">
        ${navItems('nav')}
        <div class="rail-foot"><div class="rail-user"><b>${esc(u.name)}</b><div class="muted xs">${roleLabel[u.role]}</div></div>
        <button class="btn btn-ghost btn-sm" data-act="toggle-theme">${icon('sun-moon')} Theme</button>
        <button class="btn btn-ghost btn-sm" data-act="logout">${icon('log-out')} Sign out</button></div>
      </nav>` : ''}
      ${C.DEMO_MODE ? `<a class="preview-flag" href="#/" title="Bookings are not sent to real riders yet">Preview · not live</a>` : ''}
      <main class="main" id="main" tabindex="-1"></main>
      ${nav.length ? `<nav class="tabbar" aria-label="Main">${navItems('')}</nav>` : ''}
    </div>`;
  }

  function guard(view) {
    const u = me();
    if (!view.roles) return null;
    if (!u || !view.roles.includes(u.role)) return '';
    if (isRider(u) && view.requiresApproval && (!u.kyc || u.kyc.status !== 'approved')) return 'r/onboard';
    if (u.role === 'vendor' && view.requiresStore && !u.vendorId) return 'v/onboard';
    return null;
  }

  function render() {
    const { view, params, name } = resolve();
    const redirect = guard(view);
    if (redirect !== null) { location.replace('#/' + redirect); return; }
    if (current && current.view.unmount) current.view.unmount();
    const u = me();
    const path = location.hash.replace(/^#\/?/, '');
    $('#app').innerHTML = shell(view, path, u);
    const main = $('#main');
    main.innerHTML = view.map ? mapLayout(view, params) : view.render(params);
    current = { view, params, name };
    document.title = (view.title ? (typeof view.title === 'function' ? view.title(params) : view.title) + ' · ' : '') + C.APP_NAME;
    refreshIcons();
    if (view.mount) view.mount(params);
    const h = main.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
    document.dispatchEvent(new Event('rc:rendered')); // lets the 3D module mount new canvases
  }

  function mapLayout(view, params) {
    return `<div class="mapview"><div id="map" class="map" role="application" aria-label="Map of Redemption City"></div>
      ${view.mapTop ? `<div class="map-top">${view.mapTop(params)}</div>` : ''}
      <section class="sheet ${view.tall ? 'tall' : ''}" id="sheet" aria-live="polite">${view.sheet(params)}</section></div>`;
  }

  function isEditing() {
    const a = document.activeElement;
    return a && a.closest && a.closest('#main, #modal') && (a.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select'));
  }

  function refresh() {
    if (!current) return;
    if (isEditing()) { pending = true; return; }
    pending = false;
    const { view, params } = current;
    const redirect = guard(view);
    if (redirect !== null) { location.replace('#/' + redirect); return; }
    const u = me();
    // Update nav badges
    $$('.tabbar a, .rail a.nav').forEach((a) => {
      const p = a.getAttribute('href').slice(2); const n = u ? badgeFor(p, u) : 0;
      let b = a.querySelector('.nav-badge');
      if (n && !b) { b = document.createElement('span'); b.className = 'nav-badge'; a.appendChild(b); }
      if (b) { if (n) { b.textContent = n; b.setAttribute('aria-label', n + ' pending'); } else b.remove(); }
    });
    if (view.map) {
      const sh = $('#sheet'); if (!sh) return;
      const st = sh.scrollTop;
      sh.innerHTML = view.sheet(params);
      sh.scrollTop = st;
      const top = $('.map-top'); if (top && view.mapTop) top.innerHTML = view.mapTop(params);
      refreshIcons();
      view.sync && view.sync(params);
    } else if (view.update) {
      view.update(params); // views that patch only their live parts (e.g. landing feed) so 3D scenes keep running
    } else if (view.live) {
      const st = window.scrollY;
      $('#main').innerHTML = view.render(params);
      refreshIcons(); view.afterRender && view.afterRender(params);
      window.scrollTo(0, st);
    }
    document.dispatchEvent(new Event('rc:rendered'));
  }
  RC.refresh = refresh;
  RC.render = render;

  document.addEventListener('focusout', () => setTimeout(() => { if (pending && !isEditing()) refresh(); }, 50));

  /* ---------------- event delegation ---------------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = RC.actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const fn = RC.forms[f.dataset.form]; if (fn) fn(f, new FormData(f));
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]'); if (!el) return;
    const fn = RC.changes[el.dataset.change]; if (fn) fn(el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]'); if (!el) return;
    const fn = RC.inputs[el.dataset.input]; if (fn) fn(el, e);
  });

  Object.assign(RC.actions, {
    'close-modal': () => closeModal(),
    'modal-yes': () => { const r = RC._confirm; RC._confirm = null; closeModal(); r && r(true); },
    'modal-no': () => { const r = RC._confirm; RC._confirm = null; closeModal(); r && r(false); },
    logout: async () => { await RC.api.signOut(); toast('Signed out', 'info'); RC.go(''); },
    'toggle-theme': () => {
      const cur = document.documentElement.dataset.theme || 'dark'; // dark is the default look
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('rcgo.theme', next); } catch (e) { /* ignore */ }
    },
    copy: (el) => copyText(el.dataset.value),
    'view-doc': (el) => {
      modal(`<div class="stack"><div class="row-between"><h3>${esc(el.dataset.title)}</h3><button class="btn btn-icon btn-ghost" data-act="close-modal" aria-label="Close">${icon('x')}</button></div>
        ${el.dataset.src ? `<img src="${el.dataset.src}" alt="${esc(el.dataset.title)}" style="border-radius:12px;width:100%">` : `<div class="empty">${icon('file-text')}<p>${esc(el.dataset.name || 'File')} — preview not available in the demo (non-image file).</p></div>`}</div>`, { label: el.dataset.title });
    },
  });

  try { const th = localStorage.getItem('rcgo.theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { /* ignore */ }

  window.addEventListener('rc:storage-error', () => toast('Device storage is full — try smaller photos or reset demo data.', 'bad'));
  window.addEventListener('hashchange', render);
  S.subscribe(() => refresh());

  setInterval(() => {
    try { botTick(); } catch (e) { console.error(e); }
    if (current && current.view.tick) current.view.tick(current.params);
  }, 1000);

  window.addEventListener('DOMContentLoaded', () => {
    // Live mode: wait for the saved Supabase session + first data load before routing.
    $('#app').innerHTML = `<div class="empty" style="min-height:100dvh;justify-content:center"><span class="emblem" style="width:56px;height:56px;border-radius:50%;background:#fff url('assets/rccg-emblem.png') center/cover;box-shadow:var(--sh-1)"></span><p>Loading ${esc(C.APP_NAME)}…</p></div>`;
    Promise.resolve(window.RC_BOOT).finally(() => render());
  });
})();
