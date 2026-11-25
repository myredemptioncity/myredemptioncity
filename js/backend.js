/* ------------------------------------------------------------------
 * Live backend (Supabase). Active when RC_CONFIG.SUPABASE_URL/KEY are set
 * and DEMO_MODE is false.
 *  - Loads the rows the signed-in user may see (row-level security decides).
 *  - Keeps them current with Realtime and patches the in-memory cache, which
 *    the screens read through Store.db (same shape as the old local store).
 *  - Every write goes through RC.api.* → Supabase (inserts or secure RPCs).
 * ------------------------------------------------------------------ */
(function () {
  const C = window.RC_CONFIG;
  const LIVE = !!(C.SUPABASE_URL && C.SUPABASE_KEY && !C.DEMO_MODE && window.supabase);
  window.RC_LIVE = LIVE;
  if (!LIVE) return;

  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const S = window.Store;
  const raw = { profiles: [], apps: [], vendors: [], products: [], orders: [], requests: [], bids: [], reviews: [], posts: [] };
  const local = { kycEditing: false, signed: {} };
  let uid = null;

  const ms = (t) => (t ? Date.parse(t) : null);
  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

  /* ---------- row → app-shape mappers ---------- */
  function derive() {
    const vend = raw.vendors;
    const profilesById = byId(raw.profiles);
    const appsById = Object.fromEntries(raw.apps.map((a) => [a.user_id, a]));
    const users = raw.profiles.map((p) => {
      const a = appsById[p.id];
      const docs = {};
      if (a && a.docs) Object.entries(a.docs).forEach(([k, d]) => { docs[k] = { name: d.name, path: d.path, type: d.type, preview: local.signed[d.path] || null }; });
      return {
        id: p.id, role: p.role, name: p.full_name || 'New user', phone: p.phone ? p.phone.replace(/^\+?234/, '0') : '', createdAt: ms(p.created_at),
        online: p.online, loc: p.lat != null ? { lat: p.lat, lng: p.lng, at: ms(p.loc_at) } : null,
        vehicle: p.vehicle, upfront: p.upfront, suspended: p.suspended,
        bank: p.account_number ? { bankName: p.bank_name, accountNumber: p.account_number, accountName: p.account_name } : null,
        vendorId: (vend.find((v) => v.owner_id === p.id) || {}).id || null,
        kyc: { status: p.kyc_status, reason: p.kyc_reason, data: (a && a.data) || {}, docs, step: (a && a.step) || 0, submittedAt: a ? ms(a.submitted_at) : null, reviewedAt: a ? ms(a.reviewed_at) : null, editing: p.id === uid && local.kycEditing },
      };
    });
    const vendors = vend.map((v) => ({
      id: v.id, ownerId: v.owner_id, name: v.name, type: v.type, desc: v.description || '', phone: v.phone, loc: { lat: v.lat, lng: v.lng }, landmark: v.landmark,
      hours: v.hours, open: v.open, upfront: v.upfront, suspended: v.suspended, logo: v.logo_url, createdAt: ms(v.created_at),
      bank: v.account_number ? { bankName: v.bank_name, accountNumber: v.account_number, accountName: v.account_name } : null,
    }));
    const products = raw.products.map((p) => ({ id: p.id, vendorId: p.vendor_id, name: p.name, price: p.price, category: p.category, desc: p.description || '', img: p.image_url, available: p.available }));
    const bidsBy = {};
    raw.bids.forEach((b) => { (bidsBy[b.request_id] = bidsBy[b.request_id] || []).push({ riderId: b.rider_id, price: b.price, type: b.type, at: ms(b.created_at), status: b.status === 'withdrawn' ? 'declined' : b.status }); });
    const requests = raw.requests.map((r) => ({
      id: r.id, kind: r.kind, vehicle: r.vehicle, customerId: r.customer_id, pickup: r.pickup, dropoff: r.dropoff, path: r.path || [r.pickup, r.dropoff],
      distKm: Number(r.dist_km || 0), mins: Number(r.mins || 0), suggested: r.suggested, offer: r.offer, pay: r.pay, note: r.note, parcel: r.parcel,
      orderId: r.order_id, status: r.status, riderId: r.rider_id, price: r.price, approach: r.approach, rated: r.rated,
      bids: (bidsBy[r.id] || []).filter((b) => b.status !== 'withdrawn'),
      transfer: { sent: !!r.transfer_sent_at, sentAt: ms(r.transfer_sent_at), confirmed: !!r.transfer_confirmed_at },
      createdAt: ms(r.created_at), acceptedAt: ms(r.accepted_at), arrivedAt: ms(r.arrived_at), startedAt: ms(r.started_at), completedAt: ms(r.completed_at), cancelledAt: ms(r.cancelled_at),
    }));
    const orders = raw.orders.map((o) => {
      const c = profilesById[o.customer_id] || {};
      const req = raw.requests.find((r) => r.id === o.request_id);
      return {
        id: o.id, customerId: o.customer_id, customerName: c.full_name || 'Customer', customerPhone: (c.phone || '').replace(/^\+?234/, '0'), vendorId: o.vendor_id,
        items: (o.items || []).map((i) => ({ productId: i.product_id, name: i.name, price: i.price, qty: i.qty })), subtotal: o.subtotal, status: o.status, pay: o.pay,
        note: o.note, dropoff: o.dropoff, requestId: o.request_id, riderId: req ? req.rider_id : null, createdAt: ms(o.created_at), acceptedAt: ms(o.accepted_at),
        transfer: { sent: !!o.transfer_sent_at, sentAt: ms(o.transfer_sent_at), confirmed: !!o.transfer_confirmed_at },
      };
    });
    const reviews = raw.reviews.map((r) => ({ id: r.id, targetType: r.target_type === 'rider' ? 'user' : 'vendor', targetId: r.target_id, customerId: r.customer_id, customerName: ((profilesById[r.customer_id] || {}).full_name || 'Customer').split(' ')[0], stars: r.stars, text: r.text, at: ms(r.created_at), requestId: r.request_id }));
    const posts = raw.posts.map((p) => ({ id: p.id, kind: p.kind, title: p.title, body: p.body || '', imageUrl: p.image_url, pinned: p.pinned, published: p.published, startsAt: ms(p.starts_at), venue: p.venue || '', createdAt: ms(p.created_at) }));
    S.setDb({ version: 1, live: true, users, vendors, products, requests, orders, reviews, posts });
  }

  /* ---------- loading ---------- */
  const TABLES = {
    profiles: () => sb.from('profiles').select('*'),
    apps: () => sb.from('rider_applications').select('*'),
    vendors: () => sb.from('vendors').select('*'),
    products: () => sb.from('products').select('*'),
    orders: () => sb.from('orders').select('*').order('created_at', { ascending: false }).limit(300),
    requests: () => sb.from('requests').select('*').order('created_at', { ascending: false }).limit(300),
    bids: () => sb.from('bids').select('*').order('created_at', { ascending: false }).limit(1000),
    reviews: () => sb.from('reviews').select('*').order('created_at', { ascending: false }).limit(1000),
    posts: () => sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100),
  };
  async function load(names) {
    const list = names || Object.keys(TABLES);
    const wanted = uid ? list : list.filter((n) => ['vendors', 'products', 'reviews', 'posts'].includes(n));
    const res = await Promise.all(wanted.map((n) => TABLES[n]()));
    res.forEach((r, i) => { if (r.error) console.warn('Load ' + wanted[i], r.error.message); else raw[wanted[i]] = r.data; });
    if (wanted.includes('apps')) await signDocs();
    derive();
  }
  async function signDocs() {
    const paths = raw.apps.flatMap((a) => Object.values(a.docs || {}).filter((d) => d.path && (d.type || '').startsWith('image/') && !local.signed[d.path]).map((d) => d.path));
    if (!paths.length) return;
    const { data } = await sb.storage.from('kyc').createSignedUrls(paths, 3600);
    (data || []).forEach((d) => { if (d.signedUrl) local.signed[d.path] = d.signedUrl; });
  }

  const pending = new Set(); let tmr = null;
  function refresh(names) { names.forEach((n) => pending.add(n)); clearTimeout(tmr); tmr = setTimeout(() => { const n = [...pending]; pending.clear(); load(n); }, 150); }

  let channel = null;
  const TBL_TO_RAW = { profiles: 'profiles', rider_applications: 'apps', vendors: 'vendors', products: 'products', orders: 'orders', requests: 'requests', bids: 'bids', reviews: 'reviews', posts: 'posts' };
  function subscribe() {
    if (channel) sb.removeChannel(channel);
    channel = sb.channel('rcgo-live');
    Object.keys(TBL_TO_RAW).forEach((t) => channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, (p) => {
      const key = TBL_TO_RAW[t]; const pk = t === 'rider_applications' ? 'user_id' : 'id';
      if (p.eventType === 'DELETE') raw[key] = raw[key].filter((x) => x[pk] !== p.old[pk]);
      else { const i = raw[key].findIndex((x) => x[pk] === p.new[pk]); if (i >= 0) raw[key][i] = p.new; else raw[key].unshift(p.new); }
      if (key === 'apps') signDocs().then(derive); else derive();
      if (key === 'bids') refresh(['requests']); // a bid can make a request (in)visible
    }));
    channel.subscribe();
  }

  async function onAuth(session) {
    const newUid = session ? session.user.id : null;
    if (newUid === uid && raw.profiles.length) return;
    uid = newUid;
    S.setLiveSession(uid ? { userId: uid } : null);
    await load();
    subscribe(); // signed-out visitors still get live posts (row-level security limits what each person receives)
  }

  // Safety nets: refetch when the tab comes back and periodically (Realtime can miss rows that change visibility).
  document.addEventListener('visibilitychange', () => { if (!document.hidden && uid) load(); });
  setInterval(() => { if (uid && !document.hidden) load(['requests', 'bids', 'orders']); }, 20000);

  const init = (async () => {
    const { data } = await sb.auth.getSession();
    await onAuth(data.session);
    sb.auth.onAuthStateChange((_e, s) => { setTimeout(() => onAuth(s), 0); });
  })().catch((e) => { console.error('Backend init failed', e); });

  /* ---------- writes ---------- */
  const must = ({ data, error }) => { if (error) throw new Error(friendly(error.message)); return data; };
  function friendly(m) {
    if (/JWT|session/i.test(m)) return 'Your session expired. Please sign in again.';
    if (/row-level security|permission/i.test(m)) return 'You are not allowed to do that.';
    return m;
  }
  const e164 = (p) => '+234' + p.replace(/\D/g, '').replace(/^234/, '').replace(/^0/, '');
  const rpc = async (fn, args, tables) => { must(await sb.rpc(fn, args)); refresh(tables); };
  function dataUrlToBlob(d) { const [h, b] = d.split(','); const mime = h.match(/:(.*?);/)[1]; const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); }
  async function uploadPublic(dataUrl, folder) {
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    const path = `${uid}/${folder}/${Date.now()}.jpg`;
    must(await sb.storage.from('public').upload(path, dataUrlToBlob(dataUrl), { contentType: 'image/jpeg', upsert: true }));
    return sb.storage.from('public').getPublicUrl(path).data.publicUrl;
  }
  const bankCols = (b) => (b ? { bank_name: b.bankName, account_number: b.accountNumber, account_name: b.accountName } : {});

  const api = {
    client: sb,
    get uid() { return uid; },
    ready: init,
    // auth
    async sendCode(phone, role, name) { must(await sb.auth.signInWithOtp({ phone: e164(phone), options: { data: { role, full_name: name, phone: e164(phone) } } })); },
    async verifyCode(phone, code) { const d = must(await sb.auth.verifyOtp({ phone: e164(phone), token: code, type: 'sms' })); await onAuth(d.session); return S.user(uid); },
    async signOut() { await sb.auth.signOut(); await onAuth(null); },
    // profile
    async updateProfile(patch) { must(await sb.from('profiles').update(patch).eq('id', uid)); refresh(['profiles']); },
    async setOnline(on) { return api.updateProfile({ online: on }); },
    async writeLoc(p) { await sb.from('profiles').update({ lat: p.lat, lng: p.lng, loc_at: new Date().toISOString() }).eq('id', uid); },
    async saveBank(bank, upfront) { return api.updateProfile({ ...bankCols(bank), upfront }); },
    // requests & bids
    async createRequest(o) {
      const row = must(await sb.from('requests').insert({
        kind: o.kind, vehicle: o.vehicle, customer_id: uid, pickup: o.pickup, dropoff: o.dropoff, path: o.route.path, dist_km: o.route.distKm, mins: o.route.mins,
        suggested: o.suggested, offer: o.offer, pay: o.pay, note: o.note || '', parcel: o.parcel || null, order_id: o.orderId || null,
      }).select('id').single());
      await load(['requests']);
      return S.request(row.id);
    },
    raiseOffer: (id, d) => rpc('raise_offer', { p_request: id, p_amount: d }, ['requests']),
    declineBid: (id, rider) => rpc('decline_bid', { p_request: id, p_rider: rider }, ['bids']),
    acceptBid: (id, rider, approach) => rpc('accept_bid', { p_request: id, p_rider: rider, p_approach: approach }, ['requests', 'bids', 'orders']),
    cancelRequest: (id) => rpc('cancel_request', { p_request: id }, ['requests', 'bids', 'orders']),
    placeBid: (id, price) => rpc('place_bid', { p_request: id, p_price: price }, ['bids', 'requests']),
    withdrawBid: (id) => rpc('withdraw_bid', { p_request: id }, ['bids']),
    riderStep: (id, step) => rpc('rider_step', { p_request: id, p_step: step }, ['requests', 'orders']),
    markTransferSent: (kind, id) => rpc('mark_transfer_sent', { p_kind: kind === 'order' ? 'order' : 'request', p_id: id }, ['requests', 'orders']),
    confirmTransfer: (kind, id) => rpc('confirm_transfer', { p_kind: kind === 'order' ? 'order' : 'request', p_id: id }, ['requests', 'orders']),
    async rate(reqId, reviews) {
      if (reviews.length) must(await sb.from('reviews').insert(reviews.map((r) => ({ target_type: r.targetType === 'user' ? 'rider' : 'vendor', target_id: r.targetId, customer_id: uid, request_id: reqId, stars: r.stars, text: r.text || '' }))));
      await rpc('mark_rated', { p_request: reqId }, ['requests', 'reviews']);
    },
    // orders
    async placeOrder(vendorId, items, pay, note, dropoff) {
      const id = must(await sb.rpc('place_order', { p_vendor: vendorId, p_items: items.map((i) => ({ product_id: i.productId, qty: i.qty })), p_pay: pay, p_note: note || '', p_dropoff: dropoff }));
      await load(['orders']);
      return id;
    },
    linkOrderRequest: (orderId, reqId) => rpc('link_order_request', { p_order: orderId, p_request: reqId }, ['orders']),
    vendorOrderStatus: (id, s) => rpc('vendor_order_status', { p_order: id, p_status: s }, ['orders', 'requests']),
    // KYC
    // Server-side merge (save_application) so overlapping saves can't overwrite each other.
    async saveApplication(patch, step) {
      must(await sb.rpc('save_application', { p_patch: patch || null, p_step: step == null ? null : step }));
      const cur = raw.apps.find((a) => a.user_id === uid);
      if (cur) { if (patch) cur.data = { ...cur.data, ...patch }; if (step != null) cur.step = step; }
      derive();
    },
    async uploadDoc(key, file, compressed) {
      const isImg = compressed && compressed.preview;
      const blob = isImg ? dataUrlToBlob(compressed.preview) : file;
      const ext = isImg ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${uid}/${key}-${Date.now()}.${ext}`;
      must(await sb.storage.from('kyc').upload(path, blob, { contentType: isImg ? 'image/jpeg' : file.type, upsert: true }));
      if (isImg) local.signed[path] = compressed.preview;
      const doc = { name: file.name, path, type: isImg ? 'image/jpeg' : file.type };
      must(await sb.rpc('set_application_doc', { p_key: key, p_doc: doc }));
      const cur = raw.apps.find((a) => a.user_id === uid);
      if (cur) cur.docs = { ...(cur.docs || {}), [key]: doc };
      derive();
    },
    async submitApplication() { local.kycEditing = false; await rpc('submit_application', {}, ['profiles', 'apps']); },
    setKycEditing(v) { local.kycEditing = v; derive(); },
    reviewRider: (userId, decision, reason) => rpc('review_rider', { p_user: userId, p_decision: decision, p_reason: reason || null }, ['profiles', 'apps']),
    // vendors & products
    async createVendor(d) {
      const logo = await uploadPublic(d.logo, 'logo');
      must(await sb.from('vendors').insert({ owner_id: uid, name: d.name, type: d.type, description: d.desc, phone: d.phone, lat: d.loc.lat, lng: d.loc.lng, landmark: d.landmark, hours: d.hours, upfront: d.upfront, logo_url: logo || null, ...bankCols(d.bank) }));
      await load(['vendors', 'profiles']);
    },
    async updateVendor(id, d) {
      const row = {};
      if ('name' in d) Object.assign(row, { name: d.name, type: d.type, description: d.desc, phone: d.phone, lat: d.loc.lat, lng: d.loc.lng, landmark: d.landmark, hours: d.hours, upfront: d.upfront, ...bankCols(d.bank) });
      if (d.logo) row.logo_url = await uploadPublic(d.logo, 'logo');
      if ('open' in d) row.open = d.open;
      if ('suspended' in d) row.suspended = d.suspended;
      must(await sb.from('vendors').update(row).eq('id', id)); refresh(['vendors']);
    },
    async saveProduct(id, vendorId, d) {
      const row = { name: d.name, price: d.price, category: d.category, description: d.desc, available: d.available };
      if (d.img) row.image_url = await uploadPublic(d.img, 'products');
      if (id) must(await sb.from('products').update(row).eq('id', id)); else must(await sb.from('products').insert({ ...row, vendor_id: vendorId }));
      refresh(['products']);
    },
    async setProductAvailable(id, v) { must(await sb.from('products').update({ available: v }).eq('id', id)); refresh(['products']); },
    async deleteProduct(id) { must(await sb.from('products').delete().eq('id', id)); refresh(['products']); },
    // blog posts (admins only; enforced by row-level security)
    async createPost(d) {
      const image_url = d.img ? await uploadPublic(d.img, 'posts') : null;
      must(await sb.from('posts').insert({ title: d.title, body: d.body, kind: d.kind, starts_at: d.startsAt ? new Date(d.startsAt).toISOString() : null, venue: d.venue || null, pinned: d.pinned, published: d.published, image_url }));
      refresh(['posts']);
    },
    async updatePost(id, d) {
      const row = {};
      ['title', 'body', 'kind', 'venue', 'pinned', 'published'].forEach((k) => { if (k in d) row[k] = d[k]; });
      if ('startsAt' in d) row.starts_at = d.startsAt ? new Date(d.startsAt).toISOString() : null;
      if (d.img) row.image_url = await uploadPublic(d.img, 'posts');
      row.updated_at = new Date().toISOString();
      must(await sb.from('posts').update(row).eq('id', id)); refresh(['posts']);
    },
    async deletePost(id) { must(await sb.from('posts').delete().eq('id', id)); refresh(['posts']); },
    async docUrl(path) { const { data } = await sb.storage.from('kyc').createSignedUrl(path, 600); return data && data.signedUrl; },
  };
  window.RCApi = api;
  window.RC_BOOT = init;
})();
