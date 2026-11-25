/* Local (demo) implementation of the RC.api interface — same method names as
 * js/backend.js, but writes to the browser-only Store. Used when DEMO_MODE is
 * true or Supabase isn't configured. */
(function () {
  if (window.RCApi) return; // live backend already provided the API
  const S = window.Store;
  const me = () => { const s = S.session(); return s ? S.user(s.userId) : null; };
  const upd = (fn) => { S.update(fn); };
  const req = (db, id) => db.requests.find((x) => x.id === id);

  window.RCApi = {
    local: true,
    get uid() { const u = me(); return u && u.id; },
    ready: Promise.resolve(),
    async signOut() { S.setSession(null); },
    async updateProfile(patch) {
      upd((db) => { const u = db.users.find((x) => x.id === me().id); if ('full_name' in patch) u.name = patch.full_name; if ('online' in patch) u.online = patch.online; });
    },
    async setOnline(on) { upd((db) => { db.users.find((x) => x.id === me().id).online = on; }); },
    async writeLoc(p) { upd((db) => { db.users.find((x) => x.id === me().id).loc = { lat: p.lat, lng: p.lng, at: Date.now() }; }); },
    async saveBank(bank, upfront) { upd((db) => { const u = db.users.find((x) => x.id === me().id); u.bank = bank; u.upfront = upfront; }); },

    async createRequest(o) {
      const id = S.uid('req');
      const r = {
        id, kind: o.kind, vehicle: o.vehicle, customerId: me().id, pickup: o.pickup, dropoff: o.dropoff, path: o.route.path, distKm: o.route.distKm, mins: o.route.mins,
        suggested: o.suggested, offer: o.offer, pay: o.pay, note: o.note || '', parcel: o.parcel || null, orderId: o.orderId || null,
        status: 'searching', bids: [], riderId: null, price: null, createdAt: Date.now(), transfer: { sent: false, confirmed: false }, rated: false,
      };
      r.botPlan = window.RC && RC.planBotBids ? RC.planBotBids(r) : [];
      upd((db) => db.requests.push(r));
      return r;
    },
    async raiseOffer(id, d) { upd((db) => { const r = req(db, id); if (r && r.status === 'searching') r.offer += d; }); },
    async declineBid(id, rider) { upd((db) => { const b = req(db, id).bids.find((x) => x.riderId === rider); if (b) b.status = 'declined'; }); },
    async acceptBid(id, rider, approach) {
      upd((db) => {
        const r = req(db, id); if (!r || r.status !== 'searching') throw new Error('Request is no longer open');
        const bid = r.bids.find((b) => b.riderId === rider && b.status === 'open'); if (!bid) throw new Error('That offer is no longer available');
        r.status = 'accepted'; r.riderId = rider; r.price = bid.price; r.acceptedAt = Date.now(); r.approach = approach;
        r.bids.forEach((b) => { b.status = b.riderId === rider ? 'accepted' : 'lost'; });
      });
    },
    async cancelRequest(id) {
      const u = me();
      upd((db) => {
        const r = req(db, id);
        if (r.customerId === u.id) {
          r.status = 'cancelled'; r.cancelledAt = Date.now();
          if (r.orderId) { const o = db.orders.find((x) => x.id === r.orderId); if (o && !['delivered', 'picked_up'].includes(o.status)) o.status = 'cancelled'; }
        } else if (r.riderId === u.id) {
          r.status = 'searching'; r.riderId = null; r.price = null; r.approach = null;
          r.bids.forEach((b) => { if (b.riderId === u.id) b.status = 'declined'; else if (b.status === 'lost') b.status = 'open'; });
        }
      });
    },
    async placeBid(id, price) {
      const u = me();
      upd((db) => {
        const r = req(db, id); if (!r || r.status !== 'searching') throw new Error('Request is no longer open');
        r.bids = r.bids.filter((b) => b.riderId !== u.id);
        r.bids.push({ riderId: u.id, price, type: price > r.offer ? 'counter' : 'accept', at: Date.now(), status: 'open' });
      });
    },
    async withdrawBid(id) { upd((db) => { const r = req(db, id); if (r) r.bids = r.bids.filter((b) => b.riderId !== me().id); }); },
    async riderStep(id, step) {
      upd((db) => {
        const r = req(db, id); const o = r.orderId && db.orders.find((x) => x.id === r.orderId);
        if (step === 'arrived') { r.status = 'arrived'; r.arrivedAt = Date.now(); }
        if (step === 'start') { r.status = 'in_progress'; r.startedAt = Date.now(); if (o) o.status = 'picked_up'; }
        if (step === 'complete') { r.status = 'completed'; r.completedAt = Date.now(); if (o) o.status = 'delivered'; }
      });
    },
    async markTransferSent(kind, id) { upd((db) => { const x = (kind === 'order' ? db.orders : db.requests).find((y) => y.id === id); if (x) x.transfer = { sent: true, sentAt: Date.now(), confirmed: false }; }); },
    async confirmTransfer(kind, id) { upd((db) => { const x = (kind === 'order' ? db.orders : db.requests).find((y) => y.id === id); if (x) x.transfer.confirmed = true; }); },
    async rate(reqId, reviews) {
      const u = me();
      upd((db) => {
        reviews.forEach((r) => db.reviews.push({ id: S.uid('rev'), targetType: r.targetType, targetId: r.targetId, customerId: u.id, customerName: u.name.split(' ')[0], stars: r.stars, text: r.text, at: Date.now(), requestId: reqId }));
        req(db, reqId).rated = true;
      });
    },

    async placeOrder(vendorId, items, pay, note, dropoff) {
      const u = me(); const v = S.vendor(vendorId); const id = S.uid('ord');
      const clean = items.map((i) => { const p = S.db.products.find((x) => x.id === i.productId); return { productId: p.id, name: p.name, price: p.price, qty: i.qty }; });
      upd((db) => db.orders.push({ id, customerId: u.id, customerName: u.name, customerPhone: u.phone, vendorId, items: clean, subtotal: clean.reduce((s, i) => s + i.price * i.qty, 0), status: 'placed', pay: v.upfront ? 'transfer' : pay, note, dropoff, createdAt: Date.now(), transfer: { sent: false, confirmed: false } }));
      return id;
    },
    async linkOrderRequest(orderId, reqId) { upd((db) => { db.orders.find((o) => o.id === orderId).requestId = reqId; }); },
    async vendorOrderStatus(id, s) {
      upd((db) => {
        const o = db.orders.find((x) => x.id === id); o.status = s; if (s === 'preparing') o.acceptedAt = Date.now();
        if (s === 'rejected' && o.requestId) { const r = req(db, o.requestId); if (r && ['searching', 'accepted', 'arrived'].includes(r.status)) r.status = 'cancelled'; }
      });
    },

    async saveApplication(patch, step) { upd((db) => { const x = db.users.find((y) => y.id === me().id); if (patch) Object.assign(x.kyc.data, patch); if (step != null) x.kyc.step = step; }); },
    async uploadDoc(key, file, compressed) { upd((db) => { const x = db.users.find((y) => y.id === me().id); x.kyc.docs = x.kyc.docs || {}; x.kyc.docs[key] = compressed; }); },
    async submitApplication() {
      upd((db) => {
        const x = db.users.find((y) => y.id === me().id); const d = x.kyc.data;
        x.name = d.fullName || x.name;
        x.vehicle = { make: d.make, model: x.role === 'keke' ? `${d.make} ${d.model || ''}`.trim() : d.make, colour: d.colour, plate: x.role === 'keke' ? (d.plate || '').toUpperCase() : '—', year: d.year };
        x.bank = { bankName: d.bankName, accountNumber: d.accountNumber, accountName: d.accountName };
        x.upfront = !!d.upfront; x.kyc.status = 'pending'; x.kyc.submittedAt = Date.now(); x.kyc.editing = false; x.kyc.reason = '';
      });
    },
    async setKycEditing(v) { upd((db) => { const x = db.users.find((y) => y.id === me().id); x.kyc.editing = v; if (v) x.kyc.step = 0; }); },
    async reviewRider(userId, decision, reason) {
      upd((db) => {
        const u = db.users.find((x) => x.id === userId);
        if (decision === 'approve') { u.kyc.status = 'approved'; u.kyc.reason = ''; } else { u.kyc.status = 'rejected'; u.kyc.reason = reason; u.online = false; }
        u.kyc.reviewedAt = Date.now();
      });
    },

    async createVendor(d) { const u = me(); const id = S.uid('ven'); upd((db) => { db.vendors.push({ id, ownerId: u.id, open: true, createdAt: Date.now(), ...d }); db.users.find((x) => x.id === u.id).vendorId = id; }); },
    async updateVendor(id, d) { upd((db) => Object.assign(db.vendors.find((x) => x.id === id), d)); },
    async saveProduct(id, vendorId, d) { upd((db) => { if (id) Object.assign(db.products.find((x) => x.id === id), d); else db.products.push({ id: S.uid('prd'), vendorId, img: null, ...d }); }); },
    async setProductAvailable(id, v) { upd((db) => { db.products.find((x) => x.id === id).available = v; }); },
    async deleteProduct(id) { upd((db) => { db.products = db.products.filter((x) => x.id !== id); }); },

    async createPost(d) { const { img, ...rest } = d; upd((db) => { db.posts = db.posts || []; db.posts.push({ id: S.uid('post'), imageUrl: img || null, createdAt: Date.now(), ...rest }); }); },
    async updatePost(id, d) { const { img, ...rest } = d; upd((db) => { const p = (db.posts || []).find((x) => x.id === id); if (p) { Object.assign(p, rest); if (img) p.imageUrl = img; } }); },
    async deletePost(id) { upd((db) => { db.posts = (db.posts || []).filter((x) => x.id !== id); }); },
  };
})();
