/* Landing page + sign in / sign up for every role */
(function () {
  const { C, S, M, esc, icon, vehicleSvg, toast, roleLabel } = RC;

  const ROLES = [
    { role: 'customer', title: 'Customer', desc: 'Book a keke, send a parcel, order food and shop from stores in the city.', ic: 'map-pinned' },
    { role: 'keke', title: 'Keke rider', desc: 'Register your tricycle, get verified and start earning from rides.', svg: 'keke' },
    { role: 'bike', title: 'Dispatch rider', desc: 'Deliver food, goods and parcels by bicycle. Set your own prices.', svg: 'bike' },
    { role: 'vendor', title: 'Vendor', desc: 'Restaurants, supermarkets and retailers: list your goods and receive orders.', ic: 'store' },
  ];
  const itile = (r, size = 28) => `<span class="itile" aria-hidden="true">${r.svg ? vehicleSvg(r.svg, size) : icon(r.ic, 'ic-lg')}</span>`;

  function homeFor(u) {
    if (u.role === 'customer') return 'c/home';
    if (u.role === 'admin') return 'a/approvals';
    if (u.role === 'vendor') return u.vendorId ? 'v/orders' : 'v/onboard';
    return u.kyc && u.kyc.status === 'approved' ? 'r/drive' : 'r/onboard';
  }
  RC.homeFor = homeFor;

  RC.views.landing = {
    path: '', title: 'Welcome', nav: false,
    render() {
      const u = RC.me();
      const feats = [[{ svg: 'keke' }, 'Keke rides'], [{ ic: 'utensils' }, 'Food'], [{ ic: 'package' }, 'Parcels'], [{ ic: 'store' }, 'Shops'], [{ ic: 'locate-fixed' }, 'Live tracking']];
      return `<div class="landing">
        <a class="skip" href="#roles">Skip to sign in</a>
        <header class="land-head">
          <a class="brand" href="#/" aria-label="${esc(C.APP_NAME)} home"><span class="emblem" style="background:#FFFFFF url('assets/rccg-emblem.png') center/cover"></span><span><b>${esc(C.APP_NAME)}</b><small>Redemption City</small></span></a>
          <div class="right">
            <img class="vision-badge" src="assets/vision-2032.png" alt="RCCG Explosive Growth Drive, Vision 2032" width="380" height="86">
            <button class="btn btn-icon btn-ghost" data-act="toggle-theme" aria-label="Switch light or dark theme">${icon('sun-moon')}</button>
          </div>
        </header>
        <main class="land-wrap">
          <section data-3d-section aria-labelledby="hero-h">
            <div class="hero">
              <div>
                <span class="kicker">Redemption City · Mowe, Ogun State</span>
                <h1 id="hero-h" class="display">Ride.<br><span class="g">Send.</span><br><span class="r">Shop.</span></h1>
                <p class="lead">Keke rides, food and parcel delivery, and local shopping across Redemption City. You name the price and riders make offers.</p>
                <div class="cta">
                  ${u ? `<a class="btn btn-primary" href="#/${homeFor(u)}">${icon('arrow-right')} Continue as ${esc(u.name.split(' ')[0])}</a>`
                    : `<a class="btn btn-primary" href="#/auth/customer">${icon('navigation')} Book a keke</a><a class="btn btn-outline" href="#/auth/keke">Drive with ${esc(C.APP_NAME)}</a>`}
                </div>
              </div>
              <a class="congress card-link" href="#/updates" aria-label="Holy Ghost Congress 2026, 7 to 12 December, Redemption City. See programmes and live updates.">
                <img src="assets/congress-2026-1440.jpg" srcset="assets/congress-2026-760.jpg 760w, assets/congress-2026-1440.jpg 1440w" sizes="(min-width: 980px) 560px, 100vw" alt="Holy Ghost Congress 2026: The Lord of Hosts, 7th to 12th December 2026, Redemption City" width="1440" height="588">
                <div class="cbar"><div><b>Holy Ghost Congress 2026</b><br><span>7–12 Dec · Redemption City · plan your ride early</span></div><span class="badge badge-red"><span class="live-dot"></span> Updates</span></div>
              </a>
            </div>
            ${window.RCLiquid && window.RCLiquid.needsPermission ? `<button class="btn btn-ghost btn-sm" style="margin-top:12px;padding-left:0" data-act="enable-motion">${icon('smartphone', 'ic-sm')} Turn on tilt colours</button>` : ''}
            <div class="feats" style="margin-top:18px">${feats.map(([r, l]) => `<span>${itile(r, 16)}${l}</span>`).join('')}</div>
            <div class="road" role="img" aria-label="A deep blue keke drives along the road as you scroll">
              <canvas data-3d="keke" data-dir="right" data-mode="hero"></canvas>
            </div>
          </section>

          <section class="sect" id="roles" aria-labelledby="roles-h">
            <div class="sect-h"><h2 id="roles-h">How will you<br>use ${esc(C.APP_NAME)}?</h2></div>
            <div class="role-grid">
              ${ROLES.map((r) => `<a class="card card-link role-card" href="#/auth/${r.role}">${itile(r)}
                <h3>${r.title}</h3><p class="muted">${r.desc}</p>
                <span class="go">Get started ${icon('arrow-right', 'ic-sm')}</span></a>`).join('')}
            </div>
          </section>

          <section class="sect" aria-labelledby="bike-h">
            <div class="bike-band">
              <span class="kicker">Deliveries</span>
              <h2 id="bike-h" style="margin-top:8px">Food. Goods. Parcels.<br><span style="color:var(--green)">Pedal-powered.</span></h2>
              <p class="muted" style="margin-top:10px;max-width:52ch">Bicycle dispatch riders carry orders from restaurants, supermarkets and shops to your door, at a price you agree.</p>
              <div class="road" role="img" aria-label="A dispatch rider pedals a bicycle as you scroll"><canvas data-3d="bike" data-dir="left"></canvas></div>
            </div>
          </section>

          <section class="sect" id="updates" aria-labelledby="upd-h">
            <div class="sect-h"><h2 id="upd-h">Live updates<br>&amp; programmes</h2><a class="btn btn-outline btn-sm" href="#/updates">See all ${icon('arrow-right', 'ic-sm')}</a></div>
            <div id="landing-posts">${RC.postsHTML ? RC.postsHTML(RC.publicPosts().slice(0, 6), { clamp: true }) : ''}</div>
          </section>

          ${RC.live ? '' : `<div class="card demo-note">
            ${icon('flask-conical')}
            <div class="stack small">
              <p><b>Preview: ${esc(C.APP_NAME)} is not live yet.</b> Bookings and orders are <b>not</b> sent to real riders or shops. The riders and shops you see are samples, and everything you enter stays on this device only.</p>
              <div><button class="btn btn-outline btn-sm" data-act="reset-demo">${icon('rotate-ccw')} Reset demo data</button></div>
            </div>
          </div>`}
          <footer class="land-foot">
            <a class="muted" href="?mode=live#/auth/admin">${icon('shield-check', 'ic-sm')} Staff sign-in</a>
            <span>${esc(C.APP_NAME)} serves Redemption City, Mowe, Ogun State · Pay riders and shops in cash or by bank transfer</span>
            <span><a class="muted" href="terms.html">Terms of Use</a> · <a class="muted" href="privacy.html">Privacy Policy</a></span>
          </footer>
        </main>

      </div>`;
    },
    update() { const el = RC.$('#landing-posts'); if (el && RC.postsHTML) { el.innerHTML = RC.postsHTML(RC.publicPosts().slice(0, 6), { clamp: true }); RC.refreshIcons(); } },
  };
  RC.actions['enable-motion'] = async (el) => { if (await window.RCLiquid.requestMotion()) { el.remove(); toast('Tilt your phone: the colours follow you'); } else toast('Motion access was not allowed', 'info'); };

  const authState = { step: 'details', phone: '', name: '', code: '' };

  RC.views.auth = {
    path: 'auth/:role', title: 'Sign in', nav: false,
    render({ role }) {
      if (!roleLabel[role]) return '<p class="page">Unknown role.</p>';
      const isAdmin = role === 'admin' && !RC.live; // live admins sign in with their phone like everyone else
      return `<div class="page page-narrow" style="padding-top:24px">
        <a href="#/" class="btn btn-ghost btn-sm" style="margin-left:-8px">${icon('chevron-left')} Back</a>
        <div class="card stack-lg" style="margin-top:12px;padding:24px">
          <div class="row"><span class="emblem" style="width:48px;height:48px;border-radius:50%;background:#fff url('assets/rccg-emblem.png') center/cover;box-shadow:var(--sh-1)"></span>
            <div><h1 style="font-size:24px">${role === 'admin' ? 'Staff sign-in' : authState.step === 'code' ? 'Verify your number' : 'Sign in or sign up'}</h1><p class="muted small">${role === 'admin' ? 'Admins only. Use the phone number registered as admin.' : roleLabel[role] + ' account'}</p></div></div>
          ${isAdmin ? `
            <form class="stack" data-form="admin-login" novalidate>
              <div class="field"><label for="pin" class="req">Admin PIN</label>
                <input class="input" id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required aria-describedby="pin-err pin-help">
                <p class="help" id="pin-help">Staff only.</p>
                <p class="err" id="pin-err" role="alert"></p></div>
              <button class="btn btn-brand btn-block" type="submit">${icon('shield-check')} Sign in</button>
            </form>` : authState.step === 'code' ? `
            <form class="stack" data-form="auth-code" data-role="${role}" novalidate>
              <p class="small">We sent a 6-digit code to <b>${esc(authState.phone)}</b>.</p>
              <div class="field"><label for="code" class="req">Verification code</label>
                <input class="input num" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required aria-describedby="code-help code-err" style="letter-spacing:.3em;font-size:22px;font-weight:800">
                <p class="help" id="code-help">${RC.live ? 'The SMS can take up to a minute to arrive.' : 'Demo: no SMS is sent. Use code <b>123456</b>.'}</p>
                <p class="err" id="code-err" role="alert"></p></div>
              <button class="btn btn-primary btn-block" type="submit">Verify & continue</button>
              <div class="row" style="justify-content:space-between"><button class="btn btn-ghost btn-sm" type="button" data-act="auth-back">Change number</button>
                ${RC.live ? `<button class="btn btn-ghost btn-sm" type="button" data-act="auth-resend" data-role="${role}">Resend code</button>` : ''}</div>
            </form>` : `
            <form class="stack" data-form="auth-details" data-role="${role}" novalidate>
              <div class="field"><label for="phone" class="req">Phone number</label>
                <input class="input" id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567" value="${esc(authState.phone)}" required aria-describedby="phone-help phone-err">
                <p class="help" id="phone-help">Nigerian mobile number. If you already have an account we'll sign you in.</p>
                <p class="err" id="phone-err" role="alert"></p></div>
              <div class="field"><label for="name">Full name <span class="muted" style="font-weight:500">(new accounts)</span></label>
                <input class="input" id="name" name="name" autocomplete="name" value="${esc(authState.name)}" aria-describedby="name-err">
                <p class="err" id="name-err" role="alert"></p></div>
              <button class="btn btn-primary btn-block" type="submit">Continue ${icon('arrow-right')}</button>
              <p class="xs muted center">By continuing you agree to the ${esc(C.APP_NAME)} <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>
            </form>`}
        </div></div>`;
    },
    mount() {},
  };

  const normPhone = (p) => p.replace(/[^\d+]/g, '').replace(/^\+234/, '0');
  const setErr = (id, msg) => { const e = RC.$('#' + id + '-err'); const i = RC.$('#' + id); if (e) e.textContent = msg || ''; if (i) i.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (msg && i) i.focus(); };

  const busy = (f, on, label) => { const b = f.querySelector('[type=submit]'); if (!b) return; if (on) { b.dataset.label = b.innerHTML; b.disabled = true; b.innerHTML = `<span class="spinner"></span> ${label}`; } else { b.disabled = false; b.innerHTML = b.dataset.label || b.innerHTML; } };
  let lastSent = 0;

  async function liveDetails(f, role, phone, name) {
    busy(f, true, 'Sending code…');
    try { await RC.api.sendCode(phone, role, name); lastSent = Date.now(); authState.phone = phone; authState.name = name; authState.step = 'code'; RC.render(); }
    catch (e) {
      busy(f, false);
      console.warn('sendCode failed:', e.message); // keep provider details out of the UI
      const m = e.message || '';
      setErr('phone', /rate limit|too many|seconds/i.test(m) ? 'Too many attempts. Please wait a minute and try again.'
        : /invalid.*phone|phone.*invalid/i.test(m) ? 'That phone number was not accepted. Check it and try again.'
        : "We couldn't send your code right now. Please try again in a few minutes.");
    }
  }
  async function liveCode(f, role, code) {
    busy(f, true, 'Checking…');
    try {
      const u = await RC.api.verifyCode(authState.phone, code);
      if (!u) throw new Error('Signed in, but your profile could not be loaded. Please refresh.');
      if (role === 'admin' && u.role !== 'admin') toast('This number is not an admin account.', 'bad');
      else if (role !== 'admin' && u.role !== role) toast(`This number is registered as a ${roleLabel[u.role]}. Opening that account.`, 'info');
      else toast('Welcome, ' + u.name.split(' ')[0] + '!');
      authState.step = 'details'; authState.phone = ''; authState.name = '';
      if (u.name === 'New user') askName();
      RC.go(homeFor(u));
    } catch (e) { busy(f, false); setErr('code', /expired|invalid/i.test(e.message) ? 'That code is wrong or has expired. Try again or resend.' : e.message); }
  }
  function askName() {
    RC.modal(`<form class="stack" data-form="ask-name"><h3>What's your name?</h3><p class="muted small">Riders, shops and customers will see this.</p>
      <div class="field"><label for="an" class="req">Full name</label><input class="input" id="an" name="name" autocomplete="name" required></div>
      <button class="btn btn-primary" type="submit">Save</button></form>`, { label: 'Your name' });
  }

  Object.assign(RC.forms, {
    'ask-name': async (f, fd) => { const n = (fd.get('name') || '').trim(); if (n.length < 3) return; if (await RC.run(RC.api.updateProfile({ full_name: n }))) RC.closeModal(); },
    'auth-details': (f, fd) => {
      const role = f.dataset.role;
      const phone = normPhone(fd.get('phone') || '');
      const name = (fd.get('name') || '').trim();
      setErr('phone', ''); setErr('name', '');
      if (!/^0[789][01]\d{8}$/.test(phone)) return setErr('phone', 'Enter a valid 11-digit Nigerian number, e.g. 08031234567.');
      if (RC.live) return liveDetails(f, role, phone, name);
      const existing = S.db.users.find((u) => u.phone === phone && !u.bot);
      if (existing && existing.role !== role) return setErr('phone', `This number is already registered as a ${roleLabel[existing.role]}. Use another number for this role.`);
      if (!existing && name.length < 3) return setErr('name', 'Enter your full name to create an account.');
      authState.phone = phone; authState.name = name; authState.step = 'code';
      RC.render();
    },
    'auth-code': (f, fd) => {
      const role = f.dataset.role;
      const code = (fd.get('code') || '').trim();
      if (RC.live) { if (!/^\d{6}$/.test(code)) return setErr('code', 'Enter the 6-digit code from the SMS.'); return liveCode(f, role, code); }
      if (code !== '123456') return setErr('code', 'That code is not correct. Check the SMS and try again.');
      let u = S.db.users.find((x) => x.phone === authState.phone && !x.bot);
      if (!u) {
        u = { id: S.uid('usr'), role, name: authState.name, phone: authState.phone, createdAt: Date.now(), online: false, upfront: false, bank: null, vehicle: null };
        if (role === 'keke' || role === 'bike') u.kyc = { status: 'none', data: { fullName: authState.name }, docs: {}, step: 0 };
        S.update((db) => db.users.push(u));
        toast('Account created — welcome, ' + u.name.split(' ')[0] + '!');
      } else toast('Welcome back, ' + u.name.split(' ')[0]);
      S.setSession({ userId: u.id });
      authState.step = 'details'; authState.phone = ''; authState.name = '';
      RC.go(homeFor(S.user(u.id)));
    },
    'admin-login': (f, fd) => {
      if ((fd.get('pin') || '') !== C.ADMIN_PIN) return setErr('pin', 'Incorrect PIN.');
      let a = S.db.users.find((u) => u.role === 'admin');
      if (!a) { a = { id: 'admin_1', role: 'admin', name: 'RC Go Admin', phone: '—', createdAt: Date.now() }; S.update((db) => db.users.push(a)); }
      S.setSession({ userId: a.id });
      RC.go('a/approvals');
    },
  });
  Object.assign(RC.actions, {
    'auth-back': () => { authState.step = 'details'; RC.render(); },
    'auth-resend': async (el) => {
      const wait = 60 - Math.round((Date.now() - lastSent) / 1000);
      if (wait > 0) return toast(`You can request a new code in ${wait}s.`, 'info');
      try { await RC.api.sendCode(authState.phone, el.dataset.role, authState.name); lastSent = Date.now(); toast('New code sent'); }
      catch (e) { console.warn('resend failed:', e.message); toast("We couldn't send a new code right now. Please try again shortly.", 'bad'); }
    },
    'reset-demo': async () => {
      if (!(await RC.confirmDialog('Reset demo data?', 'This removes every account, order and request on this device and restores the sample riders and shops.', 'Reset', true))) return;
      S.reset(); S.setSession(null); toast('Demo data reset'); RC.go('');
    },
  });
})();
