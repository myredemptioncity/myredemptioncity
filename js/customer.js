/* Customer: book rides & parcels, offers/counter-offers, live tracking, shopping */
(function () {
  const { C, S, M, $, $$, esc, naira, icon, vehicleSvg, initials, round50, fare, ago, stars, me, toast, ACTIVE } = RC;

  const CS = {
    mode: 'ride', pickup: null, dropoff: null, picking: null, route: null, routing: false, offer: null, pay: 'cash', note: '',
    parcel: { desc: '', size: 'small', recipient: '', recipientPhone: '' }, cat: 'all',
  };
  const vehicleOf = () => (CS.mode === 'ride' ? 'keke' : 'bike');
  const mapState = { map: null, layers: [], riderMk: null, reqId: null };

  function clearLayers() { mapState.layers.forEach((l) => l.remove()); mapState.layers = []; mapState.riderMk = null; }
  async function ensureMap(onClick) {
    const el = $('#map'); if (!el) return null;
    mapState.map = await M.create(el, { center: C.CENTER, zoom: 15, onClick });
    mapState.layers = [];
    return mapState.map;
  }
  function unmountMap() { if (mapState.map) { try { mapState.map.destroy(); } catch (e) { /* ignore */ } } mapState.map = null; mapState.layers = []; }

  const nearbyRiders = (vehicle) => S.db.users.filter((u) => u.role === vehicle && u.online && u.kyc && u.kyc.status === 'approved' && u.loc);
  const activeRequest = (u) => S.db.requests.filter((r) => r.customerId === u.id && ACTIVE.includes(r.status)).sort((a, b) => b.createdAt - a.createdAt)[0];
  const backPill = (href, label = 'Back') => `<a class="pill" href="${href}" style="padding:6px 14px 6px 8px">${icon('chevron-left')} ${label}</a>`;
  const brandPill = () => `<span class="pill"><span class="emblem" style="background:#fff url('assets/rccg-emblem.png') center/cover"></span>${esc(C.APP_NAME)}</span>`;

  /* ======================= HOME (plan a ride / parcel) ======================= */
  async function updateRoute() {
    CS.route = null;
    if (!CS.pickup || !CS.dropoff) { RC.refresh(); return; }
    CS.routing = true; RC.refresh();
    const r = await RC.routeFor(CS.pickup, CS.dropoff, vehicleOf());
    CS.route = r; CS.routing = false;
    CS.offer = fare(vehicleOf(), r.distKm);
    RC.refresh();
  }

  async function setPoint(which, p, label) {
    const lbl = label || (await M.reverse(p));
    CS[which] = { lat: p.lat, lng: p.lng, label: lbl };
    CS.picking = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // let the sheet re-render
    if (!M.inServiceArea(p)) toast('That point is outside the Redemption City service area.', 'bad');
    updateRoute();
  }

  function locRow(which) {
    const v = CS[which];
    const lbl = which === 'pickup' ? (CS.mode === 'ride' ? 'Pickup' : 'Pick up parcel from') : (CS.mode === 'ride' ? 'Where to?' : 'Deliver to');
    return `<button class="locrow" data-act="pick" data-which="${which}" aria-label="${lbl}: ${v ? esc(v.label) : 'not set'}">
      <span class="ldot ${which === 'pickup' ? 'a' : 'b'}" aria-hidden="true"></span>
      <span class="grow"><span class="lbl">${lbl}</span><span class="val ${v ? '' : 'ph'}">${v ? esc(v.label) : which === 'pickup' ? 'Set pickup point' : 'Choose destination'}</span></span>
      ${icon('chevron-right', 'ic-sm')}</button>`;
  }

  function pickerSheet() {
    const which = CS.picking;
    return `<div class="stack">
      <div class="row"><button class="btn btn-icon btn-ghost" data-act="pick-cancel" aria-label="Back">${icon('arrow-left')}</button>
        <h2 style="font-size:20px">${which === 'pickup' ? 'Set pickup' : 'Set destination'}</h2></div>
      <div class="searchbox">${icon('search')}<label class="sr-only" for="lm-q">Search places</label>
        <input class="input" id="lm-q" placeholder="Search places in Redemption City" data-input="lm-filter" autocomplete="off"></div>
      <ul class="opt-list" id="lm-list">
        <li><button data-act="pick-me">${'<span class="ic-box">' + icon('locate-fixed') + '</span>'}<span class="grow"><b>Use my current location</b><span class="xs muted" style="display:block">Uses your phone's GPS</span></span></button></li>
        <li><button data-act="pick-map"><span class="ic-box">${icon('map-pin')}</span><span class="grow"><b>Choose on map</b><span class="xs muted" style="display:block">Tap anywhere on the map to drop a pin</span></span></button></li>
        ${C.LANDMARKS.map((l) => `<li data-q="${esc(l.label.toLowerCase())}"><button data-act="pick-lm" data-id="${l.id}"><span class="ic-box">${icon('landmark')}</span><span class="grow"><b>${esc(l.label)}</b><span class="xs muted" style="display:block">Redemption City</span></span></button></li>`).join('')}
      </ul></div>`;
  }

  function planSheet(u) {
    const act = activeRequest(u);
    const v = vehicleOf();
    const n = nearbyRiders(v).length;
    const r = CS.route;
    const minOffer = r ? round50(fare(v, r.distKm) * 0.7) : 0;
    const sug = r ? fare(v, r.distKm) : 0;
    return `<div class="stack">
      ${act ? `<a class="banner info card-link" href="#/c/trip/${act.id}" style="text-decoration:none">${icon('radio')}<span class="grow"><b>${act.status === 'searching' ? 'Waiting for rider offers' : 'Your trip is in progress'}</b><br><span class="muted">${esc(act.pickup.label)} → ${esc(act.dropoff.label)}</span></span>${icon('chevron-right')}</a>` : ''}
      <div class="seg" role="group" aria-label="Service">
        <button data-act="mode" data-mode="ride" aria-pressed="${CS.mode === 'ride'}">${vehicleSvg('keke', 20)} Ride</button>
        <button data-act="mode" data-mode="parcel" aria-pressed="${CS.mode === 'parcel'}">${icon('package', 'ic-sm')} Send</button>
        <button data-act="goto" data-to="c/shop" aria-pressed="false">${icon('shopping-bag', 'ic-sm')} Shop</button>
      </div>
      <div class="locbox">${locRow('pickup')}${locRow('dropoff')}</div>
      ${CS.mode === 'parcel' ? `<fieldset class="stack"><legend class="sr-only">Parcel details</legend>
        <div class="field"><label for="p-desc" class="req">What are you sending?</label><input class="input" id="p-desc" data-input="parcel" data-k="desc" value="${esc(CS.parcel.desc)}" placeholder="e.g. Documents, food flask, small bag"></div>
        <div class="field"><span class="label">Size</span><div class="chips" role="group" aria-label="Parcel size">
          ${[['small', 'Small · fits a bag'], ['medium', 'Medium · box'], ['large', 'Large · carrier']].map(([k, l]) => `<button class="chip" data-act="parcel-size" data-size="${k}" aria-pressed="${CS.parcel.size === k}">${l}</button>`).join('')}</div></div>
        <div class="grid-2"><div class="field"><label for="p-rn" class="req">Recipient name</label><input class="input" id="p-rn" data-input="parcel" data-k="recipient" value="${esc(CS.parcel.recipient)}" autocomplete="off"></div>
        <div class="field"><label for="p-rp" class="req">Recipient phone</label><input class="input" id="p-rp" type="tel" inputmode="tel" data-input="parcel" data-k="recipientPhone" value="${esc(CS.parcel.recipientPhone)}"></div></div>
      </fieldset>` : ''}
      ${CS.routing ? `<div class="card-flat row">${'<span class="spinner" style="width:18px;height:18px;border:2.5px solid var(--muted);border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite"></span>'}<span class="muted">Calculating route…</span></div>` : ''}
      ${r ? `
        <div class="card-flat row-between small"><span class="row" style="gap:6px">${icon('route', 'ic-sm')} ${r.distKm.toFixed(1)} km · ~${Math.max(1, Math.round(r.mins))} min</span><span>Suggested <b class="num">${naira(sug)}</b></span></div>
        <div class="field"><label for="offer-in" class="label">Your offer</label>
          <div class="stepper"><button data-act="offer-step" data-d="-50" aria-label="Lower offer by 50 naira">${icon('minus')}</button>
            <label class="amount" for="offer-in">₦<input id="offer-in" inputmode="numeric" data-input="offer" value="${CS.offer}" aria-describedby="offer-help"></label>
            <button data-act="offer-step" data-d="50" aria-label="Raise offer by 50 naira">${icon('plus')}</button></div>
          <p class="help" id="offer-help">${CS.offer < sug ? `Offers below the suggested fare may take longer to get a rider. Minimum is ${naira(minOffer)}.` : 'Riders can accept your price or send a counter-offer.'}</p></div>
        <div class="field"><span class="label">Payment</span><div class="seg" role="group" aria-label="Payment method">
          <button data-act="pay" data-pay="cash" aria-pressed="${CS.pay === 'cash'}">${icon('banknote', 'ic-sm')} Cash</button>
          <button data-act="pay" data-pay="transfer" aria-pressed="${CS.pay === 'transfer'}">${icon('landmark', 'ic-sm')} Bank transfer</button></div>
          ${CS.pay === 'transfer' ? `<p class="help">You'll see the rider's account details when they accept, so you can transfer to them directly.</p>` : ''}</div>
        <div class="field"><label for="note" class="label">Note for rider <span class="muted" style="font-weight:500">(optional)</span></label><input class="input" id="note" data-input="note" value="${esc(CS.note)}" placeholder="e.g. I'm at the blue gate"></div>
        <button class="btn btn-primary btn-block" data-act="request" style="min-height:56px">${CS.mode === 'ride' ? `Find a keke · ${naira(CS.offer)}` : `Find a dispatch rider · ${naira(CS.offer)}`}</button>
      ` : `<p class="muted small row" style="gap:6px">${icon('info', 'ic-sm')} ${n} ${v === 'keke' ? 'kekes' : 'dispatch riders'} online near you. Choose your pickup and destination to see a fare.</p>`}
    </div>`;
  }

  function syncHomeMap() {
    const m = mapState.map; if (!m) return;
    clearLayers();
    nearbyRiders(vehicleOf()).forEach((r) => mapState.layers.push(m.marker(r.loc, vehicleOf(), null)));
    if (RC.UI.myLoc && !RC.UI.myLoc.simulated) mapState.layers.push(m.marker(RC.UI.myLoc, 'me'));
    if (CS.pickup) mapState.layers.push(m.marker(CS.pickup, 'pickup', 'Pickup'));
    if (CS.dropoff) mapState.layers.push(m.marker(CS.dropoff, 'dropoff', CS.mode === 'ride' ? 'Drop-off' : 'Deliver'));
    if (CS.route) mapState.layers.push(m.line(CS.route.path, { color: '#098A44' }));
    if (CS.pickup && CS.dropoff) m.fit([CS.pickup, CS.dropoff], 70);
  }

  RC.views['c-home'] = {
    path: 'c/home', title: 'Home', roles: ['customer'], map: true,
    mapTop: () => `${brandPill()}${CS.picking ? '' : ''}`,
    sheet: () => (CS.picking ? pickerSheet() : planSheet(me())),
    async mount() {
      await ensureMap((p) => {
        if (CS.picking) setPoint(CS.picking, p);
        else if (!CS.pickup) setPoint('pickup', p);
        else setPoint('dropoff', p);
      });
      if (!CS.pickup) {
        const loc = await RC.getMyLocation();
        if (!CS.pickup) { CS.pickup = { lat: loc.lat, lng: loc.lng, label: loc.label }; if (loc.outside) toast("You're outside Redemption City, so we've set pickup to the Main Gate for this demo.", 'info'); }
        RC.refresh();
      }
      syncHomeMap();
      const el = $('#map'); if (el) el.insertAdjacentHTML('afterend', `<button class="fab fab-locate" data-act="locate" aria-label="Centre map on my location">${icon('locate-fixed')}</button>`);
      RC.refreshIcons();
    },
    sync: () => syncHomeMap(),
    unmount: unmountMap,
  };

  Object.assign(RC.actions, {
    goto: (el) => RC.go(el.dataset.to),
    mode: (el) => { CS.mode = el.dataset.mode; updateRoute(); },
    pick: (el) => { CS.picking = el.dataset.which; RC.refresh(); setTimeout(() => { const q = $('#lm-q'); q && q.focus(); }, 30); },
    'pick-cancel': () => { CS.picking = null; RC.refresh(); },
    'pick-map': () => { toast('Tap the map to drop your pin', 'info'); const q = $('#lm-q'); q && q.blur(); },
    'pick-me': async () => { const l = await RC.getMyLocation(true); if (l.outside) toast("You're outside Redemption City, so we're using the Main Gate for this demo.", 'info'); setPoint(CS.picking, l, l.label); },
    'pick-lm': (el) => { const l = C.LANDMARKS.find((x) => x.id === el.dataset.id); setPoint(CS.picking, l, l.label); },
    locate: async () => { const l = await RC.getMyLocation(true); mapState.map && mapState.map.center(l, 16); },
    'offer-step': (el) => { const v = vehicleOf(); const min = round50(fare(v, CS.route.distKm) * 0.7); CS.offer = Math.max(min, (CS.offer || 0) + Number(el.dataset.d)); RC.refresh(); },
    pay: (el) => { CS.pay = el.dataset.pay; RC.refresh(); },
    'parcel-size': (el) => { CS.parcel.size = el.dataset.size; RC.refresh(); },
    request: async (el) => {
      const u = me();
      if (activeRequest(u)) { toast('Finish or cancel your current request first.', 'bad'); return; }
      if (!CS.pickup || !CS.dropoff || !CS.route) return;
      const v = vehicleOf();
      const min = round50(fare(v, CS.route.distKm) * 0.7);
      if (!CS.offer || CS.offer < min) { toast(`Offer must be at least ${naira(min)}.`, 'bad'); $('#offer-in') && $('#offer-in').focus(); return; }
      if (CS.mode === 'parcel') {
        if (!CS.parcel.desc.trim()) { toast('Tell the rider what you are sending.', 'bad'); $('#p-desc').focus(); return; }
        if (!CS.parcel.recipient.trim() || !/^0[789][01]\d{8}$/.test(CS.parcel.recipientPhone.replace(/\D/g, ''))) { toast('Add the recipient name and a valid phone number.', 'bad'); $('#p-rn').focus(); return; }
      }
      el.disabled = true; el.innerHTML = '<span class="spinner"></span> Sending request…';
      let req;
      const ok = await RC.run((async () => { req = await RC.createRequest({
        kind: CS.mode, vehicle: v, pickup: CS.pickup, dropoff: CS.dropoff, route: CS.route,
        suggested: fare(v, CS.route.distKm), offer: CS.offer, pay: CS.pay, note: CS.note,
        parcel: CS.mode === 'parcel' ? { ...CS.parcel } : null,
      }); })());
      if (!ok || !req) { RC.refresh(); return; }
      CS.dropoff = null; CS.route = null; CS.note = ''; CS.parcel = { desc: '', size: 'small', recipient: '', recipientPhone: '' };
      RC.go('c/trip/' + req.id);
    },
  });
  Object.assign(RC.inputs, {
    'lm-filter': (el) => { const q = el.value.trim().toLowerCase(); $$('#lm-list li[data-q]').forEach((li) => li.classList.toggle('hidden', q && !li.dataset.q.includes(q))); },
    offer: (el) => { CS.offer = Number(el.value.replace(/\D/g, '')) || 0; },
    note: (el) => { CS.note = el.value; },
    parcel: (el) => { CS.parcel[el.dataset.k] = el.value; },
  });

  /* ======================= TRIP (offers + live tracking) ======================= */
  const statusText = (r) => {
    const order = r.kind === 'order';
    if (r.status === 'accepted') return order ? 'Rider is heading to the store' : 'Your rider is on the way';
    if (r.status === 'arrived') return order ? 'Rider is at the store' : 'Your rider has arrived';
    if (r.status === 'in_progress') return order ? 'Your order is on its way' : r.kind === 'parcel' ? 'Parcel is on its way' : 'On trip to destination';
    if (r.status === 'completed') return order ? 'Order delivered' : r.kind === 'parcel' ? 'Parcel delivered' : 'You have arrived';
    if (r.status === 'cancelled') return 'Request cancelled';
    return 'Finding riders';
  };

  function bankBlock(holder, obj, kind, id, viewer = 'customer') {
    const b = holder && holder.bank;
    if (!b || !b.accountNumber) return `<div class="banner">${icon('alert-triangle')}<span>This provider hasn't added bank details yet. Pay cash or ask them on a call.</span></div>`;
    const t = obj.transfer || {};
    return `<div class="bank" aria-label="Bank transfer details">
      <div class="row-between"><span class="small"><b>Pay by transfer</b>${holder.upfront ? ' · <span class="badge badge-amber">Upfront required</span>' : ''}</span>${t.confirmed ? '<span class="badge badge-green">' + icon('check', 'ic-sm') + ' Payment confirmed</span>' : t.sent ? '<span class="badge badge-amber">Awaiting confirmation</span>' : ''}</div>
      <div class="row-between"><span class="acct">${esc(b.accountNumber)}</span><button class="btn btn-sm btn-outline" data-act="copy" data-value="${esc(b.accountNumber)}">${icon('copy', 'ic-sm')} Copy</button></div>
      <div class="small"><b>${esc(b.accountName)}</b> · ${esc(b.bankName)}</div>
      ${viewer === 'customer' && !t.sent ? `<button class="btn btn-brand btn-sm" data-act="transfer-sent" data-kind="${kind}" data-id="${id}">${icon('send', 'ic-sm')} I've sent ${naira(obj.price || obj.subtotal)}</button>` : ''}
    </div>`;
  }
  RC.bankBlock = bankBlock;

  function bidCard(r, b, best) {
    const rider = S.user(b.riderId); if (!rider) return '';
    const dist = rider.loc ? M.haversineKm(rider.loc, r.pickup) * C.ROAD_FACTOR : 1;
    const away = Math.max(1, Math.round((dist / C.SPEED_KMH[r.vehicle]) * 60));
    return `<li class="bid ${best ? 'best' : ''}">
      <span class="avatar">${initials(rider.name)}</span>
      <div class="grow"><b>${esc(rider.name)}</b><div class="row wrap" style="gap:8px">${stars('user', rider.id)}<span class="xs muted">${away} min away</span></div>
        <div class="xs muted">${esc(rider.vehicle ? `${rider.vehicle.colour} ${rider.vehicle.model}${rider.vehicle.plate && rider.vehicle.plate !== '—' ? ' · ' + rider.vehicle.plate : ''}` : '')}</div>
        <div class="row wrap" style="gap:6px;margin-top:4px">${best ? '<span class="badge badge-green">Best price</span>' : ''}${b.type === 'counter' ? '<span class="badge badge-amber">Counter-offer</span>' : '<span class="badge badge-blue">Accepted your price</span>'}${rider.upfront ? '<span class="badge">Upfront transfer</span>' : ''}</div></div>
      <span class="price num">${naira(b.price)}</span>
      <div class="bid-actions"><button class="btn btn-outline btn-sm" data-act="bid-decline" data-req="${r.id}" data-rider="${rider.id}">Decline</button>
        <button class="btn btn-primary btn-sm" data-act="bid-accept" data-req="${r.id}" data-rider="${rider.id}">Accept ${naira(b.price)}</button></div>
    </li>`;
  }

  function orderTimeline(r, ord) {
    const st = ord ? ord.status : 'placed';
    const steps = [
      ['Order placed', true],
      ['Store is preparing', ['preparing', 'ready', 'picked_up', 'delivered'].includes(st)],
      ['Ready for pickup', ['ready', 'picked_up', 'delivered'].includes(st)],
      ['Rider picked up', ['picked_up', 'delivered'].includes(st) || r.status === 'in_progress' || r.status === 'completed'],
      ['Delivered', st === 'delivered' || r.status === 'completed'],
    ];
    const nowIdx = steps.findIndex((s) => !s[1]);
    return `<ol class="timeline">${steps.map(([l, d], i) => `<li class="${d ? 'done' : i === nowIdx ? 'now' : ''}"><span class="tdot">${d ? icon('check', 'ic-sm') : i + 1}</span><b>${l}</b></li>`).join('')}</ol>`;
  }

  function trackingSheet(r) {
    const rider = S.user(r.riderId);
    const ord = r.orderId ? S.order(r.orderId) : null;
    const eta = RC.etaMins(r);
    const idx = { accepted: 1, arrived: 2, in_progress: 3, completed: 4 }[r.status] || 0;
    const needsTransfer = r.pay === 'transfer' || (rider && rider.upfront);
    return `<div class="stack">
      <div class="row-between"><div><h2 style="font-size:20px">${statusText(r)}</h2>
        <p class="muted small" id="eta">${r.status === 'arrived' ? (r.kind === 'order' ? 'Waiting for your order' : 'Meet your rider at the pickup point') : eta != null ? `ETA ${eta} min` : ''}</p></div>
        <span class="badge badge-blue">${esc(RC.M.provider === 'google' ? 'Live · Google Maps' : 'Live')}</span></div>
      ${r.kind === 'order' ? orderTimeline(r, ord) : `<ol class="steps" aria-label="Trip progress: step ${idx} of 4">${[1, 2, 3, 4].map((i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}"></li>`).join('')}</ol>`}
      ${rider ? `<div class="card-flat row"><span class="avatar avatar-lg">${initials(rider.name)}</span>
        <div class="grow"><b>${esc(rider.name)}</b><div>${stars('user', rider.id)}</div>
          <div class="small muted">${esc(rider.vehicle ? rider.vehicle.colour + ' ' + rider.vehicle.model : '')}</div>
          ${rider.vehicle && rider.vehicle.plate && rider.vehicle.plate !== '—' ? `<span class="badge badge-brand num" style="margin-top:4px">${esc(rider.vehicle.plate)}</span>` : ''}</div>
        <a class="btn btn-icon btn-primary" href="tel:${esc(rider.phone)}" aria-label="Call ${esc(rider.name)}">${icon('phone')}</a></div>` : ''}
      <dl class="kv"><dt>Fare</dt><dd class="num">${naira(r.price)}</dd><dt>Payment</dt><dd>${needsTransfer ? (r.pay === 'cash' ? 'Bank transfer (rider requires upfront)' : 'Bank transfer') : 'Cash'}</dd>
        <dt>From</dt><dd>${esc(r.pickup.label)}</dd><dt>To</dt><dd>${esc(r.dropoff.label)}</dd>
        ${ord ? `<dt>Order</dt><dd>${ord.items.reduce((s, i) => s + i.qty, 0)} items · ${naira(ord.subtotal)}</dd>` : ''}</dl>
      ${needsTransfer && r.status !== 'completed' ? bankBlock(rider, r, 'req', r.id) : ''}
      ${ord && (ord.pay === 'transfer') ? `<h4>Pay the store</h4>${bankBlock(S.vendor(ord.vendorId), { ...ord, price: ord.subtotal }, 'order', ord.id)}` : ''}
      ${['accepted', 'arrived'].includes(r.status) ? `<button class="btn btn-danger btn-block" data-act="cancel-req" data-id="${r.id}">Cancel request</button>` : ''}
      ${r.status === 'in_progress' ? `<a class="btn btn-outline btn-block" href="tel:112">${icon('siren')} Emergency (112)</a>` : ''}
    </div>`;
  }

  function rateSheet(r) {
    const rider = S.user(r.riderId);
    const v = r.orderId ? S.vendor((S.order(r.orderId) || {}).vendorId) : null;
    const starInput = (name, who) => `<fieldset><legend>Rate ${esc(who)}</legend><div class="star-input">
      ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="${name}${n}" name="${name}" value="${n}" ${n === 5 ? 'checked' : ''}><label for="${name}${n}" aria-label="${n} star${n > 1 ? 's' : ''}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5 6 20.8l1.3-6.7-5-4.6 6.8-.8z"/></svg></label>`).join('')}</div></fieldset>`;
    if (r.rated) return `<div class="stack center" style="align-items:center"><span class="ricon" style="width:64px;height:64px;border-radius:50%;background:var(--action-soft);color:var(--action);display:grid;place-items:center">${icon('check', 'ic-lg')}</span>
      <h2>Thanks for your feedback!</h2><p class="muted">${naira(r.price)} · ${esc(r.dropoff.label)}</p><a class="btn btn-primary btn-block" href="#/c/home">Back to home</a></div>`;
    return `<form class="stack" data-form="rate" data-id="${r.id}">
      <div class="row-between"><div><h2 style="font-size:20px">${statusText(r)}</h2><p class="muted small">${esc(r.dropoff.label)}</p></div><span class="price num">${naira(r.price)}</span></div>
      <div class="banner ok">${icon('check-circle-2')}<span>${r.transfer.confirmed ? 'Your transfer has been confirmed.' : r.pay === 'cash' ? `Please pay ${naira(r.price)} in cash to your rider.` : r.transfer.confirmed ? 'Your transfer has been confirmed.' : 'Remember to complete your bank transfer.'}</span></div>
      ${rider ? starInput('rs', rider.name.split(' ')[0]) : ''}
      <div class="field"><label for="rt">Comment for rider <span class="muted" style="font-weight:500">(optional)</span></label><textarea class="input" id="rt" name="rt" placeholder="What went well?"></textarea></div>
      ${v ? `${starInput('vs', v.name)}<div class="field"><label for="vt">Comment for ${esc(v.name)} <span class="muted" style="font-weight:500">(optional)</span></label><textarea class="input" id="vt" name="vt"></textarea></div>` : ''}
      <button class="btn btn-primary btn-block" type="submit">Submit rating</button>
      <a class="btn btn-ghost btn-block" href="#/c/home">Skip</a></form>`;
  }

  function searchingSheet(r) {
    const open = r.bids.filter((b) => b.status === 'open').sort((a, b) => a.price - b.price);
    const ord = r.orderId ? S.order(r.orderId) : null;
    return `<div class="stack">
      <div class="row-between"><div><h2 style="font-size:20px">${open.length ? 'Choose your rider' : 'Finding riders…'}</h2>
        <p class="muted small">${esc(r.pickup.label)} → ${esc(r.dropoff.label)}</p></div>
        <div style="text-align:right"><div class="xs muted">Your offer</div><span class="price num">${naira(r.offer)}</span></div></div>
      <div class="row wrap" style="gap:8px"><span class="small muted">Raise your offer:</span>${[50, 100, 200].map((d) => `<button class="chip" data-act="raise" data-id="${r.id}" data-d="${d}">+${naira(d)}</button>`).join('')}</div>
      ${ord ? `<div class="card-flat small row">${icon('store', 'ic-sm')} <span class="grow">${esc((S.vendor(ord.vendorId) || {}).name)} · ${({ placed: 'waiting for the store to accept', preparing: 'preparing your order', ready: 'ready for pickup', rejected: 'the store could not take this order', cancelled: 'cancelled' })[ord.status] || ord.status}</span></div>` : ''}
      <h3 aria-live="polite">${open.length ? `${open.length} offer${open.length > 1 ? 's' : ''}` : 'Waiting for offers'}</h3>
      ${open.length ? `<ul class="list">${open.map((b, i) => bidCard(r, b, i === 0 && open.length > 1)).join('')}</ul>`
        : `<div class="empty">${RC.vehicleSvg(r.vehicle, 40)}<p>Nearby ${r.vehicle === 'keke' ? 'keke' : 'dispatch'} riders can accept your price or send a counter-offer. Offers usually arrive within seconds.</p></div>`}
      <button class="btn btn-danger btn-block" data-act="cancel-req" data-id="${r.id}">Cancel request</button></div>`;
  }

  function syncTripMap(id, refit) {
    const m = mapState.map; const r = S.request(id); if (!m || !r) return;
    clearLayers();
    mapState.layers.push(m.marker(r.pickup, 'pickup', r.kind === 'order' ? 'Store' : 'Pickup'));
    mapState.layers.push(m.marker(r.dropoff, 'dropoff', r.kind === 'ride' ? 'Drop-off' : 'Deliver'));
    if (r.status === 'searching') {
      mapState.layers.push(m.line(r.path, { color: '#098A44' }));
      nearbyRiders(r.vehicle).forEach((u) => mapState.layers.push(m.marker(u.loc, r.vehicle)));
      if (refit) m.fit([r.pickup, r.dropoff], 80);
    } else if (['accepted', 'arrived', 'in_progress'].includes(r.status)) {
      if (r.status === 'accepted' && r.approach) mapState.layers.push(m.line(r.approach.path, { color: '#241F5E', dashed: true, weight: 4 }));
      mapState.layers.push(m.line(r.path, { color: '#098A44' }));
      const pos = RC.riderPosition(r);
      if (pos) { mapState.riderMk = m.marker(pos, r.vehicle, null); mapState.layers.push(mapState.riderMk); }
      if (refit) m.fit([pos, r.pickup, r.dropoff], 80);
    } else if (refit) m.fit([r.pickup, r.dropoff], 80);
  }

  RC.views['c-trip'] = {
    path: 'c/trip/:id', title: 'Trip', roles: ['customer'], map: true, navKey: 'c/activity',
    mapTop: () => backPill('#/c/activity', 'Activity'),
    sheet({ id }) {
      const r = S.request(id);
      if (!r) return `<div class="empty">${icon('search-x')}<p>Request not found.</p><a class="btn btn-primary" href="#/c/home">Home</a></div>`;
      if (r.status === 'searching') return searchingSheet(r);
      if (r.status === 'completed') return rateSheet(r);
      if (r.status === 'cancelled') return `<div class="stack center" style="align-items:center">${icon('circle-slash', 'ic-lg')}<h2>Request cancelled</h2><a class="btn btn-primary btn-block" href="#/c/home">Book again</a></div>`;
      return trackingSheet(r);
    },
    async mount({ id }) {
      await ensureMap(null);
      mapState.reqId = id; mapState.lastStatus = (S.request(id) || {}).status;
      syncTripMap(id, true);
      const r = S.request(id);
      if (r && r.status === 'searching') $('#map').insertAdjacentHTML('beforeend', '');
    },
    sync({ id }) {
      const r = S.request(id); if (!r) return;
      const changed = r.status !== mapState.lastStatus; mapState.lastStatus = r.status;
      if (changed) {
        if (r.status === 'accepted') toast('Rider accepted — they are on the way!');
        if (r.status === 'arrived') toast(r.kind === 'order' ? 'Rider is at the store' : 'Your rider has arrived', 'info');
        if (r.status === 'completed') toast('Completed — please rate your experience');
      }
      syncTripMap(id, changed);
    },
    tick({ id }) {
      const r = S.request(id); if (!r || !mapState.riderMk) return;
      const pos = RC.riderPosition(r); if (pos) mapState.riderMk.setPos(pos);
      const e = $('#eta'); const eta = RC.etaMins(r);
      if (e && r.status !== 'arrived' && eta != null) e.textContent = `ETA ${eta} min`;
    },
    unmount: unmountMap,
  };

  Object.assign(RC.actions, {
    'bid-accept': async (el) => { el.disabled = true; el.innerHTML = '<span class="spinner"></span>'; if (!(await RC.run(RC.acceptBid(el.dataset.req, el.dataset.rider)))) RC.refresh(); },
    'bid-decline': (el) => RC.run(RC.api.declineBid(el.dataset.req, el.dataset.rider)),
    raise: (el) => RC.run(RC.api.raiseOffer(el.dataset.id, Number(el.dataset.d))),
    'cancel-req': async (el) => {
      if (!(await RC.confirmDialog('Cancel this request?', 'Riders who are on their way will be notified.', 'Cancel request', true))) return;
      RC.run(RC.api.cancelRequest(el.dataset.id), 'Request cancelled');
    },
    'transfer-sent': (el) => RC.run(RC.api.markTransferSent(el.dataset.kind, el.dataset.id)),
  });
  RC.forms.rate = async (f, fd) => {
    const r = S.request(f.dataset.id);
    const reviews = [];
    if (fd.get('rs')) reviews.push({ targetType: 'user', targetId: r.riderId, stars: Number(fd.get('rs')), text: (fd.get('rt') || '').trim() });
    if (fd.get('vs') && r.orderId) reviews.push({ targetType: 'vendor', targetId: S.order(r.orderId).vendorId, stars: Number(fd.get('vs')), text: (fd.get('vt') || '').trim() });
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    if (!(await RC.run(RC.api.rate(r.id, reviews), 'Thanks for rating!'))) b.disabled = false;
  };

  /* ======================= SHOP ======================= */
  const CART_KEY = 'rcgo.cart';
  const cart = { get() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || { vendorId: null, items: {} }; } catch (e) { return { vendorId: null, items: {} }; } }, set(c) { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) { /* ignore */ } } };
  const cartCount = (c) => Object.values(c.items).reduce((s, n) => s + n, 0);
  const cartTotal = (c) => Object.entries(c.items).reduce((s, [pid, q]) => { const p = S.db.products.find((x) => x.id === pid); return s + (p ? p.price * q : 0); }, 0);
  const vLogo = (v, cls = '') => `<span class="vlogo ${v.type} ${cls}">${v.logo ? `<img src="${v.logo}" alt="">` : icon(RC.vendorIcon[v.type])}</span>`;
  RC.vLogo = vLogo;
  const distTo = (p) => (RC.UI.myLoc ? M.haversineKm(RC.UI.myLoc, p) : null);

  function cartBar() {
    const c = cart.get(); const n = cartCount(c); if (!n) return '';
    return `<div class="cartbar"><a class="btn btn-primary" href="#/c/cart"><span class="row" style="gap:8px">${icon('shopping-cart')} View cart · ${n} item${n > 1 ? 's' : ''}</span><span class="num">${naira(cartTotal(c))}</span></a></div>`;
  }

  RC.views['c-shop'] = {
    path: 'c/shop', title: 'Shop', roles: ['customer'], live: true,
    render() {
      const list = S.db.vendors.filter((v) => !v.suspended && (CS.cat === 'all' || v.type === CS.cat));
      return `<header class="topbar"><h1>Shop Redemption City</h1></header>
      <div class="page stack-lg">
        <div class="searchbox">${icon('search')}<label class="sr-only" for="shop-q">Search shops and items</label><input class="input" id="shop-q" placeholder="Search restaurants, stores or items" data-input="shop-filter" autocomplete="off"></div>
        <div class="chips" role="group" aria-label="Category">
          ${[['all', 'All'], ['restaurant', 'Restaurants'], ['supermarket', 'Supermarkets'], ['retail', 'Retail & services']].map(([k, l]) => `<button class="chip" data-act="shop-cat" data-cat="${k}" aria-pressed="${CS.cat === k}">${l}</button>`).join('')}
        </div>
        <div class="vendor-grid" id="vendor-grid">
          ${list.map((v) => {
            const d = distTo(v.loc);
            const items = S.db.products.filter((p) => p.vendorId === v.id).map((p) => p.name.toLowerCase()).join(' ');
            return `<a class="card card-link vendor-card" href="#/c/vendor/${v.id}" data-q="${esc((v.name + ' ' + v.desc + ' ' + items).toLowerCase())}">${vLogo(v)}
              <div class="grow stack" style="gap:4px"><div class="row-between"><b>${esc(v.name)}</b></div>
                <div class="row wrap" style="gap:8px">${stars('vendor', v.id)}<span class="xs muted">${RC.vendorTypeLabel[v.type]}${d != null ? ' · ' + d.toFixed(1) + ' km' : ''}</span></div>
                <div class="row wrap" style="gap:6px">${v.open ? '<span class="badge badge-green">Open</span>' : '<span class="badge badge-red">Closed</span>'}${v.upfront ? '<span class="badge badge-amber">Pay upfront</span>' : ''}<span class="xs muted">${esc(v.landmark || '')}</span></div></div></a>`;
          }).join('') || `<div class="empty">${icon('store')}<p>No shops in this category yet.</p></div>`}
        </div>
        <div id="shop-none" class="empty hidden">${icon('search-x')}<p>No matches. Try another word.</p></div>
      </div>${cartBar()}`;
    },
    mount() { RC.getMyLocation(); },
  };

  RC.views['c-vendor'] = {
    path: 'c/vendor/:id', title: 'Store', roles: ['customer'], live: true, navKey: 'c/shop',
    render({ id }) {
      const v = S.vendor(id); if (!v) return `<div class="page empty">Store not found.</div>`;
      const c = cart.get();
      const prods = S.db.products.filter((p) => p.vendorId === id);
      const cats = [...new Set(prods.map((p) => p.category || 'Other'))];
      const rv = S.rating('vendor', id);
      return `<header class="topbar"><a class="btn btn-icon btn-ghost" href="#/c/shop" aria-label="Back to shops">${icon('arrow-left')}</a><h1 style="font-size:18px" class="grow">${esc(v.name)}</h1></header>
      <div class="page stack-lg" style="padding-bottom:120px">
        <div class="hero-vendor">${vLogo(v)}<div class="stack" style="gap:4px"><h2 style="color:#fff">${esc(v.name)}</h2><p style="opacity:.85" class="small">${esc(v.desc)}</p>
          <div class="row wrap small" style="gap:10px;opacity:.95">${rv.count ? `★ ${rv.avg.toFixed(1)} (${rv.count})` : 'New'} · ${esc(v.hours)} · ${esc(v.landmark || '')}</div></div></div>
        ${!v.open ? `<div class="banner bad">${icon('clock')}<span>This store is closed right now. You can browse, but ordering is off.</span></div>` : ''}
        ${v.upfront ? `<div class="banner">${icon('landmark')}<span>This store asks for payment upfront by bank transfer before your order is prepared.</span></div>` : ''}
        ${cats.map((cat) => `<section class="stack" aria-labelledby="cat-${esc(cat)}"><h3 id="cat-${esc(cat)}">${esc(cat)}</h3><div class="prod-grid">
          ${prods.filter((p) => (p.category || 'Other') === cat).map((p) => {
            const q = c.vendorId === id ? c.items[p.id] || 0 : 0;
            return `<div class="card prod" style="${p.available ? '' : 'opacity:.55'}"><span class="pimg">${p.img ? `<img src="${p.img}" alt="" loading="lazy">` : icon(RC.vendorIcon[v.type])}</span>
              <div class="stack" style="gap:6px"><b>${esc(p.name)}</b>${p.desc ? `<p class="xs muted">${esc(p.desc)}</p>` : ''}
                <div class="row-between"><span class="num" style="font-weight:800">${naira(p.price)}</span>
                ${!p.available ? '<span class="badge">Sold out</span>' : !v.open ? '' : q ? `<span class="qty"><button data-act="cart-dec" data-v="${id}" data-p="${p.id}" aria-label="Remove one ${esc(p.name)}">${icon('minus', 'ic-sm')}</button><span aria-live="polite">${q}</span><button data-act="cart-inc" data-v="${id}" data-p="${p.id}" aria-label="Add one ${esc(p.name)}">${icon('plus', 'ic-sm')}</button></span>`
                  : `<button class="btn btn-sm btn-outline" data-act="cart-inc" data-v="${id}" data-p="${p.id}">${icon('plus', 'ic-sm')} Add</button>`}</div></div></div>`;
          }).join('')}</div></section>`).join('')}
        <section class="stack"><h3>Reviews</h3>${rv.list.slice(0, 4).map((r) => `<div class="card-flat"><div class="row-between"><b class="small">${esc(r.customerName || 'Customer')}</b><span class="stars">${icon('star')}${r.stars}</span></div>${r.text ? `<p class="small">${esc(r.text)}</p>` : ''}<p class="xs muted">${ago(r.at)}</p></div>`).join('') || '<p class="muted small">No reviews yet.</p>'}</section>
      </div>${cartBar()}`;
    },
  };

  const CO = { dest: null, offer: null, pay: 'cash', note: '' };
  RC.views['c-cart'] = {
    path: 'c/cart', title: 'Cart', roles: ['customer'], live: true, navKey: 'c/shop',
    render() {
      const c = cart.get(); const v = c.vendorId && S.vendor(c.vendorId);
      if (!v || !cartCount(c)) return `<header class="topbar"><a class="btn btn-icon btn-ghost" href="#/c/shop" aria-label="Back">${icon('arrow-left')}</a><h1>Cart</h1></header><div class="page"><div class="empty">${icon('shopping-cart')}<p>Your cart is empty.</p><a class="btn btn-primary" href="#/c/shop">Browse shops</a></div></div>`;
      const sub = cartTotal(c);
      const dest = CO.dest || (RC.UI.myLoc ? { ...RC.UI.myLoc } : { ...C.LANDMARKS[0] });
      const km = M.haversineKm(v.loc, dest) * C.ROAD_FACTOR;
      const sug = fare('bike', km);
      if (!CO.offer || CO.offerFor !== v.id + dest.label) { CO.offer = sug; CO.offerFor = v.id + dest.label; }
      if (v.upfront) CO.pay = 'transfer';
      return `<header class="topbar"><a class="btn btn-icon btn-ghost" href="#/c/vendor/${v.id}" aria-label="Back to ${esc(v.name)}">${icon('arrow-left')}</a><h1>Checkout</h1></header>
      <div class="page page-narrow stack-lg">
        <section class="card stack"><div class="row">${vLogo(v)}<div><b>${esc(v.name)}</b><div class="xs muted">${esc(v.landmark || '')}</div></div></div>
          <ul class="list">${Object.entries(c.items).map(([pid, q]) => { const p = S.db.products.find((x) => x.id === pid); if (!p) return ''; return `<li class="row-between"><span class="grow small"><b>${esc(p.name)}</b><br><span class="muted num">${naira(p.price)} each</span></span>
            <span class="qty"><button data-act="cart-dec" data-v="${v.id}" data-p="${pid}" aria-label="Remove one">${icon('minus', 'ic-sm')}</button><span>${q}</span><button data-act="cart-inc" data-v="${v.id}" data-p="${pid}" aria-label="Add one">${icon('plus', 'ic-sm')}</button></span>
            <span class="num" style="min-width:80px;text-align:right;font-weight:700">${naira(p.price * q)}</span></li>`; }).join('')}</ul></section>
        <section class="card stack"><h3>Delivery</h3>
          <div class="field"><label for="co-dest" class="label">Deliver to</label>
            <select class="input" id="co-dest" data-change="co-dest">
              ${RC.UI.myLoc && !RC.UI.myLoc.simulated ? `<option value="me" ${dest.label === RC.UI.myLoc.label ? 'selected' : ''}>${esc(RC.UI.myLoc.label)}</option>` : ''}
              ${C.LANDMARKS.map((l) => `<option value="${l.id}" ${dest.label === l.label ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="co-offer" class="label">Your delivery offer to bicycle riders</label>
            <div class="stepper"><button data-act="co-step" data-d="-50" aria-label="Lower by 50">${icon('minus')}</button>
              <label class="amount" for="co-offer">₦<input id="co-offer" inputmode="numeric" data-input="co-offer" value="${CO.offer}"></label>
              <button data-act="co-step" data-d="50" aria-label="Raise by 50">${icon('plus')}</button></div>
            <p class="help">Suggested ${naira(sug)} for ~${km.toFixed(1)} km. Riders will accept or counter, and you choose who delivers.</p></div>
          <div class="field"><label for="co-note">Note <span class="muted" style="font-weight:500">(optional)</span></label><input class="input" id="co-note" data-input="co-note" value="${esc(CO.note)}" placeholder="e.g. Less pepper, call on arrival"></div></section>
        <section class="card stack"><h3>Payment</h3>
          <div class="seg" role="group" aria-label="Payment method"><button data-act="co-pay" data-pay="cash" aria-pressed="${CO.pay === 'cash'}" ${v.upfront ? 'disabled aria-disabled="true"' : ''}>${icon('banknote', 'ic-sm')} Cash on delivery</button>
            <button data-act="co-pay" data-pay="transfer" aria-pressed="${CO.pay === 'transfer'}">${icon('landmark', 'ic-sm')} Bank transfer</button></div>
          ${v.upfront ? `<p class="help">${esc(v.name)} requires upfront transfer. You'll see their account after placing the order.</p>` : ''}
          <dl class="kv"><dt>Items</dt><dd class="num">${naira(sub)}</dd><dt>Delivery (your offer)</dt><dd class="num">${naira(CO.offer)}</dd><dt style="color:var(--text);font-weight:700">Estimated total</dt><dd class="num" style="font-size:18px">${naira(sub + CO.offer)}</dd></dl>
          <button class="btn btn-primary btn-block" data-act="place-order" style="min-height:56px" ${v.open ? '' : 'disabled'}>Place order · ${naira(sub)}</button></section>
      </div>`;
    },
    mount() { if (!RC.UI.myLoc) RC.getMyLocation().then(() => RC.render()); },
  };

  Object.assign(RC.actions, {
    'shop-cat': (el) => { CS.cat = el.dataset.cat; RC.render(); },
    'cart-inc': async (el) => {
      const c = cart.get();
      if (c.vendorId && c.vendorId !== el.dataset.v && cartCount(c)) {
        if (!(await RC.confirmDialog('Start a new cart?', `Your cart has items from ${S.vendor(c.vendorId).name}. Adding this will clear it.`, 'Start new cart'))) return;
        c.items = {};
      }
      c.vendorId = el.dataset.v; c.items[el.dataset.p] = (c.items[el.dataset.p] || 0) + 1; cart.set(c); RC.refresh();
    },
    'cart-dec': (el) => { const c = cart.get(); const k = el.dataset.p; c.items[k] = (c.items[k] || 1) - 1; if (c.items[k] <= 0) delete c.items[k]; cart.set(c); RC.refresh(); },
    'co-step': (el) => { CO.offer = Math.max(200, CO.offer + Number(el.dataset.d)); RC.refresh(); },
    'co-pay': (el) => { CO.pay = el.dataset.pay; RC.refresh(); },
    'place-order': async (el) => {
      const u = me(); const c = cart.get(); const v = S.vendor(c.vendorId);
      if (S.db.requests.some((r) => r.customerId === u.id && ACTIVE.includes(r.status))) { toast('Finish or cancel your current request first.', 'bad'); return; }
      el.disabled = true; el.innerHTML = '<span class="spinner"></span> Placing order…';
      const dest = CO.dest || (RC.UI.myLoc ? { ...RC.UI.myLoc } : { ...C.LANDMARKS[0] });
      const items = Object.entries(c.items).filter(([pid]) => S.db.products.some((x) => x.id === pid)).map(([pid, qty]) => ({ productId: pid, qty }));
      const drop = { lat: dest.lat, lng: dest.lng, label: dest.label };
      let req;
      const ok = await RC.run((async () => {
        const orderId = await RC.api.placeOrder(v.id, items, CO.pay, CO.note, drop); // server re-checks prices & availability
        const route = await RC.routeFor(v.loc, dest, 'bike');
        req = await RC.createRequest({ kind: 'order', vehicle: 'bike', pickup: { ...v.loc, label: v.name }, dropoff: drop, route, suggested: fare('bike', route.distKm), offer: CO.offer, pay: CO.pay, note: CO.note, orderId });
        await RC.api.linkOrderRequest(orderId, req.id);
      })());
      if (!ok || !req) { RC.refresh(); return; }
      cart.set({ vendorId: null, items: {} }); CO.note = ''; CO.dest = null;
      toast('Order placed! Riders are sending offers.');
      RC.go('c/trip/' + req.id);
    },
  });
  RC.changes['co-dest'] = (el) => { CO.dest = el.value === 'me' ? { ...RC.UI.myLoc } : { ...C.LANDMARKS.find((l) => l.id === el.value) }; el.blur(); RC.refresh(); };
  Object.assign(RC.inputs, {
    'co-offer': (el) => { CO.offer = Number(el.value.replace(/\D/g, '')) || 0; },
    'co-note': (el) => { CO.note = el.value; },
    'shop-filter': (el) => {
      const q = el.value.trim().toLowerCase(); let shown = 0;
      $$('#vendor-grid [data-q]').forEach((c) => { const ok = !q || c.dataset.q.includes(q); c.classList.toggle('hidden', !ok); if (ok) shown++; });
      $('#shop-none').classList.toggle('hidden', shown > 0);
    },
  });

  /* ======================= ACTIVITY & ACCOUNT ======================= */
  const kindIcon = (r) => (r.kind === 'ride' ? RC.vehicleSvg('keke', 22) : r.kind === 'parcel' ? icon('package') : icon('shopping-bag'));
  const statusBadge = (s) => ({ searching: '<span class="badge badge-amber">Finding rider</span>', accepted: '<span class="badge badge-blue">Rider en route</span>', arrived: '<span class="badge badge-blue">Rider arrived</span>', in_progress: '<span class="badge badge-blue">In progress</span>', completed: '<span class="badge badge-green">Completed</span>', cancelled: '<span class="badge badge-red">Cancelled</span>' }[s] || s);
  RC.statusBadge = statusBadge;

  RC.views['c-activity'] = {
    path: 'c/activity', title: 'Activity', roles: ['customer'], live: true,
    render() {
      const u = me();
      const list = S.db.requests.filter((r) => r.customerId === u.id).sort((a, b) => b.createdAt - a.createdAt);
      return `<header class="topbar"><h1>Activity</h1></header><div class="page page-narrow">
        ${list.length ? `<ul class="list">${list.map((r) => `<li><a class="card card-link row" href="#/c/trip/${r.id}">
          <span class="avatar" style="background:var(--card-2);color:var(--text)">${kindIcon(r)}</span>
          <span class="grow"><b class="small">${r.kind === 'ride' ? 'Keke ride' : r.kind === 'parcel' ? 'Parcel delivery' : 'Order · ' + esc(r.pickup.label)}</b>
            <span class="xs muted" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.pickup.label)} → ${esc(r.dropoff.label)}</span>
            <span class="row" style="gap:8px;margin-top:4px">${statusBadge(r.status)}<span class="xs muted">${ago(r.createdAt)}</span></span></span>
          <span class="num" style="font-weight:800">${naira(r.price || r.offer)}</span></a></li>`).join('')}</ul>`
          : `<div class="empty">${icon('receipt-text')}<p>No trips or orders yet.</p><a class="btn btn-primary" href="#/c/home">Book a ride</a></div>`}</div>`;
    },
  };

  RC.views['c-account'] = {
    path: 'c/account', title: 'Account', roles: ['customer'],
    render() {
      const u = me();
      const given = S.db.reviews.filter((r) => r.customerId === u.id).sort((a, b) => b.at - a.at);
      const trips = S.db.requests.filter((r) => r.customerId === u.id && r.status === 'completed');
      return `<header class="topbar"><h1>Account</h1></header><div class="page page-narrow stack-lg">
        <div class="card row"><span class="avatar avatar-lg">${initials(u.name)}</span><div class="grow"><h2 style="font-size:20px">${esc(u.name)}</h2><p class="muted small">${esc(u.phone)} · Customer</p></div></div>
        <div class="tiles" style="grid-template-columns:1fr 1fr"><div class="card tile"><span class="muted small">Completed</span><span class="v">${trips.length}</span></div><div class="card tile"><span class="muted small">Spent</span><span class="v">${naira(trips.reduce((s, r) => s + (r.price || 0), 0))}</span></div></div>
        <form class="card stack" data-form="profile"><h3>Profile</h3><div class="field"><label for="pf-name">Full name</label><input class="input" id="pf-name" name="name" value="${esc(u.name)}" autocomplete="name" required></div><button class="btn btn-outline" type="submit">Save</button></form>
        <section class="card stack"><h3>Your reviews</h3>${given.length ? given.map((r) => { const t = r.targetType === 'vendor' ? S.vendor(r.targetId) : S.user(r.targetId); return `<div class="card-flat"><div class="row-between"><b class="small">${esc(t ? t.name : '—')}</b><span class="stars">${icon('star')}${r.stars}</span></div>${r.text ? `<p class="small">${esc(r.text)}</p>` : ''}<p class="xs muted">${ago(r.at)}</p></div>`; }).join('') : '<p class="muted small">Ratings you give riders and stores appear here.</p>'}</section>
        <section class="card stack"><h3>Settings</h3>
          <button class="btn btn-outline" data-act="toggle-theme">${icon('sun-moon')} Toggle dark mode</button>
          ${RC.live ? '' : `<button class="btn btn-outline" data-act="reset-demo">${icon('rotate-ccw')} Reset demo data</button>`}
          <hr class="divider"><button class="btn btn-danger" data-act="logout">${icon('log-out')} Sign out</button></section></div>`;
    },
  };
  RC.forms.profile = (f, fd) => { const name = (fd.get('name') || '').trim(); if (name.length < 3) return toast('Enter your full name.', 'bad'); RC.run(RC.api.updateProfile({ full_name: name }), 'Profile saved'); };
})();
