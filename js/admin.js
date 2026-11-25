/* Admin: rider KYC approvals, live operations map, directory */
(function () {
  const { C, S, M, $, esc, naira, icon, initials, ago, fmtTime, stars, toast } = RC;
  const AS = { tab: 'pending', dir: 'riders', map: null, layers: [] };
  const riders = () => S.db.users.filter((u) => RC.isRider(u));

  RC.views['a-approvals'] = {
    path: 'a/approvals', title: 'Approvals', roles: ['admin'], live: true,
    render() {
      const all = riders().filter((u) => u.kyc && u.kyc.status !== 'none');
      const groups = { pending: all.filter((u) => u.kyc.status === 'pending'), approved: all.filter((u) => u.kyc.status === 'approved'), rejected: all.filter((u) => u.kyc.status === 'rejected') };
      const reqs = S.db.requests; const today = new Date().toDateString();
      const doneToday = reqs.filter((r) => r.status === 'completed' && new Date(r.completedAt).toDateString() === today);
      const list = groups[AS.tab].sort((a, b) => (b.kyc.submittedAt || 0) - (a.kyc.submittedAt || 0));
      return `<header class="topbar"><h1>Rider approvals</h1></header><div class="page stack-lg">
        <div class="tiles">
          <div class="card tile"><span class="muted small">Pending review</span><span class="v">${groups.pending.length}</span></div>
          <div class="card tile"><span class="muted small">Riders online</span><span class="v">${riders().filter((u) => u.online && u.kyc.status === 'approved').length}</span></div>
          <div class="card tile"><span class="muted small">Active jobs</span><span class="v">${reqs.filter((r) => RC.ACTIVE.includes(r.status)).length}</span></div>
          <div class="card tile"><span class="muted small">Trip value today</span><span class="v">${naira(doneToday.reduce((s, r) => s + r.price, 0))}</span></div></div>
        <div class="tabs" role="tablist">${[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([k, l]) => `<button role="tab" aria-selected="${AS.tab === k}" data-act="a-tab" data-tab="${k}">${l} (${groups[k].length})</button>`).join('')}</div>
        ${list.length ? `<ul class="list">${list.map((u) => `<li><a class="card card-link row" href="#/a/review/${u.id}"><span class="avatar">${u.kyc.docs && u.kyc.docs.passport && u.kyc.docs.passport.preview ? `<img src="${u.kyc.docs.passport.preview}" alt="">` : initials(u.name)}</span>
          <span class="grow"><b>${esc(u.name)}</b><span class="xs muted" style="display:block">${RC.roleLabel[u.role]} · ${esc(u.phone)} · ${u.vehicle ? esc(u.vehicle.model + (u.vehicle.plate && u.vehicle.plate !== '—' ? ' · ' + u.vehicle.plate : '')) : ''}</span>
          <span class="xs muted">Submitted ${u.kyc.submittedAt ? ago(u.kyc.submittedAt) : '—'} · ${Object.keys(u.kyc.docs || {}).length} documents</span></span>${icon('chevron-right')}</a></li>`).join('')}</ul>`
          : `<div class="empty">${icon('shield-check')}<p>${AS.tab === 'pending' ? 'All caught up. No applications waiting.' : 'Nothing here.'}</p></div>`}
      </div>`;
    },
  };

  const LABELS = { fullName: 'Full name', dob: 'Date of birth', email: 'Email', stateOrigin: 'State of origin', address: 'Address', nin: 'NIN', licenceNo: "Driver's licence no.", licenceExpiry: 'Licence expiry', lasdriNo: 'LASDRI no.', unionId: 'Union ID', experience: 'Experience', smartphone: 'Smartphone', make: 'Make / type', model: 'Model', year: 'Year', colour: 'Colour', plate: 'Plate', chassis: 'Chassis / VIN', box: 'Delivery box', guarantorName: 'Guarantor', guarantorPhone: 'Guarantor phone', guarantorRel: 'Relationship', guarantorAddress: 'Guarantor address', bankName: 'Bank', accountNumber: 'Account no.', accountName: 'Account name' };
  const DOCS = { passport: 'Passport photo', ninSlip: 'NIN slip', licence: "Driver's licence", lasdri: 'LASDRI card', hackney: 'Hackney permit', utility: 'Proof of address', vehicleLicence: 'Vehicle licence', ownership: 'Proof of ownership', roadworthy: 'Roadworthiness', insurance: 'Insurance', photoFront: 'Vehicle – front', photoSide: 'Vehicle – side', guarantorId: "Guarantor's ID" };

  RC.views['a-review'] = {
    path: 'a/review/:id', title: 'Review application', roles: ['admin'], navKey: 'a/approvals', live: true,
    render({ id }) {
      const u = S.user(id); if (!u) return '<div class="page empty">Not found.</div>';
      const k = u.kyc; const d = k.data || {}; const docs = k.docs || {};
      const age = d.dob ? Math.floor((Date.now() - new Date(d.dob)) / 31557600000) : null;
      const expired = d.licenceExpiry && new Date(d.licenceExpiry) < new Date();
      return `<header class="topbar"><a class="btn btn-icon btn-ghost" href="#/a/approvals" aria-label="Back">${icon('arrow-left')}</a><h1 class="grow" style="font-size:20px">${esc(u.name)}</h1>${k.status === 'pending' ? '<span class="badge badge-amber">Pending</span>' : k.status === 'approved' ? '<span class="badge badge-green">Approved</span>' : '<span class="badge badge-red">Rejected</span>'}</header>
      <div class="page stack-lg">
        <div class="card row"><span class="avatar avatar-lg">${docs.passport && docs.passport.preview ? `<img src="${docs.passport.preview}" alt="Passport photo">` : initials(u.name)}</span>
          <div class="grow"><b>${esc(u.name)}</b><div class="small muted">${RC.roleLabel[u.role]} · ${esc(u.phone)}${age != null ? ` · ${age} yrs` : ''}</div><div class="small muted">Submitted ${k.submittedAt ? fmtTime(k.submittedAt) : '—'}</div></div></div>
        ${expired ? `<div class="banner bad">${icon('alert-triangle')}<span>Driver's licence expired on ${esc(d.licenceExpiry)}.</span></div>` : ''}
        ${k.status === 'rejected' ? `<div class="banner bad">${icon('x-circle')}<span><b>Rejected:</b> ${esc(k.reason)}</span></div>` : ''}
        <section class="card stack"><h3>Documents</h3>
          <div class="doc-thumbs">${Object.entries(DOCS).filter(([key]) => docs[key]).map(([key, label]) => `<button class="doc-thumb" data-act="view-doc" data-title="${esc(label)}" data-src="${docs[key].preview || ''}" data-name="${esc(docs[key].name)}">${docs[key].preview ? `<img src="${docs[key].preview}" alt="">` : `<span class="ph">${icon('file-text')}</span>`}<b>${esc(label)}</b></button>`).join('') || '<p class="muted small">No uploads (seeded demo applicant).</p>'}</div></section>
        <section class="card stack"><h3>Submitted information</h3><dl class="kv">${Object.entries(LABELS).filter(([key]) => d[key]).map(([key, label]) => `<dt>${label}</dt><dd>${esc(d[key])}</dd>`).join('')}</dl></section>
        <section class="card stack"><h3>Verification checklist</h3>
          ${['NIN matches name and photo (NIMC lookup)', ...(u.role === 'keke' ? ["Driver's licence valid (FRSC)", 'LASDRI card verified', 'Vehicle licence, ownership and insurance match plate', 'Roadworthiness certificate current'] : ['Bicycle is in good condition']), 'Guarantor contacted', 'Bank account name matches applicant'].map((t, i) => `<label class="check"><input type="checkbox" name="chk${i}"><span>${t}</span></label>`).join('')}
          <p class="xs muted">Checklist is a guide for reviewers and isn't saved in this demo.</p></section>
        ${k.status !== 'approved' ? `<div class="row wrap"><button class="btn btn-danger" data-act="a-reject" data-id="${u.id}">${icon('x')} Reject</button><button class="btn btn-primary grow" data-act="a-approve" data-id="${u.id}">${icon('check')} Approve rider</button></div>`
          : `<div class="row wrap"><span class="banner ok grow">${icon('check-circle-2')}<span>Approved ${k.reviewedAt ? ago(k.reviewedAt) : ''}. The rider can go online.</span></span><button class="btn btn-danger" data-act="a-revoke" data-id="${u.id}">Suspend</button></div>`}
      </div>`;
    },
  };
  Object.assign(RC.actions, {
    'a-tab': (el) => { AS.tab = el.dataset.tab; RC.refresh(); },
    'a-approve': async (el) => {
      if (!(await RC.confirmDialog('Approve this rider?', 'They will be able to go online and receive requests.', 'Approve'))) return;
      if (await RC.run(RC.api.reviewRider(el.dataset.id, 'approve'), 'Rider approved')) RC.go('a/approvals');
    },
    'a-reject': (el) => {
      RC.modal(`<form class="stack" data-form="a-reject" data-id="${el.dataset.id}" novalidate><div class="row-between"><h3>Reject application</h3><button type="button" class="btn btn-icon btn-ghost" data-act="close-modal" aria-label="Close">${icon('x')}</button></div>
        <div class="field"><label for="rj" class="req">Reason (shown to the rider)</label><textarea class="input" id="rj" name="reason" required placeholder="e.g. Licence photo is blurry. Please upload a clearer picture." aria-describedby="rj-err"></textarea><p class="err" id="rj-err" role="alert"></p></div>
        <div class="chips">${['Blurry document photo', 'Licence expired', 'Plate does not match vehicle licence', 'Guarantor unreachable'].map((t) => `<button type="button" class="chip" data-act="rj-fill" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <button class="btn btn-danger-solid" type="submit">Reject application</button></form>`, { label: 'Reject application' });
    },
    'rj-fill': (el) => { $('#rj').value = el.dataset.t; },
    'a-revoke': async (el) => {
      if (!(await RC.confirmDialog('Suspend rider?', 'They will be taken offline and must be re-reviewed.', 'Suspend', true))) return;
      RC.run(RC.api.reviewRider(el.dataset.id, 'suspend', 'Account suspended by admin. Contact support.'), 'Rider suspended');
    },
  });
  RC.forms['a-reject'] = (f, fd) => {
    const reason = (fd.get('reason') || '').trim();
    if (reason.length < 5) { $('#rj-err').textContent = 'Give the rider a clear reason so they can fix it.'; $('#rj').focus(); return; }
    RC.run(RC.api.reviewRider(f.dataset.id, 'reject', reason), 'Application rejected').then((ok) => { if (ok) { RC.closeModal(); RC.go('a/approvals'); } });
  };

  /* ---------------- Live map ---------------- */
  function syncAdminMap() {
    const m = AS.map; if (!m) return;
    AS.layers.forEach((l) => l.remove()); AS.layers = [];
    S.db.vendors.forEach((v) => AS.layers.push(m.marker(v.loc, 'store', null)));
    riders().filter((u) => u.online && u.loc).forEach((u) => AS.layers.push(m.marker(u.loc, u.role, u.name.split(' ')[0])));
    S.db.requests.filter((r) => RC.ACTIVE.includes(r.status)).forEach((r) => {
      AS.layers.push(m.line(r.path, { color: '#098A44', weight: 3 }));
      AS.layers.push(m.marker(r.pickup, 'pickup')); AS.layers.push(m.marker(r.dropoff, 'dropoff'));
      const p = RC.riderPosition(r); if (p && r.riderId) AS.layers.push(m.marker(p, r.vehicle, null));
    });
  }
  RC.views['a-map'] = {
    path: 'a/map', title: 'Live map', roles: ['admin'], map: true,
    mapTop: () => `<span class="pill pill-status">${icon('radio', 'ic-sm')} Live operations</span>`,
    sheet() {
      const active = S.db.requests.filter((r) => RC.ACTIVE.includes(r.status)).sort((a, b) => b.createdAt - a.createdAt);
      const on = riders().filter((u) => u.online && u.kyc.status === 'approved');
      return `<div class="stack"><h2 style="font-size:20px">Live operations</h2>
        <div class="tiles" style="grid-template-columns:1fr 1fr"><div class="card tile"><span class="muted small">Keke online</span><span class="v">${on.filter((u) => u.role === 'keke').length}</span></div><div class="card tile"><span class="muted small">Dispatch online</span><span class="v">${on.filter((u) => u.role === 'bike').length}</span></div></div>
        <h3>Active requests (${active.length})</h3>
        ${active.length ? `<ul class="list">${active.map((r) => { const c = S.user(r.customerId); const rd = r.riderId && S.user(r.riderId); return `<li class="card-flat small stack" style="gap:4px"><div class="row-between"><b>${r.kind}</b>${RC.statusBadge(r.status)}</div><span>${esc(r.pickup.label)} → ${esc(r.dropoff.label)}</span><span class="muted">${esc(c ? c.name : '')}${rd ? ' · ' + esc(rd.name) : ''} · ${naira(r.price || r.offer)}</span></li>`; }).join('')}</ul>` : '<p class="muted small">No active requests.</p>'}</div>`;
    },
    async mount() { AS.map = await M.create($('#map'), { center: C.CENTER, zoom: 15 }); AS.layers = []; syncAdminMap(); },
    sync: syncAdminMap,
    tick() { if (Date.now() % 3000 < 1000) syncAdminMap(); },
    unmount() { if (AS.map) AS.map.destroy(); AS.map = null; AS.layers = []; },
  };

  /* ---------------- Directory ---------------- */
  RC.views['a-directory'] = {
    path: 'a/directory', title: 'Directory', roles: ['admin'], live: true,
    render() {
      const db = S.db;
      const tab = AS.dir;
      let body = '';
      if (tab === 'riders') body = `<table class="tbl"><thead><tr><th>Name</th><th>Type</th><th>Vehicle</th><th>Rating</th><th>Status</th></tr></thead><tbody>${riders().map((u) => `<tr><td><a href="#/a/review/${u.id}">${esc(u.name)}</a><div class="xs muted">${esc(u.phone)}</div></td><td>${RC.roleLabel[u.role]}</td><td>${esc(u.vehicle ? u.vehicle.model : '—')}</td><td>${stars('user', u.id)}</td><td>${u.kyc.status === 'approved' ? (u.online ? '<span class="badge badge-green">Online</span>' : '<span class="badge">Offline</span>') : `<span class="badge badge-amber">${esc(u.kyc.status)}</span>`}</td></tr>`).join('')}</tbody></table>`;
      if (tab === 'vendors') body = `<table class="tbl"><thead><tr><th>Store</th><th>Type</th><th>Items</th><th>Rating</th><th>Visible</th></tr></thead><tbody>${db.vendors.map((v) => `<tr><td><b>${esc(v.name)}</b><div class="xs muted">${esc(v.landmark || '')}</div></td><td>${RC.vendorTypeLabel[v.type]}</td><td class="num">${db.products.filter((p) => p.vendorId === v.id).length}</td><td>${stars('vendor', v.id)}</td><td><label class="switch small"><input type="checkbox" data-change="a-suspend-vendor" data-id="${v.id}" ${v.suspended ? '' : 'checked'}><span class="track"></span><span class="sr-only">Visible to customers</span></label></td></tr>`).join('')}</tbody></table>`;
      if (tab === 'customers') body = `<table class="tbl"><thead><tr><th>Name</th><th>Phone</th><th>Requests</th><th>Joined</th></tr></thead><tbody>${db.users.filter((u) => u.role === 'customer').map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.phone)}</td><td class="num">${db.requests.filter((r) => r.customerId === u.id).length}</td><td>${ago(u.createdAt)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No customers yet.</td></tr>'}</tbody></table>`;
      if (tab === 'trips') body = `<table class="tbl"><thead><tr><th>When</th><th>Type</th><th>Route</th><th>Status</th><th style="text-align:right">Fare</th></tr></thead><tbody>${db.requests.slice().sort((a, b) => b.createdAt - a.createdAt).map((r) => `<tr><td>${fmtTime(r.createdAt)}</td><td>${r.kind}</td><td>${esc(r.pickup.label)} → ${esc(r.dropoff.label)}</td><td>${RC.statusBadge(r.status)}</td><td class="num" style="text-align:right">${naira(r.price || r.offer)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No trips yet.</td></tr>'}</tbody></table>`;
      return `<header class="topbar"><h1>Directory</h1></header><div class="page stack-lg">
        <div class="tabs" role="tablist">${[['riders', 'Riders'], ['vendors', 'Vendors'], ['customers', 'Customers'], ['trips', 'Trips & orders']].map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-act="a-dir" data-tab="${k}">${l}</button>`).join('')}</div>
        <div class="card tbl-wrap">${body}</div></div>`;
    },
  };
  RC.actions['a-dir'] = (el) => { AS.dir = el.dataset.tab; RC.refresh(); };
  RC.changes['a-suspend-vendor'] = (el) => RC.run(RC.api.updateVendor(el.dataset.id, { suspended: !el.checked }), el.checked ? 'Store visible to customers' : 'Store hidden from customers');
})();
