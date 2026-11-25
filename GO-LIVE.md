# RC Go — Go-live checklist

**Where things stand:** www.myredemptioncity.com is live as a **preview**. A yellow "Preview · not live" badge is shown, and a notice on the home page says bookings don't reach real riders. To turn it into the real service, work through the steps below in order.

> **Maps status (25 Nov):** key added to `js/config.js` and restricted to `www.myredemptioncity.com`, `myredemptioncity.com`, `localhost:5174` and the Maps JavaScript / Routes / Geocoding APIs. Google says the free trial **requires a prepayment** (Google Cloud → Billing → Make a payment). Until it's credited (up to 24h), the app detects Google's billing error and falls back to OpenStreetMap automatically. After it's active: set daily quota caps (APIs & Services → each API → Quotas) and a budget alert (Billing → Budgets & alerts).

## 1. Google Maps key — needs you
1. Open https://console.cloud.google.com/google/maps-apis/start (project **My Maps Project**).
2. Click **Verify account** and add your phone number and payment card. Google gives monthly free usage, and you're not charged until you upgrade the account.
3. Tell Claude when it's done. Claude will then:
   - Turn on **Maps JavaScript API**, **Routes API** and **Geocoding API**.
   - Create a key that only works on `www.myredemptioncity.com`, `myredemptioncity.com` and `localhost`, and only for those 3 APIs.
   - Set a daily usage limit so a bug can't run up a bill.
   - Put the key in `js/config.js` and rebuild the zip.

## 2. Supabase (database, logins, file storage, live updates) — needs you
1. Sign up at https://supabase.com. Create a project named **rcgo**, region **West EU (London)** or **Frankfurt**, and save the database password somewhere safe.
2. In the project, go to **SQL Editor → New query**. Paste all of `supabase/schema.sql` and click **Run**.
3. Go to **Project Settings → API**. Send Claude the **Project URL** and the **anon / publishable key**. Both are meant to be public.
   **Never** share the `service_role` / secret key with anyone, and never put it in the website.
4. Go to **Authentication → URL configuration**. Set Site URL to `https://www.myredemptioncity.com`.

> **Status:** the app is now connected to the Supabase project. The site still shows the preview to the public (`DEMO_MODE: true`). Add `?mode=live` to the address (for example `https://www.myredemptioncity.com/?mode=live`) to use the real backend in that tab, and `?mode=preview` to switch back.

## 3. SMS codes for phone login — needs you
**Free test numbers first:** in Supabase, go to **Authentication → Providers → Phone → Test Phone Numbers and OTPs**. Add entries like `2348000000001=123456`, `2348000000002=123456`, `2348000000003=123456`. These numbers sign in with that code and no SMS is sent, so testing costs nothing.

Supabase can send login codes through an SMS provider. Sign up for one:
- **Twilio** (works with Supabase out of the box). Get the Account SID, a Verify Service SID and the Auth Token. In Supabase, go to **Authentication → Providers → Phone**, choose **Twilio Verify**, paste them, and save. You enter these into Supabase yourself; don't send them to anyone.
- **Termii** (Nigerian, usually cheaper, handles DND numbers). This needs a small "Send SMS hook" function, which Claude can write.

Budget for roughly a few naira per login code, and set a spending cap in the provider's dashboard.

## 4. Built (waiting on steps 2–3 to test end to end)
- Swap the browser-only store for Supabase:
  - real accounts with phone + SMS code
  - shared data
  - live offers, trip status and rider location over Realtime
- Store KYC documents in a **private** storage bucket. Store photos and logos in a public one.
- Make every status change (accept an offer, start or complete a trip, approve a rider, mark an order ready) go through server functions that check who's asking. This is already written in `schema.sql`.
- Turn off the sample riders and shops (`DEMO_MODE: false`) and remove the preview badge.
- Make your phone number the admin account (one SQL line at the bottom of `schema.sql`).

## 5. Before announcing
- Walk the camp with a phone and fix the landmark coordinates in `js/config.js`.
- Write Terms of Service and a Privacy Policy. KYC data and phone numbers are covered by Nigeria's data protection law (NDPA 2023).
- Test with 2–3 real riders and a vendor for a week.
- Riders need the app open to share location. For background tracking, the next step is wrapping the site as an Android app.

## Security issues found in the preview (and what fixes them)
| Issue | Status |
|---|---|
| Admin PIN was shown on the public home page | **Fixed:** hint removed and PIN changed. Still not real security until Supabase admin login. |
| Sample riders could fool real visitors into thinking a keke is coming | **Fixed for now:** preview notice and badge. Fully fixed when `DEMO_MODE` is off. |
| Anyone can "log in" as any phone number (fake SMS code) | Fixed by step 3 |
| Data only exists in each visitor's browser; riders never see real customers | Fixed by step 2 + 4 |
| JavaScript updates were cached for 7 days on Hostinger | **Fixed:** cache rules + `?v=` version tags |
| `myredemptioncity.com` and `www.` both served the site | **Fixed:** everything redirects to `https://www.myredemptioncity.com` |
| OpenStreetMap tiles aren't meant for heavy production use | Fixed by step 1 |
