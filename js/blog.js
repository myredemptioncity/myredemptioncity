/* Blog: programmes + live updates. Admins publish from Admin → Updates;
 * everyone sees them on the home page and /updates, in real time. */
(function () {
  const { S, esc, icon, ago, toast } = RC;

  // Preview mode: seed two example posts once so the feed isn't empty.
  if (!S.LIVE && !S.db.posts) {
    const now = Date.now();
    S.update((db) => {
      db.posts = [
        { id: S.uid('post'), kind: 'program', title: 'Holy Ghost Congress 2026: The Lord of Hosts', body: 'Ministering: Pastor E.A. Adeboye & other anointed ministers of God.\nBook your keke early: riders will be stationed at the Main Gate and the New Arena car parks.', imageUrl: 'assets/congress-2026-760.jpg', pinned: true, published: true, startsAt: new Date('2026-12-07T18:00:00+01:00').getTime(), venue: 'New Arena, Redemption City', createdAt: now - 3600e3 },
        { id: S.uid('post'), kind: 'update', title: 'RC Go now serving Camp Market and Estate Phase 1 & 2', body: 'Order food and provisions from Camp Market shops and get them delivered by bicycle riders.', imageUrl: null, pinned: false, published: true, startsAt: null, venue: '', createdAt: now - 1200e3 },
      ];
    });
  }

  const posts = () => (S.db.posts || []).slice();
  const isAdmin = () => { const u = RC.me(); return u && u.role === 'admin'; };
  RC.publicPosts = () => posts().filter((p) => p.published || isAdmin())
    .sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));

  const fmtWhen = (ts) => new Date(ts).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const isLive = (p) => p.kind === 'update' && Date.now() - p.createdAt < 3 * 3600e3;

  RC.postsHTML = (list, opts = {}) => {
    if (!list.length) return `<div class="empty card">${icon('megaphone')}<p>No updates yet. Programmes and live news from Redemption City will appear here.</p></div>`;
    return `<div class="updates-grid">${list.map((p) => `<article class="card post ${p.pinned ? 'pinned' : ''}">
      ${p.imageUrl ? `<img class="pimg" src="${esc(p.imageUrl)}" alt="" loading="lazy">` : ''}
      <div class="pbody">
        <div class="meta">
          ${p.kind === 'program' ? '<span class="badge badge-red">Programme</span>' : '<span class="badge badge-green">Update</span>'}
          ${isLive(p) ? '<span class="badge"><span class="live-dot"></span> Live</span>' : ''}
          ${p.pinned ? `<span class="badge">${icon('pin', 'ic-sm')} Pinned</span>` : ''}
          ${!p.published ? '<span class="badge">Draft</span>' : ''}
          <span>${ago(p.createdAt)}</span>
        </div>
        <h3>${esc(p.title)}</h3>
        ${p.kind === 'program' && p.startsAt ? `<p class="row small" style="gap:6px;font-weight:700">${icon('calendar', 'ic-sm')} ${fmtWhen(p.startsAt)}${p.venue ? ' · ' + esc(p.venue) : ''}</p>` : ''}
        ${p.body ? `<p class="ptext muted" ${opts.clamp ? 'style="display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden"' : ''}>${esc(p.body)}</p>` : ''}
        ${opts.admin ? `<div class="row wrap" style="gap:8px;margin-top:4px">
          <button class="btn btn-outline btn-sm" data-act="post-edit" data-id="${p.id}">${icon('pencil', 'ic-sm')} Edit</button>
          <button class="btn btn-outline btn-sm" data-act="post-publish" data-id="${p.id}">${p.published ? 'Unpublish' : 'Publish'}</button>
          <button class="btn btn-danger btn-sm" data-act="post-del" data-id="${p.id}">${icon('trash-2', 'ic-sm')} Delete</button></div>` : ''}
      </div></article>`).join('')}</div>`;
  };

  /* -------- public page -------- */
  RC.views.updates = {
    path: 'updates', title: 'Updates',
    render() {
      return `<header class="topbar"><a class="btn btn-icon btn-ghost" href="#/" aria-label="Back">${icon('arrow-left')}</a><h1 class="grow">Updates</h1><span class="badge badge-red"><span class="live-dot"></span> Live</span></header>
        <div class="page stack-lg"><p class="muted">Programmes and live updates from Redemption City, posted by the ${esc(RC.C.APP_NAME)} team.</p>
        <div id="all-posts">${RC.postsHTML(RC.publicPosts())}</div></div>`;
    },
    update() { const el = RC.$('#all-posts'); if (el) { el.innerHTML = RC.postsHTML(RC.publicPosts()); RC.refreshIcons(); } },
  };

  /* -------- admin compose -------- */
  const BS = { editing: null, kind: 'update' };
  function form(p) {
    const k = p ? p.kind : BS.kind;
    const dt = p && p.startsAt ? new Date(p.startsAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
    return `<form class="card stack" data-form="post-save" data-id="${p ? p.id : ''}" novalidate>
      <div class="row-between"><h3>${p ? 'Edit post' : 'New post'}</h3>${p ? `<button type="button" class="btn btn-ghost btn-sm" data-act="post-cancel">Cancel edit</button>` : ''}</div>
      <div class="seg" role="group" aria-label="Post type">
        <button type="button" data-act="post-kind" data-kind="update" aria-pressed="${k === 'update'}">${icon('radio', 'ic-sm')} Live update</button>
        <button type="button" data-act="post-kind" data-kind="program" aria-pressed="${k === 'program'}">${icon('calendar', 'ic-sm')} Programme</button></div>
      <input type="hidden" name="kind" value="${k}">
      <div class="field"><label for="po-title" class="req">Title</label><input class="input" id="po-title" name="title" maxlength="140" required value="${esc(p ? p.title : '')}" placeholder="${k === 'program' ? 'e.g. Holy Ghost Service: Friday night' : 'e.g. Traffic update: Main Gate is busy'}"></div>
      <div class="field"><label for="po-body">Details</label><textarea class="input" id="po-body" name="body" rows="5" placeholder="What should people know?">${esc(p ? p.body : '')}</textarea></div>
      ${k === 'program' ? `<div class="grid-2"><div class="field"><label for="po-when" class="req">Date & time</label><input class="input" id="po-when" name="startsAt" type="datetime-local" value="${dt}" required></div>
        <div class="field"><label for="po-venue">Venue</label><input class="input" id="po-venue" name="venue" value="${esc(p ? p.venue || '' : '')}" placeholder="e.g. New Arena"></div></div>` : ''}
      <div class="field"><label for="po-img">Image <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">(optional)</span></label><input class="input" id="po-img" name="img" type="file" accept="image/*">
        ${p && p.imageUrl ? `<p class="help">Current image kept unless you choose a new one.</p>` : ''}</div>
      <div class="row wrap" style="gap:16px"><label class="check"><input type="checkbox" name="pinned" ${p && p.pinned ? 'checked' : ''}><span>Pin to top</span></label>
        <label class="check"><input type="checkbox" name="published" ${!p || p.published ? 'checked' : ''}><span>Publish now</span></label></div>
      <button class="btn btn-primary" type="submit">${icon('send')} ${p ? 'Save changes' : 'Post'}</button></form>`;
  }

  RC.views['a-blog'] = {
    path: 'a/blog', title: 'Updates', roles: ['admin'],
    render() {
      const editing = BS.editing && posts().find((x) => x.id === BS.editing);
      return `<header class="topbar"><h1 class="grow">Updates &amp; programmes</h1><a class="btn btn-outline btn-sm" href="#/updates">${icon('eye', 'ic-sm')} Public page</a></header>
        <div class="page stack-lg">
          <p class="muted">Posts appear instantly on the home page and the Updates page for everyone, with no refresh needed.</p>
          <div id="post-form">${form(editing)}</div>
          <section class="stack"><h2>Posted</h2><div id="admin-posts">${RC.postsHTML(RC.publicPosts(), { admin: true })}</div></section>
        </div>`;
    },
    update() { const el = RC.$('#admin-posts'); if (el) { el.innerHTML = RC.postsHTML(RC.publicPosts(), { admin: true }); RC.refreshIcons(); } },
  };

  const reform = () => { const p = BS.editing && posts().find((x) => x.id === BS.editing); RC.$('#post-form').innerHTML = form(p); RC.refreshIcons(); };
  Object.assign(RC.actions, {
    'post-kind': (el) => { BS.kind = el.dataset.kind; const p = BS.editing && posts().find((x) => x.id === BS.editing); if (p) p.kind = BS.kind; reform(); },
    'post-edit': (el) => { BS.editing = el.dataset.id; BS.kind = posts().find((x) => x.id === el.dataset.id).kind; reform(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    'post-cancel': () => { BS.editing = null; reform(); },
    'post-publish': (el) => { const p = posts().find((x) => x.id === el.dataset.id); RC.run(RC.api.updatePost(p.id, { published: !p.published }), p.published ? 'Post hidden' : 'Post published'); },
    'post-del': async (el) => {
      const p = posts().find((x) => x.id === el.dataset.id);
      if (!(await RC.confirmDialog('Delete this post?', `“${p.title}” will be removed for everyone. This can't be undone.`, 'Delete', true))) return;
      RC.run(RC.api.deletePost(p.id), 'Post deleted');
    },
  });
  RC.forms['post-save'] = async (f, fd) => {
    const title = (fd.get('title') || '').trim();
    if (title.length < 3) { toast('Add a title.', 'bad'); RC.$('#po-title').focus(); return; }
    const kind = fd.get('kind');
    const when = fd.get('startsAt');
    if (kind === 'program' && !when) { toast('Add the programme date and time.', 'bad'); RC.$('#po-when').focus(); return; }
    const imgF = fd.get('img');
    const img = imgF && imgF.size ? (await RC.readFileCompressed(imgF, 1200)).preview : undefined;
    const d = { title, body: (fd.get('body') || '').trim(), kind, startsAt: kind === 'program' ? new Date(when).getTime() : null, venue: (fd.get('venue') || '').trim(), pinned: !!fd.get('pinned'), published: !!fd.get('published') };
    if (img) d.img = img;
    const b = f.querySelector('[type=submit]'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Posting…';
    const id = f.dataset.id;
    if (await RC.run(id ? RC.api.updatePost(id, d) : RC.api.createPost(d), id ? 'Post updated' : 'Posted. It is live now.')) { BS.editing = null; reform(); }
    else { b.disabled = false; b.textContent = 'Post'; }
  };
})();
