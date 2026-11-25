/* Vendors: restaurants, supermarkets, retailers — store setup, catalogue, orders */
(function () {
  const { C, S, M, $, esc, naira, icon, initials, ago, fmtTime, stars, me, toast } = RC;
  const VS = { tab: 'new' };
  const myVendor = () => { const u = me(); return u && u.vendorId ? S.vendor(u.vendorId) : null; };

  RC.orderBadge = (s) => ({ placed: '<span class="badge badge-amber">New</span>', preparing: '<span class="badge badge-blue">Preparing</span>', ready: '<span class="badge badge-blue">Ready for pickup</span>', picked_up: '<span class="badge badge-blue">Out for delivery</span>', delivered: '<span class="badge badge-green">Delivered</span>', rejected: '<span class="badge badge-red">Rejected</span>', cancelled: '<span class="badge badge-red">Cancelled</span>' }[s] || s);

  function storeFields(v = {}) {
    const b = v.bank || {};
    return `<div class="grid-2">
      <div class="field" style="grid-column:1/-1"><label for="sf-name" class="req">Business name</label><input class="input" id="sf-name" name="name" value="${esc(v.name)}" required></div>
      <div class="field"><label for="sf-type" class="req">Business type</label><select class="input" id="sf-type" name="type">${Object.entries(RC.vendorTypeLabel).map(([k, l]) => `<option value="${k}" ${v.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="sf-phone" class="req">Business phone</label><input class="input" id="sf-phone" name="phone" type="tel" value="${esc(v.phone || (me() || {}).phone)}" required></div>
      <div class="field" style="grid-column:1/-1"><label for="sf-desc">Short description</label><textarea class="input" id="sf-desc" name="desc" placeholder="What do you sell? What are you known for?">${esc(v.desc)}</textarea></div>
      <div class="field"><label for="sf-loc" class="req">Location in Redemption City</label><select class="input" id="sf-loc" name="loc">${C.LANDMARKS.map((l) => `<option value="${l.id}" ${v.landmark === l.label ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}<option value="gps">Use my current GPS location</option></select><p class="help">Customers and riders use this pin to find you.</p></div>
      <div class="field"><label for="sf-hours">Opening hours</label><input class="input" id="sf-hours" name="hours" value="${esc(v.hours || '8:00am – 8:00pm')}"></div>
      <div class="field"><label for="sf-bank">Bank</label><select class="input" id="sf-bank" name="bankName">${C.BANKS.map((x) => `<option ${b.bankName === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label for="sf-acct">Account number</label><input class="input" id="sf-acct" name="accountNumber" inputmode="numeric" maxlength="10" value="${esc(b.accountNumber)}"></div>
      <div class="field" style="grid-column:1/-1"><label for="sf-acctname">Account name</label><input class="input" id="sf-acctname" name="accountName" value="${esc(b.accountName)}"></div>
      <div class="field" style="grid-column:1/-1"><label for="sf-logo">Logo or shop photo <span class="muted" style="font-weight:500">(optional)</span></label><input class="input" id="sf-logo" name="logo" type="file" accept="image/*"></div>
    </div>
    <label class="switch"><input type="checkbox" name="upfront" ${v.upfront ? 'checked' : ''}><span class="track"></span><span><b>Require payment upfront</b><br><span class="small muted">Customers must transfer to your account before you prepare the order.</span></span></label>`;
  }

  async function readStoreForm(f, fd) {
    const name = (fd.get('name') || '').trim();
    if (name.length < 3) { toast('Enter your business name.', 'bad'); $('#sf-name').focus(); return null; }
    const acct = (fd.get('accountNumber') || '').trim();
    if (acct && !/^\d{10}$/.test(acct)) { toast('Account number must be 10 digits.', 'bad'); $('#sf-acct').focus(); return null; }
    let loc, landmark;
    if (fd.get('loc') === 'gps') { const l = await RC.getMyLocation(true); loc = { lat: l.lat, lng: l.lng }; landmark = l.label.replace('My location · ', ''); }
    else { const l = C.LANDMARKS.find((x) => x.id === fd.get('loc')); loc = { lat: l.lat, lng: l.lng }; landmark = l.label; }
    const logoFile = fd.get('logo');
    const logo = logoFile && logoFile.size ? (await RC.readFileCompressed(logoFile, 240)).preview : undefined;
    const out = { name, type: fd.get('type'), phone: (fd.get('phone') || '').trim(), desc: (fd.get('desc') || '').trim(), loc, landmark, hours: (fd.get('hours') || '').trim(), upfront: !!fd.get('upfront'), bank: { bankName: fd.get('bankName'), accountNumber: acct, accountName: (fd.get('accountName') || '').trim() } };
    if (logo) out.logo = logo;
    return out;
  }

  RC.views['v-onboard'] = {
    path: 'v/onboard', title: 'Set up your store', roles: ['vendor'], nav: false,
    render() {
      return `<div class="page page-narrow stack-lg" style="padding-top:20px">
        <div class="row-between"><div class="brand"><span class="emblem" style="background:#fff url('assets/rccg-emblem.png') center/cover;border-radius:50%;width:40px;height:40px"></span><b>${esc(C.APP_NAME)} for vendors</b></div><button class="btn btn-ghost btn-sm" data-act="logout">${icon('log-out')}<span class="sr-only">Sign out</span></button></div>
        <form class="card stack-lg" style="padding:20px" data-form="store-create" novalidate>
          <div><h1 style="font-size:24px">Set up your store</h1><p class="muted">List your dishes, goods and services so people in Redemption City can order from you.</p></div>
          ${storeFields({})}
          <button class="btn btn-primary btn-block" type="submit">${icon('store')} Create store</button></form></div>`;
    },
  };
  RC.forms['store-create'] = async (f, fd) => {
    const data = await readStoreForm(f, fd); if (!data) return;
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    if (await RC.run(RC.api.createVendor(data), 'Store created! Now add your items.')) RC.go('v/catalogue');
    else b.disabled = false;
  };

  /* ---------------- Orders ---------------- */
  function orderCard(o) {
    const req = o.requestId ? S.request(o.requestId) : null; const rider = req && req.riderId ? S.user(req.riderId) : null;
    const v = myVendor();
    return `<li class="card stack" style="gap:10px">
      <div class="row-between"><div><b>#${o.id.slice(-5).toUpperCase()}</b> · <span class="small muted">${fmtTime(o.createdAt)}</span></div>${RC.orderBadge(o.status)}</div>
      <div class="row"><span class="avatar">${initials(o.customerName)}</span><div class="grow"><b class="small">${esc(o.customerName)}</b><div class="xs muted">Deliver to ${esc(o.dropoff.label)}</div></div><a class="btn btn-icon btn-outline" href="tel:${esc(o.customerPhone)}" aria-label="Call ${esc(o.customerName)}">${icon('phone')}</a></div>
      <div class="card-flat small stack" style="gap:4px">${o.items.map((i) => `<div class="row-between"><span>${i.qty} × ${esc(i.name)}</span><span class="num">${naira(i.price * i.qty)}</span></div>`).join('')}<hr class="divider"><div class="row-between"><b>Total</b><b class="num">${naira(o.subtotal)}</b></div></div>
      ${o.note ? `<div class="banner info">${icon('message-square')}<span>${esc(o.note)}</span></div>` : ''}
      <div class="row wrap small" style="gap:8px"><span class="badge">${o.pay === 'cash' ? 'Cash on delivery' : 'Bank transfer'}</span>
        ${o.pay === 'transfer' ? (o.transfer.confirmed ? '<span class="badge badge-green">Payment confirmed</span>' : o.transfer.sent ? '<span class="badge badge-amber">Customer says sent</span>' : '<span class="badge">Awaiting transfer</span>') : ''}
        <span class="badge ${rider ? 'badge-blue' : ''}">${rider ? `Rider: ${esc(rider.name)}` : req && req.status === 'searching' ? 'Customer choosing a rider' : 'No rider yet'}</span></div>
      ${o.pay === 'transfer' && o.transfer.sent && !o.transfer.confirmed ? `<button class="btn btn-brand btn-sm" data-act="v-confirm-transfer" data-id="${o.id}">${icon('check', 'ic-sm')} Confirm ${naira(o.subtotal)} received</button>` : ''}
      ${o.status === 'placed' ? `<div class="row"><button class="btn btn-danger" data-act="v-order" data-s="rejected" data-id="${o.id}">Reject</button><button class="btn btn-primary grow" data-act="v-order" data-s="preparing" data-id="${o.id}">Accept order</button></div>${v.upfront && !o.transfer.confirmed ? '<p class="xs muted">Upfront payment is on: you can accept now and start preparing once the transfer is confirmed.</p>' : ''}` : ''}
      ${o.status === 'preparing' ? `<button class="btn btn-primary" data-act="v-order" data-s="ready" data-id="${o.id}">${icon('package-check')} Mark ready for pickup</button>` : ''}
    </li>`;
  }

  RC.views['v-orders'] = {
    path: 'v/orders', title: 'Orders', roles: ['vendor'], requiresStore: true, live: true,
    render() {
      const v = myVendor(); const all = S.db.orders.filter((o) => o.vendorId === v.id).sort((a, b) => b.createdAt - a.createdAt);
      const groups = { new: all.filter((o) => o.status === 'placed'), active: all.filter((o) => ['preparing', 'ready', 'picked_up'].includes(o.status)), done: all.filter((o) => ['delivered', 'rejected', 'cancelled'].includes(o.status)) };
      const today = all.filter((o) => o.status === 'delivered' && new Date(o.createdAt).toDateString() === new Date().toDateString());
      const list = groups[VS.tab];
      return `<header class="topbar"><h1 class="grow">Orders</h1><label class="switch small"><input type="checkbox" data-change="v-open" ${v.open ? 'checked' : ''}><span class="track"></span>${v.open ? 'Open' : 'Closed'}</label></header>
      <div class="page stack-lg">
        <div class="tiles"><div class="card tile"><span class="muted small">New</span><span class="v">${groups.new.length}</span></div><div class="card tile"><span class="muted small">In progress</span><span class="v">${groups.active.length}</span></div>
          <div class="card tile"><span class="muted small">Sales today</span><span class="v">${naira(today.reduce((s, o) => s + o.subtotal, 0))}</span></div><div class="card tile"><span class="muted small">Rating</span><span class="v" style="font-size:18px">${stars('vendor', v.id)}</span></div></div>
        <div class="tabs" role="tablist">${[['new', 'New'], ['active', 'In progress'], ['done', 'Completed']].map(([k, l]) => `<button role="tab" aria-selected="${VS.tab === k}" data-act="v-tab" data-tab="${k}">${l} (${groups[k].length})</button>`).join('')}</div>
        ${list.length ? `<ul class="list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">${list.map(orderCard).join('')}</ul>` : `<div class="empty">${icon('inbox')}<p>${VS.tab === 'new' ? 'No new orders. They appear here instantly when customers check out.' : 'Nothing here yet.'}</p></div>`}
      </div>`;
    },
  };
  Object.assign(RC.actions, {
    'v-tab': (el) => { VS.tab = el.dataset.tab; RC.refresh(); },
    'v-order': async (el) => {
      const s = el.dataset.s;
      if (s === 'rejected' && !(await RC.confirmDialog('Reject this order?', 'The customer will be notified and the delivery request cancelled.', 'Reject order', true))) return;
      RC.run(RC.api.vendorOrderStatus(el.dataset.id, s), s === 'preparing' ? 'Order accepted' : s === 'ready' ? 'Marked ready. The rider has been notified.' : 'Order rejected');
    },
    'v-confirm-transfer': (el) => RC.run(RC.api.confirmTransfer('order', el.dataset.id), 'Payment confirmed'),
  });
  RC.changes['v-open'] = (el) => RC.run(RC.api.updateVendor(me().vendorId, { open: el.checked }), el.checked ? 'Store is open' : 'Store is closed');

  /* ---------------- Catalogue ---------------- */
  RC.views['v-catalogue'] = {
    path: 'v/catalogue', title: 'Catalogue', roles: ['vendor'], requiresStore: true, live: true,
    render() {
      const v = myVendor(); const prods = S.db.products.filter((p) => p.vendorId === v.id);
      return `<header class="topbar"><h1 class="grow">Catalogue</h1><button class="btn btn-primary btn-sm" data-act="prod-edit">${icon('plus', 'ic-sm')} Add item</button></header>
      <div class="page stack">
        <p class="muted small">${prods.length} items · Set prices and availability. Changes show to customers right away.</p>
        ${prods.length ? `<ul class="list">${prods.map((p) => `<li class="card prod" style="grid-template-columns:64px 1fr auto;align-items:center">
          <span class="pimg" style="width:64px;height:64px">${p.img ? `<img src="${p.img}" alt="">` : icon(RC.vendorIcon[v.type])}</span>
          <div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.category || '')} · <span class="num" style="color:var(--text);font-weight:700">${naira(p.price)}</span></div>
            <label class="switch small"><input type="checkbox" data-change="prod-avail" data-id="${p.id}" ${p.available ? 'checked' : ''}><span class="track"></span>${p.available ? 'Available' : 'Sold out'}</label></div>
          <div class="row" style="gap:4px"><button class="btn btn-icon btn-ghost" data-act="prod-edit" data-id="${p.id}" aria-label="Edit ${esc(p.name)}">${icon('pencil')}</button><button class="btn btn-icon btn-ghost" data-act="prod-del" data-id="${p.id}" aria-label="Delete ${esc(p.name)}" style="color:var(--danger)">${icon('trash-2')}</button></div></li>`).join('')}</ul>`
          : `<div class="empty">${icon('package')}<p>Your catalogue is empty. Add your first dish, product or service.</p><button class="btn btn-primary" data-act="prod-edit">${icon('plus')} Add item</button></div>`}
      </div>`;
    },
  };
  Object.assign(RC.actions, {
    'prod-edit': (el) => {
      const p = el.dataset.id ? S.db.products.find((x) => x.id === el.dataset.id) : {};
      RC.modal(`<form class="stack" data-form="prod-save" data-id="${p.id || ''}" novalidate>
        <div class="row-between"><h3>${p.id ? 'Edit item' : 'Add item'}</h3><button type="button" class="btn btn-icon btn-ghost" data-act="close-modal" aria-label="Close">${icon('x')}</button></div>
        <div class="field"><label for="pe-name" class="req">Name</label><input class="input" id="pe-name" name="name" value="${esc(p.name)}" required placeholder="e.g. Jollof rice & chicken"></div>
        <div class="grid-2"><div class="field"><label for="pe-price" class="req">Price (₦)</label><input class="input" id="pe-price" name="price" inputmode="numeric" value="${p.price || ''}" required></div>
          <div class="field"><label for="pe-cat">Category</label><input class="input" id="pe-cat" name="category" value="${esc(p.category)}" placeholder="e.g. Mains, Provisions, Services" list="pe-cats"><datalist id="pe-cats">${[...new Set(S.db.products.filter((x) => x.vendorId === me().vendorId).map((x) => x.category))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div></div>
        <div class="field"><label for="pe-desc">Description</label><textarea class="input" id="pe-desc" name="desc">${esc(p.desc)}</textarea></div>
        <div class="field"><label for="pe-img">Photo</label><input class="input" id="pe-img" name="img" type="file" accept="image/*"></div>
        <label class="check"><input type="checkbox" name="available" ${p.id ? (p.available ? 'checked' : '') : 'checked'}><span>Available to order</span></label>
        <button class="btn btn-primary" type="submit">Save item</button></form>`, { label: 'Edit item' });
    },
    'prod-del': async (el) => {
      const p = S.db.products.find((x) => x.id === el.dataset.id);
      if (!(await RC.confirmDialog('Delete item?', `“${p.name}” will be removed from your catalogue.`, 'Delete', true))) return;
      RC.run(RC.api.deleteProduct(p.id), 'Item deleted');
    },
  });
  RC.forms['prod-save'] = async (f, fd) => {
    const name = (fd.get('name') || '').trim(); const price = Number((fd.get('price') || '').replace(/\D/g, ''));
    if (!name) { toast('Enter a name.', 'bad'); $('#pe-name').focus(); return; }
    if (!price) { toast('Enter a price.', 'bad'); $('#pe-price').focus(); return; }
    const imgF = fd.get('img'); const img = imgF && imgF.size ? (await RC.readFileCompressed(imgF, 360)).preview : undefined;
    const data = { name, price, category: (fd.get('category') || '').trim() || 'Other', desc: (fd.get('desc') || '').trim(), available: !!fd.get('available') };
    if (img) data.img = img;
    const b = f.querySelector('[type=submit]'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Saving…';
    if (await RC.run(RC.api.saveProduct(f.dataset.id || null, me().vendorId, data), 'Item saved')) RC.closeModal();
    else { b.disabled = false; b.textContent = 'Save item'; }
  };
  RC.changes['prod-avail'] = (el) => RC.run(RC.api.setProductAvailable(el.dataset.id, el.checked));

  /* ---------------- Store profile ---------------- */
  RC.views['v-account'] = {
    path: 'v/account', title: 'Store', roles: ['vendor'], requiresStore: true,
    render() {
      const v = myVendor(); const rv = S.rating('vendor', v.id);
      return `<header class="topbar"><h1>Store profile</h1></header><div class="page page-narrow stack-lg">
        <div class="hero-vendor">${RC.vLogo(v)}<div><h2 style="color:#fff">${esc(v.name)}</h2><p class="small" style="opacity:.85">${RC.vendorTypeLabel[v.type]} · ${esc(v.landmark)}</p><p class="small" style="opacity:.95">${rv.count ? `★ ${rv.avg.toFixed(1)} from ${rv.count} reviews` : 'No reviews yet'}</p></div></div>
        <form class="card stack-lg" data-form="store-save" novalidate><h3>Details</h3>${storeFields(v)}<button class="btn btn-primary" type="submit">Save changes</button></form>
        <section class="card stack"><h3>Reviews</h3>${rv.list.map((r) => `<div class="card-flat"><div class="row-between"><b class="small">${esc(r.customerName || 'Customer')}</b><span class="stars">${icon('star')}${r.stars}</span></div>${r.text ? `<p class="small">${esc(r.text)}</p>` : ''}<p class="xs muted">${ago(r.at)}</p></div>`).join('') || '<p class="muted small">Reviews from customers appear here.</p>'}</section>
        <section class="card stack"><button class="btn btn-outline" data-act="toggle-theme">${icon('sun-moon')} Toggle dark mode</button><hr class="divider"><button class="btn btn-danger" data-act="logout">${icon('log-out')} Sign out</button></section></div>`;
    },
  };
  RC.forms['store-save'] = async (f, fd) => {
    const data = await readStoreForm(f, fd); if (!data) return;
    if (await RC.run(RC.api.updateVendor(me().vendorId, data), 'Store updated')) RC.render();
  };
})();
