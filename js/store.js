/* ------------------------------------------------------------------
 * Store — a local mock backend kept in localStorage.
 * Every tab of the app shares the same data and stays in sync through the
 * `storage` event. That lets you open a customer in one tab and a rider in
 * another and watch offers / live location move between them.
 * Swap this module for Firebase / Supabase in production (see README).
 * ------------------------------------------------------------------ */
(function () {
  const DB_KEY = 'rcgo.db.v1';
  const SESSION_KEY = 'rcgo.session.v1';
  const C = window.RC_CONFIG;
  const listeners = new Set();
  let db = null;

  const now = () => Date.now();
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 8) + now().toString(36).slice(-4);
  const jitter = (base, km) => {
    const d = km / 111;
    return { lat: base.lat + (Math.random() - 0.5) * 2 * d, lng: base.lng + (Math.random() - 0.5) * 2 * d };
  };
  const lm = (id) => C.LANDMARKS.find((l) => l.id === id);

  function seed() {
    const t = now();
    const users = [];
    const kekes = [
      ['Adebayo Ogunleye', 'Bajaj RE', 'Yellow/Green', 'MWE-482-KA', 4.8],
      ['Chinedu Okafor', 'TVS King', 'Yellow', 'OGD-118-RC', 4.6],
      ['Tunde Bakare', 'Bajaj RE', 'Yellow/Black', 'OBA-903-MW', 4.9],
      ['Ibrahim Musa', 'Piaggio Ape', 'Yellow', 'IFO-227-OG', 4.5],
    ];
    kekes.forEach(([name, model, colour, plate], i) => {
      users.push({
        id: 'bot_keke_' + i, role: 'keke', bot: true, name, phone: '0803' + (1000000 + i * 7311),
        createdAt: t, online: true, loc: jitter(C.CENTER, 1.2), upfront: i === 2,
        vehicle: { make: model.split(' ')[0], model, colour, plate },
        bank: { bankName: 'GTBank', accountNumber: '01234567' + (10 + i), accountName: name },
        kyc: { status: 'approved', submittedAt: t, reviewedAt: t, data: {}, docs: {} },
      });
    });
    const bikes = [
      ['Samuel Adeyemi', 'Bicycle w/ box', 'Blue', 4.7],
      ['Grace Eze', 'E-bike', 'Red', 4.9],
      ['Femi Lawal', 'Bicycle', 'Black', 4.4],
    ];
    bikes.forEach(([name, model, colour], i) => {
      users.push({
        id: 'bot_bike_' + i, role: 'bike', bot: true, name, phone: '0812' + (2000000 + i * 5113),
        createdAt: t, online: true, loc: jitter(C.CENTER, 1), upfront: false,
        vehicle: { make: model, model, colour, plate: '—' },
        bank: { bankName: 'Opay', accountNumber: '81234567' + (20 + i), accountName: name },
        kyc: { status: 'approved', submittedAt: t, reviewedAt: t, data: {}, docs: {} },
      });
    });
    // A pending applicant so the admin queue has something in it.
    users.push({
      id: 'demo_pending_rider', role: 'keke', bot: true, name: 'Kehinde Alabi', phone: '08025550199',
      createdAt: t - 3600e3, online: false, upfront: false,
      vehicle: { make: 'Bajaj', model: 'Bajaj RE', colour: 'Yellow', plate: 'MWE-771-LX' },
      bank: { bankName: 'Access Bank', accountNumber: '0698765432', accountName: 'Kehinde Alabi' },
      kyc: {
        status: 'pending', submittedAt: t - 3600e3,
        data: {
          fullName: 'Kehinde Alabi', dob: '1990-04-12', address: '14 Peace Avenue, Estate Phase 1, Redemption City',
          stateOrigin: 'Ogun', nin: '12345678901', licenceNo: 'LAG-DL-88213', licenceExpiry: '2028-06-30',
          lasdriNo: 'LASDRI-552190', make: 'Bajaj', model: 'Bajaj RE', year: '2021', colour: 'Yellow',
          plate: 'MWE-771-LX', chassis: 'MD2A21BX4MWC01234', guarantorName: 'Pastor Femi Alabi',
          guarantorPhone: '08033334444', guarantorAddress: 'Redemption City', guarantorRel: 'Uncle',
          bankName: 'Access Bank', accountNumber: '0698765432', accountName: 'Kehinde Alabi',
        },
        docs: {},
      },
    });

    const v = (id, name, type, desc, at, upfront) => ({
      id, ownerId: null, bot: true, name, type, desc, loc: jitter(lm(at), 0.15), landmark: lm(at).label,
      hours: '7:00am – 9:00pm', open: true, upfront, phone: '0809' + Math.floor(1000000 + Math.random() * 8999999),
      bank: { bankName: 'Zenith Bank', accountNumber: '10' + Math.floor(10000000 + Math.random() * 89999999), accountName: name },
      createdAt: t,
    });
    const vendors = [
      v('ven_mama', "Mama Tunde's Kitchen", 'restaurant', 'Home-style Nigerian meals — amala, jollof and soups.', 'market', false),
      v('ven_suya', 'Covenant Suya Spot', 'restaurant', 'Grilled suya, asun and chicken. Evenings are our speciality.', 'youth', false),
      v('ven_grace', 'Grace Mart Supermarket', 'supermarket', 'Groceries, provisions, toiletries and household items.', 'oldaud', true),
      v('ven_shiloh', 'Shiloh Gadgets', 'retail', 'Phone accessories, chargers, power banks and repairs.', 'chalets', false),
      v('ven_faith', 'Faith Fabrics & Tailoring', 'retail', 'Ankara, lace and aso-oke. Sewing and alterations.', 'emmanuel', true),
      v('ven_canaan', 'Canaan Pharmacy', 'supermarket', 'Licensed pharmacy: OTC medicines and wellness products.', 'clinic', false),
    ];
    const p = (vendorId, name, price, category, desc = '') => ({ id: uid('prd'), vendorId, name, price, category, desc, img: null, available: true });
    const products = [
      p('ven_mama', 'Jollof rice & chicken', 2500, 'Mains', 'Smoky party jollof with fried chicken and plantain.'),
      p('ven_mama', 'Amala, ewedu & gbegiri', 2000, 'Swallow', 'Comes with assorted meat.'),
      p('ven_mama', 'Pounded yam & egusi', 2800, 'Swallow', 'With goat meat.'),
      p('ven_mama', 'Moi moi (2 wraps)', 800, 'Sides'),
      p('ven_mama', 'Fried rice & turkey', 3200, 'Mains'),
      p('ven_mama', 'Zobo (50cl)', 500, 'Drinks'),
      p('ven_suya', 'Beef suya (₦1,500 pack)', 1500, 'Grill'),
      p('ven_suya', 'Chicken suya', 2500, 'Grill'),
      p('ven_suya', 'Asun (peppered goat)', 3000, 'Grill'),
      p('ven_suya', 'Small chops platter', 3500, 'Snacks', 'Puff-puff, samosa, spring rolls, gizdodo.'),
      p('ven_grace', 'Rice (5kg bag)', 9500, 'Provisions'),
      p('ven_grace', 'Garri – white (2kg)', 2200, 'Provisions'),
      p('ven_grace', 'Spaghetti 500g', 1100, 'Provisions'),
      p('ven_grace', 'Instant noodles (carton of 40)', 11500, 'Provisions'),
      p('ven_grace', 'Evaporated milk (tin)', 750, 'Dairy'),
      p('ven_grace', 'Vegetable oil (3L)', 6800, 'Provisions'),
      p('ven_grace', 'Bathing soap (pack of 3)', 1600, 'Toiletries'),
      p('ven_grace', 'Table water (pack of 12)', 1800, 'Drinks'),
      p('ven_shiloh', 'Fast charger (USB‑C)', 4500, 'Accessories'),
      p('ven_shiloh', 'Power bank 20,000mAh', 18000, 'Accessories'),
      p('ven_shiloh', 'Screen replacement (service)', 15000, 'Services', 'Price varies by phone model — final quote on inspection.'),
      p('ven_shiloh', 'Earphones', 3000, 'Accessories'),
      p('ven_faith', 'Ankara fabric (6 yards)', 12000, 'Fabrics'),
      p('ven_faith', 'Sewing – kaftan (service)', 15000, 'Services'),
      p('ven_faith', 'Alterations (per item)', 2000, 'Services'),
      p('ven_canaan', 'Paracetamol (pack)', 500, 'Medicines'),
      p('ven_canaan', 'Vitamin C 1000mg', 3500, 'Wellness'),
      p('ven_canaan', 'Hand sanitizer 500ml', 2500, 'Wellness'),
      p('ven_canaan', 'Blood pressure check (service)', 1000, 'Services'),
    ];

    const reviews = [];
    const names = ['Bisi', 'Emeka', 'Funmi', 'Ola', 'Ngozi', 'Kunle', 'Tola'];
    const texts = ['Very polite and on time.', 'Smooth ride, thank you!', 'Quick delivery.', 'Good service, will use again.', 'Fair price.', 'Food was hot and tasty.', 'Helpful and honest.'];
    users.filter((u) => u.bot && u.kyc.status === 'approved').forEach((u, i) => {
      for (let k = 0; k < 3 + (i % 3); k++) reviews.push({ id: uid('rev'), targetType: 'user', targetId: u.id, customerName: names[(i + k) % 7], stars: k === 1 && i % 2 ? 4 : 5, text: texts[(i + k) % 7], at: t - k * 86400e3 });
    });
    vendors.forEach((vd, i) => {
      for (let k = 0; k < 2 + (i % 3); k++) reviews.push({ id: uid('rev'), targetType: 'vendor', targetId: vd.id, customerName: names[(i + k + 2) % 7], stars: k === 2 ? 4 : 5, text: texts[(i + k + 3) % 7], at: t - k * 86400e3 });
    });

    return { version: 1, users, vendors, products, requests: [], orders: [], reviews, createdAt: t };
  }

  // Live mode: js/backend.js fills `db` from Supabase; nothing is seeded or saved locally.
  const LIVE = !!(C.SUPABASE_URL && C.SUPABASE_KEY && !C.DEMO_MODE && window.supabase);
  let liveSession = null;
  const EMPTY = () => ({ version: 1, live: true, users: [], vendors: [], products: [], requests: [], orders: [], reviews: [] });

  function load() {
    if (LIVE) { if (!db) db = EMPTY(); return db; }
    try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { db = null; }
    if (!db || db.version !== 1) { db = seed(); persist(); }
    return db;
  }
  function persist() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch (e) { console.warn('Storage full or unavailable', e); window.dispatchEvent(new CustomEvent('rc:storage-error')); }
  }
  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

  window.addEventListener('storage', (e) => {
    if (!LIVE && e.key === DB_KEY) { load(); emit(); }
  });

  const Store = {
    uid, now, LIVE,
    get db() { return db || load(); },
    load,
    update(fn) {
      if (LIVE) throw new Error('Store.update is local-only; use RC.api in live mode');
      load(); const r = fn(db); persist(); emit(); return r;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    reset() { if (LIVE) return; db = seed(); persist(); emit(); },
    setDb(next) { db = next; emit(); },
    setLiveSession(s) { liveSession = s; },

    // Session lives per tab (sessionStorage) so one browser can run a customer tab and a rider tab side by side.
    // localStorage keeps the last sign-in so a brand-new tab can resume it.
    session() {
      if (LIVE) return liveSession;
      try {
        const s = sessionStorage.getItem(SESSION_KEY);
        if (s) return JSON.parse(s);
        const last = localStorage.getItem(SESSION_KEY);
        if (last) { sessionStorage.setItem(SESSION_KEY, last); return JSON.parse(last); }
      } catch (e) { /* ignore */ }
      return null;
    },
    setSession(s) {
      if (LIVE) return; // Supabase Auth owns the session in live mode
      try {
        if (s) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
        else { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); }
      } catch (e) { /* ignore */ }
    },

    user(id) { return this.db.users.find((u) => u.id === id); },
    vendor(id) { return this.db.vendors.find((v) => v.id === id); },
    request(id) { return this.db.requests.find((r) => r.id === id); },
    order(id) { return this.db.orders.find((o) => o.id === id); },

    rating(targetType, targetId) {
      const list = this.db.reviews.filter((r) => r.targetType === targetType && r.targetId === targetId);
      if (!list.length) return { avg: 0, count: 0, list };
      return { avg: list.reduce((s, r) => s + r.stars, 0) / list.length, count: list.length, list: list.sort((a, b) => b.at - a.at) };
    },
  };
  window.Store = Store;
  load();
})();
