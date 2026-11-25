/* ------------------------------------------------------------------
 * Maps adapter. Uses Google Maps when RC_CONFIG.GOOGLE_MAPS_API_KEY is
 * set, and falls back to Leaflet + OpenStreetMap (CARTO tiles) otherwise.
 * The rest of the app only talks to this small API.
 * ------------------------------------------------------------------ */
(function () {
  const C = window.RC_CONFIG;
  const toRad = (d) => (d * Math.PI) / 180;

  function haversineKm(a, b) {
    const R = 6371, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function pathLengthKm(path) { let d = 0; for (let i = 1; i < path.length; i++) d += haversineKm(path[i - 1], path[i]); return d; }
  // Point at fraction t (0..1) along a polyline.
  function along(path, t) {
    if (!path || !path.length) return null;
    if (t <= 0 || path.length === 1) return path[0];
    if (t >= 1) return path[path.length - 1];
    const total = pathLengthKm(path); let target = total * t;
    for (let i = 1; i < path.length; i++) {
      const seg = haversineKm(path[i - 1], path[i]);
      if (target <= seg) { const f = seg ? target / seg : 0; return { lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * f, lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * f }; }
      target -= seg;
    }
    return path[path.length - 1];
  }
  // Fallback "road-ish" path: an L-shaped dog-leg so it doesn't look like a crow-flies line.
  function fakeRoute(a, b) {
    const mid = Math.abs(a.lat - b.lat) > Math.abs(a.lng - b.lng) ? { lat: b.lat, lng: a.lng } : { lat: a.lat, lng: b.lng };
    const bend = { lat: (a.lat + mid.lat) / 2 + (mid.lat - a.lat) * 0.2, lng: (a.lng + mid.lng) / 2 + (mid.lng - a.lng) * 0.2 };
    return [a, bend, mid, b];
  }

  const SVG = {
    keke: (c) => `<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><path fill="${c}" d="M6 9h13l5 6h3a2 2 0 0 1 2 2v5h-2.2a3.5 3.5 0 0 0-6.6 0h-7.4a3.5 3.5 0 0 0-6.6 0H3v-5l3-8Zm2 2-1.8 5H13v-5H8Zm7 0v5h6.6l-4.1-5H15Z"/><circle cx="8.5" cy="23" r="2.5" fill="${c}"/><circle cx="24.5" cy="23" r="2.5" fill="${c}"/></svg>`,
    bike: (c) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>`,
    store: (c) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V7"/></svg>`,
  };
  const COLORS = { pickup: '#098A44', dropoff: '#D52027', me: '#241F5E', keke: '#241F5E', bike: '#241F5E', store: '#241F5E', request: '#D52027', pin: '#000000' };

  function markerHTML(kind, label) {
    const col = COLORS[kind] || '#241F5E';
    if (kind === 'keke' || kind === 'bike' || kind === 'store') {
      return `<div class="mk mk-vehicle" style="--mk:${col}">${SVG[kind]('#fff')}</div>${label ? `<span class="mk-label">${label}</span>` : ''}`;
    }
    if (kind === 'me') return `<div class="mk mk-me"></div>`;
    return `<div class="mk mk-pin" style="--mk:${col}"><span>${kind === 'pickup' ? 'A' : kind === 'dropoff' ? 'B' : ''}</span></div>${label ? `<span class="mk-label">${label}</span>` : ''}`;
  }
  function markerSVGUrl(kind) {
    const col = COLORS[kind] || '#241F5E';
    let svg;
    if (kind === 'me') svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="10" fill="${col}" fill-opacity=".25"/><circle cx="11" cy="11" r="6" fill="${col}" stroke="#fff" stroke-width="2.5"/></svg>`;
    else if (kind === 'keke' || kind === 'bike' || kind === 'store') {
      const inner = SVG[kind]('#fff').replace(/width="\d+" height="\d+"/, 'x="9" y="9" width="22" height="22"');
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="${col}" stroke="#fff" stroke-width="3"/>${inner}</svg>`;
    } else {
      const t = kind === 'pickup' ? 'A' : kind === 'dropoff' ? 'B' : '';
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42"><path d="M16 1C8 1 2 7 2 15c0 10 14 26 14 26s14-16 14-26C30 7 24 1 16 1Z" fill="${col}" stroke="#fff" stroke-width="2"/><text x="16" y="20" font-family="Arial" font-weight="700" font-size="13" fill="#fff" text-anchor="middle">${t}</text></svg>`;
    }
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  // Keep fitted points clear of the floating sheet (bottom on phones, right on desktop).
  function sheetPad(pad) {
    const sh = document.getElementById('sheet');
    const h = sh ? sh.getBoundingClientRect() : null;
    if (!h) return { top: pad, right: pad, bottom: pad, left: pad };
    if (window.innerWidth >= 900) return { top: pad, left: pad, bottom: pad, right: h.width + 32 + pad / 2 };
    return { top: pad + 20, left: pad / 2, right: pad / 2, bottom: h.height + pad / 3 };
  }

  /* ---------------- Google implementation ---------------- */
  let gReady = null;
  let googleBroken = false;
  function loadGoogle() {
    if (gReady) return gReady;
    gReady = new Promise((resolve, reject) => {
      window.__rcGoogleReady = () => resolve(window.google);
      const s = document.createElement('script');
      // If Google rejects the key (billing off, wrong domain), fall back to OpenStreetMap for this tab.
      window.gm_authFailure = () => { try { sessionStorage.setItem('rcgo.mapFallback', '1'); } catch (e) { /* ignore */ } location.reload(); };
      // Google reports billing / referrer / API-not-enabled problems only via console.error ("Google Maps JavaScript API error: X").
      const origError = console.error.bind(console);
      console.error = (...args) => {
        try { if (/Google Maps JavaScript API error: (BillingNotEnabled|RefererNotAllowed|ApiNotActivated|ApiTargetBlocked|InvalidKey|ExpiredKey)/.test(String(args[0]))) { googleBroken = true; setTimeout(() => window.gm_authFailure(), 300); } } catch (e) { /* ignore */ }
        origError(...args);
      };
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(C.GOOGLE_MAPS_API_KEY)}&libraries=geometry&callback=__rcGoogleReady&v=weekly&loading=async`;
      s.async = true; s.onerror = reject;
      document.head.appendChild(s);
    });
    return gReady;
  }
  const GoogleImpl = {
    name: 'google',
    async create(el, opts) {
      const google = await loadGoogle();
      const map = new google.maps.Map(el, {
        center: opts.center || C.CENTER, zoom: opts.zoom || 15, disableDefaultUI: true, zoomControl: true,
        clickableIcons: false, gestureHandling: 'greedy',
        styles: [{ featureType: 'poi.business', stylers: [{ visibility: 'off' }] }],
      });
      if (opts.onClick) map.addListener('click', (e) => opts.onClick({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      // Billing/key problems don't trigger gm_authFailure — Google just shows an error box and
      // "for development purposes only" tiles. Detect that and switch this tab to OpenStreetMap.
      setTimeout(() => {
        const t = el.textContent || '';
        if (googleBroken || el.querySelector('.gm-err-container') || /can.t load Google Maps|development purposes only/i.test(t)) window.gm_authFailure();
      }, 3500);
      return {
        raw: map,
        marker(pos, kind, label) {
          const m = new google.maps.Marker({ position: pos, map, icon: { url: markerSVGUrl(kind), anchor: kind === 'pickup' || kind === 'dropoff' || kind === 'pin' ? new google.maps.Point(16, 42) : new google.maps.Point(kind === 'me' ? 11 : 20, kind === 'me' ? 11 : 20) }, title: label || '' });
          return { setPos: (p) => m.setPosition(p), remove: () => m.setMap(null) };
        },
        line(path, style = {}) {
          const l = new google.maps.Polyline({ path, map, strokeColor: style.color || '#098A44', strokeWeight: style.weight || 5, strokeOpacity: style.dashed ? 0 : 0.9, icons: style.dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '12px' }] : [] });
          return { setPath: (p) => l.setPath(p), remove: () => l.setMap(null) };
        },
        fit(points, pad = 60) {
          const pts = points.filter(Boolean); if (!pts.length) return;
          if (pts.length === 1) { map.setCenter(pts[0]); map.setZoom(16); return; }
          const b = new google.maps.LatLngBounds(); pts.forEach((p) => b.extend(p)); map.fitBounds(b, sheetPad(pad));
        },
        center(p, z) { map.panTo(p); if (z) map.setZoom(z); },
        invalidate() {},
        destroy() { el.innerHTML = ''; },
      };
    },
    // Routes API (the legacy Directions API can't be enabled on new Google Cloud projects).
    async route(a, b) {
      const google = await loadGoogle();
      try {
        const ll = (p) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
        const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': C.GOOGLE_MAPS_API_KEY, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline' },
          body: JSON.stringify({ origin: ll(a), destination: ll(b), travelMode: 'DRIVE' }),
        });
        if (!res.ok) throw new Error('Routes API ' + res.status);
        const r = (await res.json()).routes[0];
        const path = google.maps.geometry.encoding.decodePath(r.polyline.encodedPolyline).map((p) => ({ lat: p.lat(), lng: p.lng() }));
        return { path, distKm: r.distanceMeters / 1000, mins: parseFloat(r.duration) / 60, source: 'google' };
      } catch (e) { console.warn('Route fallback:', e.message); return fallbackRoute(a, b); }
    },
    async reverse(p) {
      const google = await loadGoogle();
      try {
        const res = await new google.maps.Geocoder().geocode({ location: p });
        if (res.results && res.results[0]) return res.results[0].formatted_address.split(',').slice(0, 2).join(',');
      } catch (e) { /* fall through */ }
      return nearestLabel(p);
    },
  };

  /* ---------------- Leaflet implementation ---------------- */
  const LeafletImpl = {
    name: 'leaflet',
    async create(el, opts) {
      const map = L.map(el, { zoomControl: false, attributionControl: true }).setView(opts.center || C.CENTER, opts.zoom || 15);
      L.control.zoom({ position: 'topright' }).addTo(map);
      // OpenStreetMap standard tiles — fine for a prototype; use Google Maps (or a paid tile host) in production.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      if (opts.onClick) map.on('click', (e) => opts.onClick({ lat: e.latlng.lat, lng: e.latlng.lng }));
      // Views can re-render while async work is in flight; ignore calls once the container is gone.
      let dead = false;
      const alive = () => !dead && document.body.contains(el);
      const noop = { setPos() {}, setPath() {}, remove() {} };
      // Recompute size once layout settles (and on viewport changes) so no grey, untiled areas remain.
      setTimeout(() => alive() && map.invalidateSize(), 120);
      if (window.ResizeObserver) new ResizeObserver(() => alive() && map.invalidateSize()).observe(el);
      return {
        raw: map,
        marker(pos, kind, label) {
          if (!alive() || !pos) return noop;
          const pin = kind === 'pickup' || kind === 'dropoff' || kind === 'pin';
          const icon = L.divIcon({ className: 'mk-wrap', html: markerHTML(kind, label), iconSize: pin ? [32, 42] : kind === 'me' ? [22, 22] : [40, 40], iconAnchor: pin ? [16, 42] : kind === 'me' ? [11, 11] : [20, 20] });
          const m = L.marker(pos, { icon, keyboard: false, title: label || '' }).addTo(map);
          return { setPos: (p) => { if (alive() && p) m.setLatLng(p); }, remove: () => { try { m.remove(); } catch (e) { /* gone */ } } };
        },
        line(path, style = {}) {
          if (!alive() || !path || !path.length) return noop;
          const l = L.polyline(path, { color: style.color || '#098A44', weight: style.weight || 5, opacity: 0.9, dashArray: style.dashed ? '2 10' : null, lineCap: 'round' }).addTo(map);
          return { setPath: (p) => l.setLatLngs(p), remove: () => { try { l.remove(); } catch (e) { /* gone */ } } };
        },
        fit(points, pad = 60) {
          if (!alive()) return;
          const pts = points.filter(Boolean); if (!pts.length) return;
          if (pts.length === 1) { map.setView(pts[0], 16, { animate: false }); return; }
          const s = sheetPad(pad);
          map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [s.left, s.top], paddingBottomRight: [s.right, s.bottom], maxZoom: 17, animate: false });
        },
        center(p, z) { if (alive()) map.setView(p, z || map.getZoom(), { animate: false }); },
        invalidate() { setTimeout(() => alive() && map.invalidateSize(), 50); },
        destroy() { dead = true; try { map.stop(); map.off(); map.remove(); } catch (e) { /* already gone */ } },
      };
    },
    async route(a, b) { return fallbackRoute(a, b); },
    async reverse(p) { return nearestLabel(p); },
  };

  function fallbackRoute(a, b) {
    const path = fakeRoute(a, b);
    const distKm = Math.max(0.2, haversineKm(a, b) * C.ROAD_FACTOR);
    return { path, distKm, mins: (distKm / C.SPEED_KMH.keke) * 60, source: 'estimate' };
  }
  function nearestLabel(p) {
    let best = null, bd = Infinity;
    C.LANDMARKS.forEach((l) => { const d = haversineKm(p, l); if (d < bd) { bd = d; best = l; } });
    return bd < 0.08 ? best.label : `Near ${best.label}`;
  }

  let fellBack = false; try { fellBack = sessionStorage.getItem('rcgo.mapFallback') === '1'; } catch (e) { /* ignore */ }
  const impl = C.GOOGLE_MAPS_API_KEY && !fellBack ? GoogleImpl : LeafletImpl;
  if (fellBack) console.warn('Google Maps key was rejected — using OpenStreetMap. Check billing and the key\'s website restrictions.');

  window.RCMap = {
    provider: impl.name,
    create: (el, opts = {}) => impl.create(el, opts).catch((e) => { console.warn('Map fallback:', e); return LeafletImpl.create(el, opts); }),
    route: (a, b) => impl.route(a, b),
    reverse: (p) => impl.reverse(p),
    haversineKm, pathLengthKm, along, nearestLabel, SVG,
    inServiceArea: (p) => haversineKm(p, C.CENTER) <= C.SERVICE_RADIUS_KM,
  };
})();
