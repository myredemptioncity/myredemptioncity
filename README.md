# RC Go: rides, deliveries & shopping for Redemption City

A working, mobile-first web prototype for Redemption City (Mowe, Ogun State). It covers:

- **Customers**: book a Keke, send a parcel, or order from restaurants, supermarkets and retailers. You name your price. Riders accept it or counter-offer, and you pick the offer you want (InDrive-style). Then you track the rider live with an ETA, pay by cash or bank transfer, and rate the rider and the store.
- **Keke riders & bicycle dispatch riders**: sign up, complete a 5-step KYC (NIN, licence, LASDRI, hackney permit, vehicle papers, insurance, guarantor, payout bank), and wait for admin approval. After approval: go online, share live location, see requests on the map, accept or counter-offer, and work through each job (arrived → started → completed). Riders also get earnings, reviews, and an optional "upfront transfer" requirement.
- **Vendors**: set up a store (type, location pin, hours, bank details, upfront payment), manage the catalogue (prices, photos, availability), accept, reject or mark orders ready, and confirm transfers.
- **Admin**: review KYC applications and documents, approve, reject with a reason, or suspend riders. There's also a live operations map and a directory of riders, vendors, customers and trips.

## Run it

```powershell
node serve.js
```

Open http://localhost:5173. No install step is needed.

### Demo tips
- Demo riders and shops reply on their own, so a single tab shows the full flow.
- To see the real offer and counter-offer between two people, open **two tabs**. Sign in as a customer in one and as a Keke rider in the other. Each tab keeps its own sign-in.
- The SMS code is **123456**. The admin PIN is **1234** (set in `js/config.js`).
- **Reset demo data** is on the landing page and in Account.

## Google Maps
The map runs on OpenStreetMap until you add a key. To switch to Google Maps:
1. In Google Cloud, enable **Maps JavaScript API**, **Directions API** and **Geocoding API**.
2. Paste the key into `GOOGLE_MAPS_API_KEY` in `js/config.js`, and restrict it to your domain.

With a key, routes and ETAs come from Google Directions and pin labels come from reverse geocoding.

**Before launch:** the landmark coordinates in `js/config.js` (Main Gate, New Arena, Old Auditorium, etc.) are **placeholders**. Walk the camp with GPS and correct them.

## Files
| File | Purpose |
|---|---|
| `js/config.js` | App name, map key, city centre, fares, speeds, landmarks, banks |
| `js/store.js` | Mock backend (localStorage, synced across tabs) + seed data |
| `js/map.js` | Map adapter: Google Maps or Leaflet/OSM behind one API |
| `js/core.js` | Router, app shell, helpers, demo simulation of bot riders |
| `js/auth.js` | Landing page and phone + OTP sign-in for each role |
| `js/customer.js` · `rider.js` · `vendor.js` · `admin.js` | Screens for each role |
| `css/styles.css` | Design tokens (RCCG indigo / green / red, light + dark) and components |
| `design-system/rc-go/MASTER.md` | Design rules used for the UI |

## Going to production (not in this prototype)
This prototype keeps all data in the browser. A real launch needs:
- **Backend + realtime:** Firebase (Auth, Firestore, Storage) or Supabase. Replace `store.js`. Live rider locations go through realtime listeners.
- **Real phone OTP:** Firebase Phone Auth or Termii.
- **Private storage for KYC documents.** Optionally add NIN, BVN and licence lookups through a provider such as Prembly, Dojah or YouVerify.
- **Native apps:** wrap the app (Capacitor) or rebuild it (React Native/Flutter) so riders can share location in the background.
- **Push notifications** for new requests, offers and order updates.
- **Payments:** today, cash or direct transfer with manual confirmation. Optionally add Paystack or Flutterwave virtual accounts so transfers confirm automatically.
- **Admin roles with 2FA**, audit logs, dispute handling, and a list of requirements confirmed with Lagos and Ogun state agencies.

Logos: the RCCG emblem in `assets/` is cropped from `media/RCCG-PR-LOGOS.png`. No separate Redemption City logo was found in `media/`. Add one and replace the emblem in `index.html` and the brand blocks.
