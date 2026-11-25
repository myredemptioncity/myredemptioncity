/* ------------------------------------------------------------------
 * RC Go configuration
 * Paste your Google Maps JavaScript API key below to switch the app
 * from the OpenStreetMap fallback to Google Maps (with Directions-based
 * routes + ETAs and reverse geocoding).
 *   Enable these APIs in Google Cloud: Maps JavaScript API, Directions API,
 *   Geocoding API. Restrict the key to your domain(s).
 * ------------------------------------------------------------------ */
window.RC_CONFIG = {
  APP_NAME: 'RC Go',
  TAGLINE: 'Rides, deliveries & shopping in Redemption City',

  // Restricted in Google Cloud to myredemptioncity.com (+ localhost for testing) and to the Maps JavaScript, Routes and Geocoding APIs.
  GOOGLE_MAPS_API_KEY: 'AIzaSyCl9KPrkpddXKlblnmdKKyScNVvGIcS81E',

  // Approximate centre of Redemption City (Redemption Camp), Km 46 Lagos–Ibadan Expressway, Mowe.
  CENTER: { lat: 6.8122, lng: 3.4458 },
  SERVICE_RADIUS_KM: 4,

  // Supabase project (the publishable key is designed to be public; row-level security protects the data).
  SUPABASE_URL: 'https://dnswfzegpbuxsabrelcf.supabase.co',
  SUPABASE_KEY: 'sb_publishable_mP2Yk1tUclDzT93TszZ9zw_MLKKtXlg',

  // LIVE: real accounts and data on Supabase. Set to true to return to the browser-only preview
  // with sample riders/shops. You can still open the preview in one tab with ?mode=preview
  // (and go back to live with ?mode=live).
  DEMO_MODE: false,

  // Preview-only admin PIN. Anyone can read this file, so it is NOT security — real admin login comes with the backend.
  ADMIN_PIN: '7391',

  // Demo simulation speed for bot riders (1 = real time).
  DEMO_SPEED: 8,

  FARES: {
    keke: { base: 300, perKm: 150, min: 300 },
    bike: { base: 400, perKm: 120, min: 400 },
  },
  SPEED_KMH: { keke: 20, bike: 13 },
  ROAD_FACTOR: 1.3, // straight-line → road distance when Directions API is unavailable

  // PLACEHOLDER coordinates — walk the camp with GPS and correct these before launch.
  LANDMARKS: [
    { id: 'gate', label: 'Main Gate (Expressway)', lat: 6.8085, lng: 3.4405 },
    { id: 'arena', label: 'New Arena / Congress Ground', lat: 6.8190, lng: 3.4520 },
    { id: 'oldaud', label: 'Old Auditorium', lat: 6.8128, lng: 3.4452 },
    { id: 'emmanuel', label: 'Emmanuel Park', lat: 6.8110, lng: 3.4470 },
    { id: 'market', label: 'Camp Market', lat: 6.8100, lng: 3.4440 },
    { id: 'clinic', label: 'Camp Clinic', lat: 6.8140, lng: 3.4430 },
    { id: 'youth', label: 'Youth Centre', lat: 6.8155, lng: 3.4485 },
    { id: 'school', label: "Redeemer's High School", lat: 6.8170, lng: 3.4410 },
    { id: 'chalets', label: 'Guest Chalets', lat: 6.8135, lng: 3.4500 },
    { id: 'carpark', label: 'Car Park A', lat: 6.8160, lng: 3.4460 },
    { id: 'estate1', label: 'Estate – Phase 1', lat: 6.8060, lng: 3.4480 },
    { id: 'estate2', label: 'Estate – Phase 2', lat: 6.8050, lng: 3.4530 },
  ],

  BANKS: ['Access Bank', 'First Bank', 'GTBank', 'UBA', 'Zenith Bank', 'Fidelity Bank', 'Union Bank', 'Sterling Bank', 'Wema Bank', 'Polaris Bank', 'Stanbic IBTC', 'FCMB', 'Ecobank', 'Opay', 'Moniepoint', 'Palmpay', 'Kuda'],
};

// Testing switch: ?mode=live or ?mode=preview (remembered for this browser tab).
(function () {
  try {
    const m = new URLSearchParams(location.search).get('mode');
    if (m === 'live' || m === 'preview') sessionStorage.setItem('rcgo.mode', m);
    const saved = sessionStorage.getItem('rcgo.mode');
    if (saved === 'live') window.RC_CONFIG.DEMO_MODE = false;
    if (saved === 'preview') window.RC_CONFIG.DEMO_MODE = true;
  } catch (e) { /* ignore */ }
})();
