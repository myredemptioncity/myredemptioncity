/* Riders (Keke + bicycle dispatch): KYC onboarding, live dashboard, offers, jobs */
(function () {
  const { C, S, M, $, $$, esc, naira, icon, vehicleSvg, initials, ago, fmtTime, stars, me, toast } = RC;

  /* ======================= KYC ONBOARDING ======================= */
  const T = (name, label, opts = {}) => ({ name, label, type: 'text', required: true, ...opts });
  function steps(role) {
    const keke = role === 'keke';
    return [
      { key: 'personal', title: 'Personal', heading: 'Personal details', fields: [
        T('fullName', 'Full name (as on ID)', { autocomplete: 'name' }), T('dob', 'Date of birth', { type: 'date' }),
        T('email', 'Email', { type: 'email', required: false, autocomplete: 'email' }), T('stateOrigin', 'State of origin', { type: 'select', options: ['Lagos', 'Ogun', 'Oyo', 'Osun', 'Ondo', 'Ekiti', 'Kwara', 'Edo', 'Delta', 'Anambra', 'Imo', 'Enugu', 'Abia', 'Rivers', 'Benue', 'Kogi', 'Kano', 'Kaduna', 'FCT', 'Other'] }),
        T('address', 'Residential address', { type: 'textarea', full: true, autocomplete: 'street-address' }),
        T('nin', 'NIN (National Identification Number)', { inputmode: 'numeric', maxlength: 11, help: '11 digits from your NIN slip or NIMC app.', pattern: /^\d{11}$/, patternMsg: 'NIN must be exactly 11 digits.' }),
      ], docs: [['passport', 'Passport photograph', true], ['ninSlip', 'NIN slip / ID card', true]] },
      keke
        ? { key: 'licence', title: 'Licence', heading: 'Licence & permits', note: 'These match what Lagos State asks commercial tricycle operators for. Check the current list with LASG/LASDRI before launch.', fields: [
            T('licenceNo', "Driver's licence number"), T('licenceExpiry', 'Licence expiry date', { type: 'date' }),
            T('lasdriNo', 'LASDRI card number', { help: 'Lagos State Drivers Institute certification.' }), T('unionId', 'Tricycle union / association ID', { required: false }),
          ], docs: [['licence', "Driver's licence (front)", true], ['lasdri', 'LASDRI card', true], ['hackney', 'Hackney / commercial permit', true]] }
        : { key: 'identity', title: 'Riding', heading: 'Riding experience', fields: [
            T('experience', 'Years of riding experience', { type: 'select', options: ['Less than 1 year', '1–2 years', '3–5 years', '5+ years'] }),
            T('smartphone', 'Do you have an Android/iPhone with data?', { type: 'select', options: ['Yes', 'No'] }),
          ], docs: [['utility', 'Proof of address (utility bill)', false]] },
      keke
        ? { key: 'vehicle', title: 'Tricycle', heading: 'Tricycle details', fields: [
            T('make', 'Make', { type: 'select', options: ['Bajaj', 'TVS', 'Piaggio', 'Lifan', 'Other'] }), T('model', 'Model', { placeholder: 'e.g. RE 4S' }),
            T('year', 'Year', { inputmode: 'numeric', maxlength: 4, pattern: /^(19|20)\d{2}$/, patternMsg: 'Enter a 4-digit year.' }), T('colour', 'Colour'),
            T('plate', 'Plate number', { placeholder: 'e.g. MWE-123-AB', pattern: /^[A-Za-z]{2,3}[- ]?\d{2,3}[- ]?[A-Za-z]{2,3}$/, patternMsg: 'Use the format ABC-123-XY.' }),
            T('chassis', 'Chassis / VIN number'),
          ], docs: [['vehicleLicence', 'Vehicle licence', true], ['ownership', 'Proof of ownership / registration', true], ['roadworthy', 'Roadworthiness certificate', true], ['insurance', 'Third-party insurance', true], ['photoFront', 'Tricycle photo – front', true], ['photoSide', 'Tricycle photo – side', true]] }
        : { key: 'vehicle', title: 'Bicycle', heading: 'Bicycle details', fields: [
            T('make', 'Type', { type: 'select', options: ['Bicycle', 'Bicycle with carrier box', 'E-bike'] }), T('colour', 'Colour'),
            T('box', 'Delivery box / bag', { type: 'select', options: ['Insulated food box', 'Delivery bag', 'None yet'] }),
          ], docs: [['photoFront', 'Bicycle photo', true]] },
      { key: 'guarantor', title: 'Payout', heading: 'Guarantor & payout', fields: [
        T('guarantorName', 'Guarantor full name'), T('guarantorPhone', 'Guarantor phone', { type: 'tel', pattern: /^0[789][01]\d{8}$/, patternMsg: 'Enter a valid 11-digit number.' }),
        T('guarantorRel', 'Relationship', { placeholder: 'e.g. Pastor, Uncle, Employer' }), T('guarantorAddress', 'Guarantor address', { type: 'textarea', full: true }),
        T('bankName', 'Bank', { type: 'select', options: C.BANKS }), T('accountNumber', 'Account number (NUBAN)', { inputmode: 'numeric', maxlength: 10, pattern: /^\d{10}$/, patternMsg: 'Account number must be 10 digits.' }),
        T('accountName', 'Account name'),
      ], docs: [['guarantorId', "Guarantor's ID", false]], upfront: true },
      { key: 'review', title: 'Submit', heading: 'Review & submit' },
    ];
  }

  const val = (u, k) => (u.kyc.data || {})[k] || '';
  function fieldHTML(f, u) {
    const id = 'k-' + f.name; const v = esc(val(u, f.name));
    const common = `id="${id}" name="${f.name}" data-input="kyc" data-k="${f.name}" ${f.required ? 'required aria-required="true"' : ''} aria-describedby="${id}-err ${f.help ? id + '-help' : ''}" ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''}`;
    let input;
    if (f.type === 'select') input = `<select class="input" ${common} data-change="kyc"><option value="">Select…</option>${f.options.map((o) => `<option ${val(u, f.name) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea class="input" ${common}>${v}</textarea>`;
    else input = `<input class="input" type="${f.type}" ${common} value="${v}" ${f.inputmode ? `inputmode="${f.inputmode}"` : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`;
    return `<div class="field" ${f.full ? 'style="grid-column:1/-1"' : ''}><label for="${id}" class="${f.required ? 'req' : ''}">${esc(f.label)}</label>${input}${f.help ? `<p class="help" id="${id}-help">${esc(f.help)}</p>` : ''}<p class="err" id="${id}-err" role="alert"></p></div>`;
  }
  function uploadTile(key, label, required, u) {
    const d = (u.kyc.docs || {})[key];
    if (key === 'passport') {
      // Identity photo must be taken live with the camera (no gallery upload).
      return `<button type="button" class="upload camera ${d ? 'has' : ''}" id="up-${key}" data-act="kyc-camera" aria-describedby="up-${key}-err">
        ${d && d.preview ? `<img class="thumb" src="${d.preview}" alt="Your passport photo">` : `<span style="color:var(--muted)">${icon('camera', 'ic-lg')}</span>`}
        <span><b class="${required ? 'req' : ''}">${esc(label)}</b><span class="fname" style="display:block">${d ? 'Taken with camera · tap to retake' : 'Take a live photo with your camera'}</span></span>
        <span class="err" id="up-${key}-err" role="alert"></span></button>`;
    }
    return `<label class="upload ${d ? 'has' : ''}" id="up-${key}" for="file-${key}">
      <input type="file" id="file-${key}" accept="image/*,application/pdf" data-change="kyc-doc" data-k="${key}" aria-describedby="up-${key}-err">
      ${d && d.preview ? `<img class="thumb" src="${d.preview}" alt="">` : `<span style="color:var(--muted)">${icon(d ? 'file-check-2' : 'upload')}</span>`}
      <span><b class="${required ? 'req' : ''}">${esc(label)}</b><span class="fname" style="display:block">${d ? esc(d.name) : 'Tap to upload a photo or PDF'}</span></span>
      <span class="err" id="up-${key}-err" role="alert"></span></label>`;
  }

  function pendingScreen(u) {
    const k = u.kyc; const rejected = k.status === 'rejected';
    const docs = Object.entries(k.docs || {});
    return `<div class="page page-narrow stack-lg" style="padding-top:24px">
      <div class="row-between"><div class="brand"><span class="emblem" style="background:#fff url('assets/rccg-emblem.png') center/cover;border-radius:50%;width:40px;height:40px"></span><b>${esc(C.APP_NAME)}</b></div><button class="btn btn-ghost btn-sm" data-act="logout">${icon('log-out')} Sign out</button></div>
      <div class="card stack-lg" style="padding:24px">
        <div class="row"><span class="avatar avatar-lg" style="background:${rejected ? 'var(--danger)' : 'var(--warn)'}">${icon(rejected ? 'x' : 'hourglass')}</span>
          <div><h1 style="font-size:24px">${rejected ? 'Application needs changes' : 'Application under review'}</h1><p class="muted small">Submitted ${ago(k.submittedAt)}</p></div></div>
        ${rejected ? `<div class="banner bad">${icon('alert-circle')}<span><b>Reason from admin:</b> ${esc(k.reason || 'Not specified')}</span></div>` : `<p>Our team is checking your documents. It usually takes a few hours. We'll unlock your dashboard as soon as you're approved.</p>`}
        <ol class="timeline"><li class="done"><span class="tdot">${icon('check', 'ic-sm')}</span><b>Application submitted</b></li>
          <li class="${rejected ? 'done' : 'now'}"><span class="tdot">${rejected ? icon('check', 'ic-sm') : '2'}</span><b>Document verification</b></li>
          <li class="${rejected ? 'now' : ''}"><span class="tdot">3</span><b>${rejected ? 'Fix and resubmit' : 'Approved: start receiving orders'}</b></li></ol>
        <div><h3 style="margin-bottom:8px">Documents (${docs.length})</h3><div class="doc-thumbs">${docs.map(([key, d]) => `<button class="doc-thumb" data-act="view-doc" data-title="${esc(key)}" data-src="${d.preview || ''}" data-name="${esc(d.name)}">${d.preview ? `<img src="${d.preview}" alt="">` : `<span class="ph">${icon('file-text')}</span>`}<span>${esc(d.name)}</span></button>`).join('') || '<p class="muted small">None</p>'}</div></div>
        ${rejected ? `<button class="btn btn-primary btn-block" data-act="kyc-edit">${icon('pencil')} Edit and resubmit</button>` : `<div class="banner info">${icon('info')}<span>${RC.live ? "You can close this page. When you sign in again after you're approved, your dashboard will be unlocked." : 'Demo tip: open another tab, sign in as Admin and approve this application. This page will update on its own.'}</span></div>`}
      </div></div>`;
  }

  RC.views['r-onboard'] = {
    path: 'r/onboard', title: 'Rider verification', roles: ['keke', 'bike'], nav: false,
    // Not "live" (so autosave never re-renders the form mid-typing); poll for review decisions instead.
    tick() {
      const u = me(); if (!u) return;
      if (u.kyc.status !== this._st) { const first = this._st === undefined; this._st = u.kyc.status; if (!first) { if (u.kyc.status === 'approved') toast("You're approved! Welcome aboard."); RC.render(); } return; }
      // Live saves and Realtime events can land in either order; re-sync if the saved step moved under us.
      const a = document.activeElement;
      if ((u.kyc.step || 0) !== this._step && !(a && a.matches && a.matches('input, textarea, select'))) RC.render();
    },
    render() {
      const u = me(); this._st = u.kyc.status; this._step = u.kyc.step || 0;
      if (u.kyc.status === 'approved') { setTimeout(() => RC.go('r/drive'), 0); return ''; }
      if (u.kyc.status === 'pending' || (u.kyc.status === 'rejected' && !u.kyc.editing)) return pendingScreen(u);
      const all = steps(u.role); const i = Math.min(u.kyc.step || 0, all.length - 1); const st = all[i];
      return `<div class="page page-narrow stack-lg" style="padding-top:20px">
        <div class="row-between"><div class="brand"><span class="emblem" style="background:#fff url('assets/rccg-emblem.png') center/cover;border-radius:50%;width:40px;height:40px"></span><span><b>${u.role === 'keke' ? 'Keke rider' : 'Dispatch rider'} verification</b><small class="muted" style="opacity:1">Step ${i + 1} of ${all.length} · saved automatically</small></span></div>
          <button class="btn btn-ghost btn-sm" data-act="logout">${icon('log-out')}<span class="sr-only">Sign out</span></button></div>
        <ol class="wiz" aria-label="Progress">${all.map((s, k) => `<li class="${k < i ? 'done' : k === i ? 'now' : ''}" ${k === i ? 'aria-current="step"' : ''}><span>${s.title}</span></li>`).join('')}</ol>
        <form class="card stack-lg" style="padding:20px" data-form="kyc-step" novalidate>
          <h1 style="font-size:22px">${st.heading}</h1>
          ${st.note ? `<div class="banner info">${icon('info')}<span>${esc(st.note)}</span></div>` : ''}
          ${st.key === 'review' ? reviewStep(u, all) : `
            <div class="grid-2">${st.fields.map((f) => fieldHTML(f, u)).join('')}</div>
            ${st.upfront ? `<label class="switch"><input type="checkbox" data-change="kyc-upfront" ${u.kyc.data.upfront ? 'checked' : ''}><span class="track"></span><span><b>Ask customers to pay upfront by transfer</b><br><span class="small muted">Customers will see your bank details when they accept your offer.</span></span></label>` : ''}
            ${st.docs && st.docs.length ? `<fieldset><legend>Documents</legend><p class="help" style="margin-bottom:10px">Clear photos, all four corners visible. Images are compressed on your device.</p><div class="uploads">${st.docs.map(([k, l, r]) => uploadTile(k, l, r, u)).join('')}</div></fieldset>` : ''}`}
          <div class="row" style="justify-content:space-between">
            ${i > 0 ? `<button type="button" class="btn btn-outline" data-act="kyc-prev">${icon('arrow-left')} Back</button>` : '<span></span>'}
            <button type="submit" class="btn btn-primary">${st.key === 'review' ? `${icon('send')} Submit for review` : `Continue ${icon('arrow-right')}`}</button></div>
        </form></div>`;
    },
  };

  function reviewStep(u, all) {
    const d = u.kyc.data; const docs = u.kyc.docs || {};
    return `<p class="muted">Check your details before submitting. You can go back to change anything.</p>
      ${all.filter((s) => s.fields).map((s) => `<section class="card-flat stack" style="gap:8px"><div class="row-between"><h4>${s.heading}</h4><button type="button" class="btn btn-ghost btn-sm" data-act="kyc-goto" data-step="${all.indexOf(s)}">${icon('pencil', 'ic-sm')} Edit</button></div>
        <dl class="kv">${s.fields.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(d[f.name] || '—')}</dd>`).join('')}</dl>
        ${s.docs && s.docs.length ? `<p class="xs muted">${s.docs.map(([k, l]) => `${docs[k] ? '✓' : '✗'} ${esc(l)}`).join(' · ')}</p>` : ''}</section>`).join('')}
      <label class="check"><input type="checkbox" name="consent" required><span>I confirm this information is true. I agree to a background check and to follow the ${esc(C.APP_NAME)} rider code of conduct and Redemption City traffic rules.</span></label>
      <p class="err" id="consent-err" role="alert"></p>`;
  }

  // Autosave: collect field edits and save them together shortly after typing stops.
  let saveT = null; let patch = {};
  const flushKyc = () => { clearTimeout(saveT); const p = patch; patch = {}; return Object.keys(p).length ? RC.api.saveApplication(p) : Promise.resolve(); };
  const saveKyc = (k, v) => { patch[k] = v; clearTimeout(saveT); saveT = setTimeout(() => flushKyc().catch((e) => toast('Could not save: ' + e.message, 'bad')), 600); };
  Object.assign(RC.inputs, { kyc: (el) => saveKyc(el.dataset.k, el.value) });
  Object.assign(RC.changes, {
    kyc: (el) => saveKyc(el.dataset.k, el.value),
    'kyc-upfront': (el) => saveKyc('upfront', el.checked),
    'kyc-doc': async (el) => {
      const file = el.files[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast('File is larger than 10MB.', 'bad'); return; }
      const key = el.dataset.k;
      const all = steps(me().role); const st = all.find((s) => (s.docs || []).some((q) => q[0] === key)); const def = st.docs.find((q) => q[0] === key);
      const tile = $('#up-' + key); if (tile) tile.querySelector('.fname').textContent = 'Uploading…';
      const d = await RC.readFileCompressed(file);
      const ok = await RC.run(RC.api.uploadDoc(key, file, d), 'Uploaded ' + def[1]);
      const t2 = $('#up-' + key); if (t2) { t2.outerHTML = uploadTile(key, def[1], def[2], me()); RC.refreshIcons(); }
      if (!ok) el.value = '';
    },
  });
  /* ---- Live camera capture for the passport photo ---- */
  let camStream = null, camShot = null;
  const stopCam = () => { if (camStream) camStream.getTracks().forEach((t) => t.stop()); camStream = null; };
  function camView(state, msg) {
    return `<div class="stack">
      <div class="row-between"><h3>Passport photo</h3><button type="button" class="btn btn-icon btn-ghost" data-act="cam-close" aria-label="Close camera">${icon('x')}</button></div>
      <p class="muted small">Face the camera in good light. Remove sunglasses and caps. Keep your face inside the oval.</p>
      <div class="cam">${state === 'shot' ? `<img src="${camShot}" alt="Photo preview">` : '<video id="cam-video" playsinline muted autoplay></video>'}
        ${state !== 'shot' ? '<div class="guide"></div>' : ''}${msg && state === 'live' ? `<div class="cam-msg">${esc(msg)}</div>` : ''}</div>
      ${state === 'shot'
        ? `<div class="row"><button type="button" class="btn btn-outline grow" data-act="cam-retake">${icon('rotate-ccw')} Retake</button><button type="button" class="btn btn-primary grow" data-act="cam-use">${icon('check')} Use photo</button></div>`
        : state === 'error' ? `<div class="banner bad">${icon('camera-off')}<span>${esc(msg)}</span></div><button type="button" class="btn btn-outline" data-act="cam-retake">${icon('rotate-ccw')} Try again</button>`
        : `<button type="button" class="btn btn-primary btn-block" data-act="cam-snap" style="min-height:58px">${icon('camera')} Take photo</button>`}
    </div>`;
  }
  async function openCam() {
    stopCam();
    RC.modal(camView('live', 'Starting camera…'), { label: 'Take passport photo' });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { RC.$('#modal .modal').innerHTML = camView('error', 'This browser cannot open the camera. Please use Chrome or Safari on your phone.'); RC.refreshIcons(); return; }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false });
      const v = RC.$('#cam-video'); if (!v) return stopCam();
      v.srcObject = camStream; await v.play().catch(() => {});
      const m = RC.$('#modal .cam-msg'); if (m) m.remove();
    } catch (e) {
      const msg = e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow camera for this site in your browser settings, then try again.' : e.name === 'NotFoundError' ? 'No camera was found on this device.' : 'The camera could not start. Close other apps using it and try again.';
      RC.$('#modal .modal').innerHTML = camView('error', msg); RC.refreshIcons();
    }
  }
  Object.assign(RC.actions, {
    'kyc-camera': () => openCam(),
    'cam-close': () => { stopCam(); RC.closeModal(); },
    'cam-retake': () => openCam(),
    'cam-snap': () => {
      const v = RC.$('#cam-video'); if (!v || !v.videoWidth) return toast('Camera is not ready yet.', 'info');
      const c = document.createElement('canvas'); const w = v.videoWidth, h = v.videoHeight;
      c.width = w; c.height = h; const x = c.getContext('2d');
      x.translate(w, 0); x.scale(-1, 1); x.drawImage(v, 0, 0, w, h); // save as the person sees themselves
      camShot = c.toDataURL('image/jpeg', 0.9); stopCam();
      RC.$('#modal .modal').innerHTML = camView('shot'); RC.refreshIcons();
    },
    'cam-use': async (el) => {
      el.disabled = true; el.innerHTML = '<span class="spinner"></span> Saving…';
      const blob = await (await fetch(camShot)).blob();
      const file = new File([blob], 'passport-live.jpg', { type: 'image/jpeg' });
      const d = await RC.readFileCompressed(file, 640);
      const ok = await RC.run(RC.api.uploadDoc('passport', file, d), 'Passport photo saved');
      if (ok) { RC.closeModal(); const t = $('#up-passport'); if (t) { t.outerHTML = uploadTile('passport', 'Passport photograph', true, me()); RC.refreshIcons(); } }
      else { el.disabled = false; el.textContent = 'Use photo'; }
    },
  });
  document.addEventListener('rc:modal-closed', stopCam); // closing the dialog any way turns the camera off

  const setStep = async (n) => { await RC.run((async () => { await flushKyc(); await RC.api.saveApplication(null, n); })()); RC.render(); };
  Object.assign(RC.actions, {
    'kyc-prev': () => setStep(Math.max(0, (me().kyc.step || 0) - 1)),
    'kyc-goto': (el) => setStep(Number(el.dataset.step)),
    'kyc-edit': async () => { await RC.api.setKycEditing(true); if (RC.live) await RC.api.saveApplication(null, 0); RC.render(); },
  });
  RC.forms['kyc-step'] = async (f, fd) => {
    const u0 = me(); const all = steps(u0.role); const i = u0.kyc.step || 0; const st = all[i];
    const vals = {}; (st.fields || []).forEach((fl) => { vals[fl.name] = (fd.get(fl.name) || '').toString().trim(); });
    if (!(await RC.run((async () => { await flushKyc(); if (Object.keys(vals).length) await RC.api.saveApplication(vals); })()))) return;
    const u = me();
    let firstBad = null;
    (st.fields || []).forEach((fl) => {
      const v = vals[fl.name]; let msg = '';
      if (fl.required && !v) msg = `${fl.label} is required.`;
      else if (v && fl.pattern && !fl.pattern.test(v.replace(/\s/g, ''))) msg = fl.patternMsg;
      else if (fl.type === 'date' && fl.name === 'dob' && v && (Date.now() - new Date(v)) / 31557600000 < 18) msg = 'You must be at least 18 years old.';
      else if (fl.name === 'licenceExpiry' && v && new Date(v) < new Date()) msg = 'This licence has expired. Renew it before applying.';
      const e = $('#k-' + fl.name + '-err'); const inp = $('#k-' + fl.name);
      if (e) e.textContent = msg; if (inp) inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg && !firstBad) firstBad = inp;
    });
    (st.docs || []).forEach(([k, l, r]) => {
      const missing = r && !(u.kyc.docs || {})[k];
      const e = $('#up-' + k + '-err'); if (e) e.textContent = missing ? 'Required' : '';
      const t = $('#up-' + k); if (t) t.setAttribute('aria-invalid', missing ? 'true' : 'false');
      if (missing && !firstBad) firstBad = $('#file-' + k) || $('#up-' + k);
    });
    if (st.key === 'review' && !fd.get('consent')) { $('#consent-err').textContent = 'Please confirm to continue.'; firstBad = f.querySelector('[name=consent]'); }
    if (firstBad) { firstBad.focus(); toast('Please fix the highlighted fields.', 'bad'); return; }
    if (st.key !== 'review') return setStep(i + 1);
    // Submit application (server copies vehicle + bank details onto the profile and marks it pending)
    const b = f.querySelector('[type=submit]'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Submitting…';
    if (await RC.run(RC.api.submitApplication(), 'Application submitted for review')) RC.render();
    else { b.disabled = false; b.textContent = 'Submit for review'; }
  };

  /* ======================= DRIVE (live dashboard) ======================= */
  // Simulated driving exists only in preview mode; live riders share real GPS.
  const RS = { watchId: null, gps: 'off', lastWrite: 0, sim: !RC.live, skipped: new Set(), map: null, layers: [], meMk: null, lastJob: null };

  const myJob = (u) => S.db.requests.find((r) => r.riderId === u.id && ['accepted', 'arrived', 'in_progress'].includes(r.status));
  const openRequests = (u) => S.db.requests.filter((r) => r.status === 'searching' && r.vehicle === u.role && !RS.skipped.has(r.id) && !r.bids.some((b) => b.riderId === u.id && b.status === 'declined')).sort((a, b) => b.createdAt - a.createdAt);
  const writeLoc = (p) => RC.api.writeLoc(p).catch(() => { /* retry on next fix */ });

  function startGPS() {
    const u = me();
    if (!RC.live && !u.loc) writeLoc({ lat: C.CENTER.lat + (Math.random() - 0.5) * 0.01, lng: C.CENTER.lng + (Math.random() - 0.5) * 0.01 });
    if (!navigator.geolocation) { RS.gps = RC.live ? 'denied' : 'sim'; RC.refresh(); return; }
    if (RS.watchId != null) return;
    RS.gps = RC.live ? 'waiting' : 'sim';
    RS.watchId = navigator.geolocation.watchPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const inside = M.inServiceArea(p);
      if (!RC.live && !inside) { RS.gps = 'sim'; return; }
      const was = RS.gps; RS.gps = inside ? 'gps' : 'outside';
      if (Date.now() - RS.lastWrite > 4000) { RS.lastWrite = Date.now(); writeLoc(p); }
      if (was !== RS.gps) RC.refresh();
    }, (err) => { RS.gps = RC.live ? (err.code === 1 ? 'denied' : 'waiting') : 'sim'; RC.refresh(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  const gpsText = () => ({ gps: 'Sharing live GPS location', sim: 'Sharing location (simulated: you are outside the service area)', waiting: 'Finding your GPS location…', outside: 'Sharing GPS, but you are outside Redemption City', denied: 'Location is blocked. Allow location for this site in your browser settings.', off: '' }[RS.gps] || '');
  function stopGPS() { if (RS.watchId != null) navigator.geolocation.clearWatch(RS.watchId); RS.watchId = null; RS.gps = 'off'; }

  function jobPanel(r, u) {
    const cust = S.user(r.customerId); const ord = r.orderId ? S.order(r.orderId) : null; const v = ord ? S.vendor(ord.vendorId) : null;
    const target = r.status === 'in_progress' ? r.dropoff : r.pickup;
    const dist = u.loc ? M.haversineKm(u.loc, target) * C.ROAD_FACTOR : 0;
    const next = r.status === 'accepted' ? ['arrived', r.kind === 'order' ? "I'm at the store" : "I've arrived at pickup"]
      : r.status === 'arrived' ? ['start', r.kind === 'order' ? 'Order picked up' : r.kind === 'parcel' ? 'Parcel collected · start' : 'Start trip']
      : ['complete', r.kind === 'ride' ? 'Complete trip' : 'Mark as delivered'];
    const head = r.status === 'accepted' ? (r.kind === 'order' ? 'Head to the store' : 'Head to pickup') : r.status === 'arrived' ? (r.kind === 'order' ? 'Collect the order' : 'Waiting for customer') : r.kind === 'ride' ? 'Drive to destination' : 'Deliver to customer';
    return `<div class="stack">
      <div class="row-between"><div><span class="badge badge-blue">${r.kind === 'ride' ? 'Ride' : r.kind === 'parcel' ? 'Parcel' : 'Store order'}</span><h2 style="font-size:20px;margin-top:6px">${head}</h2>
        <p class="muted small">${esc(target.label)} · ${dist.toFixed(1)} km</p></div><span class="price num">${naira(r.price)}</span></div>
      <div class="row wrap" style="gap:8px"><a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving">${icon('navigation', 'ic-sm')} Open in Google Maps</a>
        ${RC.live ? '' : `<label class="switch small"><input type="checkbox" data-change="sim-drive" ${RS.sim ? 'checked' : ''}><span class="track"></span>Simulate driving (demo)</label>`}</div>
      <div class="card-flat row"><span class="avatar">${initials(cust ? cust.name : '?')}</span><div class="grow"><b>${esc(cust ? cust.name : 'Customer')}</b><div class="xs muted">Customer · ${r.pay === 'cash' ? 'Pays cash' : 'Pays by transfer'}</div></div>
        ${cust ? `<a class="btn btn-icon btn-primary" href="tel:${esc(cust.phone)}" aria-label="Call customer">${icon('phone')}</a>` : ''}</div>
      ${r.parcel ? `<div class="card-flat small"><b>Parcel:</b> ${esc(r.parcel.desc)} (${esc(r.parcel.size)})<br><b>Recipient:</b> ${esc(r.parcel.recipient)} · <a href="tel:${esc(r.parcel.recipientPhone)}">${esc(r.parcel.recipientPhone)}</a></div>` : ''}
      ${ord ? `<div class="card-flat small stack" style="gap:6px"><div class="row-between"><b>${esc(v.name)}</b>${RC.orderBadge(ord.status)}</div>${ord.items.map((i) => `<div class="row-between"><span>${i.qty} × ${esc(i.name)}</span><span class="num">${naira(i.price * i.qty)}</span></div>`).join('')}
        <div class="row-between"><b>Goods total</b><b class="num">${naira(ord.subtotal)}</b></div>${ord.pay === 'cash' ? '<p class="xs muted">Collect cash for goods on delivery and hand it to the store.</p>' : ''}</div>` : ''}
      ${r.note ? `<div class="banner info">${icon('message-square')}<span>${esc(r.note)}</span></div>` : ''}
      <dl class="kv"><dt>Pickup</dt><dd>${esc(r.pickup.label)}</dd><dt>Drop-off</dt><dd>${esc(r.dropoff.label)}</dd></dl>
      ${r.transfer && r.transfer.sent && !r.transfer.confirmed ? `<div class="banner">${icon('landmark')}<span class="grow">Customer says they've sent <b>${naira(r.price)}</b>. Check your bank app before confirming.</span></div><button class="btn btn-brand" data-act="confirm-transfer" data-id="${r.id}">${icon('check')} Confirm payment received</button>` : r.transfer && r.transfer.confirmed ? `<span class="badge badge-green">${icon('check', 'ic-sm')} Transfer confirmed</span>` : ''}
      ${r.kind === 'order' && r.status === 'arrived' && ord && ord.status !== 'ready' ? `<div class="banner">${icon('clock')}<span>The store hasn't marked this order ready yet.</span></div>` : ''}
      <button class="btn btn-primary btn-block" style="min-height:56px" data-act="job-step" data-step="${next[0]}" data-id="${r.id}">${next[1]}</button>
      ${r.status !== 'in_progress' ? `<button class="btn btn-danger btn-sm" data-act="job-cancel" data-id="${r.id}">Cancel job</button>` : ''}</div>`;
  }

  function requestCard(r, u) {
    const mine = r.bids.find((b) => b.riderId === u.id);
    const toPick = u.loc ? M.haversineKm(u.loc, r.pickup) * C.ROAD_FACTOR : 0;
    const cust = S.user(r.customerId); const ord = r.orderId ? S.order(r.orderId) : null;
    return `<li class="card stack" style="gap:10px">
      <div class="row-between"><span class="row" style="gap:6px"><span class="badge ${r.kind === 'ride' ? 'badge-blue' : 'badge-amber'}">${r.kind === 'ride' ? 'Ride' : r.kind === 'parcel' ? 'Parcel' : 'Store delivery'}</span><span class="xs muted">${ago(r.createdAt)}</span></span>
        <div style="text-align:right"><span class="price num">${naira(r.offer)}</span><div class="xs muted">${r.pay === 'cash' ? 'Cash' : 'Transfer'}</div></div></div>
      <div class="small"><div class="row" style="gap:8px"><span class="ldot a"></span><span class="grow">${esc(r.pickup.label)}</span></div><div class="row" style="gap:8px;margin-top:4px"><span class="ldot b"></span><span class="grow">${esc(r.dropoff.label)}</span></div></div>
      <p class="xs muted">${toPick.toFixed(1)} km to pickup · trip ${r.distKm.toFixed(1)} km · ${esc(cust ? cust.name.split(' ')[0] : 'Customer')}${r.parcel ? ' · ' + esc(r.parcel.desc) : ''}${ord ? ` · ${ord.items.reduce((s, i) => s + i.qty, 0)} items` : ''}</p>
      ${mine && mine.status === 'open' ? `<div class="banner info">${icon('clock')}<span class="grow">You offered <b>${naira(mine.price)}</b>. Waiting for the customer to choose.</span></div><button class="btn btn-outline btn-sm" data-act="bid-withdraw" data-id="${r.id}">Withdraw offer</button>`
        : mine && mine.status === 'lost' ? '' : `
        <button class="btn btn-primary" data-act="bid" data-id="${r.id}" data-price="${r.offer}">Accept for ${naira(r.offer)}</button>
        <div class="row wrap" style="gap:8px"><span class="small muted">Counter-offer:</span>${[100, 200, 300].map((d) => `<button class="chip" data-act="bid" data-id="${r.id}" data-price="${r.offer + d}">${naira(r.offer + d)}</button>`).join('')}</div>
        <div class="row"><label class="sr-only" for="cb-${r.id}">Your price</label><input class="input" id="cb-${r.id}" inputmode="numeric" placeholder="Your price (₦)" style="min-height:44px"><button class="btn btn-outline btn-sm" data-act="bid-custom" data-id="${r.id}">Send</button><button class="btn btn-ghost btn-sm" data-act="skip-req" data-id="${r.id}">Skip</button></div>`}
    </li>`;
  }

  function driveSheet() {
    const u = me(); const job = myJob(u);
    const today = S.db.requests.filter((r) => r.riderId === u.id && r.status === 'completed' && new Date(r.completedAt).toDateString() === new Date().toDateString());
    const reqs = u.online ? openRequests(u) : [];
    return `<div class="stack">
      <div class="online-toggle ${u.online ? 'on' : ''}"><div><b>${u.online ? "You're online" : "You're offline"}</b><div class="xs muted">${u.online ? gpsText() : 'Go online to receive requests'}</div></div>
        <label class="switch"><input type="checkbox" data-change="online" ${u.online ? 'checked' : ''} ${job ? 'disabled' : ''} aria-label="Online"><span class="track"></span></label></div>
      ${job ? jobPanel(job, u) : u.online ? `
        <div class="row-between"><h3>Requests near you</h3><span class="badge">${reqs.length}</span></div>
        ${reqs.length ? `<ul class="list">${reqs.map((r) => requestCard(r, u)).join('')}</ul>` : `<div class="empty">${vehicleSvg(u.role, 40)}<p>No requests right now. New ones appear here as soon as customers book.</p><p class="xs">Demo: open a customer tab and book a ${u.role === 'keke' ? 'ride' : 'parcel or store order'}.</p></div>`}`
        : `<div class="tiles" style="grid-template-columns:1fr 1fr"><div class="card tile"><span class="muted small">Today</span><span class="v">${naira(today.reduce((s, r) => s + r.price, 0))}</span></div><div class="card tile"><span class="muted small">Trips today</span><span class="v">${today.length}</span></div></div>
           <div class="card-flat row">${stars('user', u.id)}<span class="small muted">Your rating</span></div>`}
    </div>`;
  }

  function syncDriveMap(refit) {
    const m = RS.map; if (!m) return; const u = me();
    RS.layers.forEach((l) => l.remove()); RS.layers = [];
    const job = myJob(u);
    if (u.loc) { RS.meMk = m.marker(u.loc, u.role, 'You'); RS.layers.push(RS.meMk); }
    if (job) {
      RS.layers.push(m.marker(job.pickup, 'pickup', job.kind === 'order' ? 'Store' : 'Pickup'));
      RS.layers.push(m.marker(job.dropoff, 'dropoff', 'Drop-off'));
      if (job.status === 'accepted' && job.approach) RS.layers.push(m.line(job.approach.path, { color: '#241F5E', dashed: true, weight: 4 }));
      RS.layers.push(m.line(job.path, { color: '#098A44' }));
      if (refit) m.fit([u.loc, job.pickup, job.dropoff], 80);
    } else if (u.online) {
      const rs = openRequests(u);
      rs.forEach((r) => RS.layers.push(m.marker(r.pickup, 'request', naira(r.offer))));
      if (refit) m.fit([u.loc, ...rs.map((r) => r.pickup)], 80);
    } else if (refit && u.loc) m.center(u.loc, 15);
  }

  RC.views['r-drive'] = {
    path: 'r/drive', title: 'Drive', roles: ['keke', 'bike'], requiresApproval: true, map: true, tall: true,
    mapTop: () => { const u = me(); return `<span class="pill pill-status"><span class="dot ${u.online ? 'on' : ''}"></span>${u.online ? 'Online' : 'Offline'}</span>`; },
    sheet: driveSheet,
    async mount() {
      RS.map = await M.create($('#map'), { center: me().loc || C.CENTER, zoom: 15 }); RS.layers = [];
      if (me().online) startGPS();
      RS.lastJob = (myJob(me()) || {}).id; RS.lastCount = openRequests(me()).length;
      syncDriveMap(true);
    },
    sync() {
      const u = me(); const job = myJob(u); const jid = job ? job.id + job.status : null;
      const count = u.online ? openRequests(u).length : 0;
      if (job && RS.lastJob !== jid && job.status === 'accepted' && (!RS.lastJob || !RS.lastJob.startsWith(job.id))) toast('Your offer was accepted. Head to pickup!');
      if (count > (RS.lastCount || 0) && !job) toast('New request nearby', 'info');
      const refit = RS.lastJob !== jid; RS.lastJob = jid; RS.lastCount = count;
      syncDriveMap(refit);
    },
    tick() {
      const u = me(); const job = myJob(u);
      if (!RC.live && job && RS.sim && RS.gps !== 'gps' && u.loc) {
        const target = job.status === 'in_progress' ? job.dropoff : job.status === 'accepted' ? job.pickup : null;
        if (target) {
          const d = M.haversineKm(u.loc, target); const step = (C.SPEED_KMH[u.role] * C.DEMO_SPEED) / 3600;
          if (d > 0.01) { const f = Math.min(1, step / d); writeLoc({ lat: u.loc.lat + (target.lat - u.loc.lat) * f, lng: u.loc.lng + (target.lng - u.loc.lng) * f }); }
        }
      }
      if (RS.meMk && me().loc) RS.meMk.setPos(me().loc);
    },
    unmount() { if (RS.map) RS.map.destroy(); RS.map = null; RS.layers = []; RS.meMk = null; },
  };

  Object.assign(RC.changes, {
    online: async (el) => {
      const on = el.checked;
      if (!(await RC.run(RC.api.setOnline(on)))) { el.checked = !on; return; }
      if (on) { startGPS(); toast("You're online. Requests will appear here."); } else { stopGPS(); toast("You're offline", 'info'); }
    },
    'sim-drive': (el) => { RS.sim = el.checked; },
  });
  const placeBid = (id, price) => RC.run(RC.api.placeBid(id, price), `Offer of ${naira(price)} sent to customer`);
  Object.assign(RC.actions, {
    bid: (el) => placeBid(el.dataset.id, Number(el.dataset.price)),
    'bid-custom': (el) => {
      const inp = $('#cb-' + el.dataset.id); const v = Math.round(Number((inp.value || '').replace(/\D/g, '')) / 50) * 50;
      const r = S.request(el.dataset.id);
      if (!v || v < r.offer * 0.8 || v > r.offer * 3) { toast(`Enter a price between ${naira(r.offer * 0.8)} and ${naira(r.offer * 3)}.`, 'bad'); inp.focus(); return; }
      inp.blur(); placeBid(el.dataset.id, v);
    },
    'bid-withdraw': (el) => RC.run(RC.api.withdrawBid(el.dataset.id)),
    'skip-req': (el) => { RS.skipped.add(el.dataset.id); RC.refresh(); },
    'confirm-transfer': (el) => RC.run(RC.api.confirmTransfer('req', el.dataset.id), 'Payment confirmed'),
    'job-step': async (el) => {
      const step = el.dataset.step; const price = (S.request(el.dataset.id) || {}).price;
      el.disabled = true;
      if (!(await RC.run(RC.api.riderStep(el.dataset.id, step), step === 'complete' ? `Job complete: ${naira(price)} earned` : null))) el.disabled = false;
    },
    'job-cancel': async (el) => {
      if (!(await RC.confirmDialog('Cancel this job?', 'Frequent cancellations lower your rating and may lead to suspension.', 'Cancel job', true))) return;
      RC.run(RC.api.cancelRequest(el.dataset.id), 'Job cancelled. The customer can choose another rider.');
    },
  });

  /* ======================= JOBS & EARNINGS ======================= */
  RC.views['r-jobs'] = {
    path: 'r/jobs', title: 'Jobs & earnings', roles: ['keke', 'bike'], requiresApproval: true, live: true,
    render() {
      const u = me();
      const done = S.db.requests.filter((r) => r.riderId === u.id && r.status === 'completed').sort((a, b) => b.completedAt - a.completedAt);
      const day = new Date().toDateString(); const weekAgo = Date.now() - 7 * 86400e3;
      const sum = (l) => l.reduce((s, r) => s + r.price, 0);
      const rv = S.rating('user', u.id);
      return `<header class="topbar"><h1>Jobs & earnings</h1></header><div class="page stack-lg">
        <div class="tiles">
          <div class="card tile"><span class="muted small">Today</span><span class="v">${naira(sum(done.filter((r) => new Date(r.completedAt).toDateString() === day)))}</span></div>
          <div class="card tile"><span class="muted small">Last 7 days</span><span class="v">${naira(sum(done.filter((r) => r.completedAt > weekAgo)))}</span></div>
          <div class="card tile"><span class="muted small">All time</span><span class="v">${naira(sum(done))}</span></div>
          <div class="card tile"><span class="muted small">Rating</span><span class="v">${rv.count ? rv.avg.toFixed(1) + ' ★' : '—'}</span><span class="xs muted">${rv.count} reviews</span></div></div>
        <section class="card stack"><h3>Completed jobs</h3>${done.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Type</th><th>Route</th><th>Paid by</th><th style="text-align:right">Fare</th></tr></thead><tbody>
          ${done.map((r) => `<tr><td>${fmtTime(r.completedAt)}</td><td>${r.kind}</td><td>${esc(r.pickup.label)} → ${esc(r.dropoff.label)}</td><td>${r.pay}</td><td class="num" style="text-align:right;font-weight:700">${naira(r.price)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Completed jobs will appear here.</p>'}</section>
        <section class="card stack"><h3>Reviews</h3>${rv.list.map((r) => `<div class="card-flat"><div class="row-between"><b class="small">${esc(r.customerName || 'Customer')}</b><span class="stars">${icon('star')}${r.stars}</span></div>${r.text ? `<p class="small">${esc(r.text)}</p>` : ''}<p class="xs muted">${ago(r.at)}</p></div>`).join('') || '<p class="muted small">No reviews yet.</p>'}</section></div>`;
    },
  };

  /* ======================= ACCOUNT ======================= */
  RC.views['r-account'] = {
    path: 'r/account', title: 'Account', roles: ['keke', 'bike'],
    render() {
      const u = me(); const b = u.bank || {}; const docs = Object.entries((u.kyc && u.kyc.docs) || {});
      return `<header class="topbar"><h1>Account</h1></header><div class="page page-narrow stack-lg">
        <div class="card row"><span class="avatar avatar-lg">${(u.kyc.docs || {}).passport && u.kyc.docs.passport.preview ? `<img src="${u.kyc.docs.passport.preview}" alt="">` : initials(u.name)}</span><div class="grow"><h2 style="font-size:20px">${esc(u.name)}</h2><p class="muted small">${esc(u.phone)} · ${RC.roleLabel[u.role]}</p><span class="badge badge-green">${icon('shield-check', 'ic-sm')} Verified</span></div></div>
        <section class="card stack"><h3>${u.role === 'keke' ? 'Tricycle' : 'Bicycle'}</h3><dl class="kv"><dt>Vehicle</dt><dd>${esc(u.vehicle ? u.vehicle.model : '—')}</dd><dt>Colour</dt><dd>${esc(u.vehicle ? u.vehicle.colour : '—')}</dd>${u.role === 'keke' ? `<dt>Plate</dt><dd>${esc(u.vehicle ? u.vehicle.plate : '—')}</dd>` : ''}</dl></section>
        <form class="card stack" data-form="rider-bank" novalidate><h3>Payout & upfront payment</h3>
          <div class="field"><label for="rb-bank">Bank</label><select class="input" id="rb-bank" name="bankName">${C.BANKS.map((x) => `<option ${b.bankName === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <div class="grid-2"><div class="field"><label for="rb-num">Account number</label><input class="input" id="rb-num" name="accountNumber" inputmode="numeric" maxlength="10" value="${esc(b.accountNumber)}"></div>
          <div class="field"><label for="rb-name">Account name</label><input class="input" id="rb-name" name="accountName" value="${esc(b.accountName)}"></div></div>
          <label class="switch"><input type="checkbox" name="upfront" ${u.upfront ? 'checked' : ''}><span class="track"></span><span><b>Require upfront transfer</b><br><span class="small muted">Customers see your account details and pay before the trip starts.</span></span></label>
          <button class="btn btn-outline" type="submit">Save payout details</button></form>
        <section class="card stack"><h3>Documents</h3><div class="doc-thumbs">${docs.map(([k, d]) => `<button class="doc-thumb" data-act="view-doc" data-title="${esc(k)}" data-src="${d.preview || ''}" data-name="${esc(d.name)}">${d.preview ? `<img src="${d.preview}" alt="">` : `<span class="ph">${icon('file-text')}</span>`}<span>${esc(k)}</span></button>`).join('') || '<p class="muted small">Seeded demo rider: no documents.</p>'}</div></section>
        <section class="card stack"><button class="btn btn-outline" data-act="toggle-theme">${icon('sun-moon')} Toggle dark mode</button><hr class="divider"><button class="btn btn-danger" data-act="logout">${icon('log-out')} Sign out</button></section></div>`;
    },
  };
  RC.forms['rider-bank'] = (f, fd) => {
    const num = (fd.get('accountNumber') || '').trim();
    if (!/^\d{10}$/.test(num)) { toast('Account number must be 10 digits.', 'bad'); $('#rb-num').focus(); return; }
    RC.run(RC.api.saveBank({ bankName: fd.get('bankName'), accountNumber: num, accountName: (fd.get('accountName') || '').trim() }, !!fd.get('upfront')), 'Payout details saved');
  };
})();
