# Inner Circle — Deployment & Setup

The app runs in three progressively-enabled modes. Each layer is optional and
the app stays fully usable without it:

| Layer | Env / config needed | If missing |
|-------|--------------------|------------|
| App (static) | none | Works, data stored in-browser |
| Accounts | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | No login required (local mode) |
| Subscriptions | `VITE_STRIPE_PRICE_ID` + Stripe edge functions | Everyone treated as Pro (unlocked) |

---

## 1. Hosting (Railway) — already live

- Deployed via Railway from this repo. Build: `npm run build`; start: `npm start`
  (`serve -s dist`). See `railway.json`.
- **Push-to-deploy with a test gate:** connect the GitHub repo in Railway →
  service → Settings → Source, then enable **Wait for CI**. The GitHub Actions
  workflow (`.github/workflows/ci.yml`) runs typecheck + tests + build; Railway
  only deploys a commit after it passes.

---

## 2. Accounts (Supabase)

1. Create a project at supabase.com. Copy **Project URL** and **anon public key**
   (Settings → API).
2. In Railway → service → **Variables**, set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Run the DB migration (`supabase/migrations/0001_profiles.sql`): paste it into
   the Supabase SQL editor, or `supabase db push` with the CLI.
4. Supabase → Authentication → URL Configuration → set **Site URL** and add
   **Redirect URLs** for your Railway URL (and later `inner-circle.com`).
5. (Optional) Google login: Authentication → Providers → Google → enable and
   paste a Google OAuth client id/secret.

---

## 3. Subscriptions (Stripe + Supabase Edge Functions)

1. In Stripe, create a **Product** with a **recurring monthly Price**. Copy the
   price id (`price_...`).
2. In Railway → Variables, set `VITE_STRIPE_PRICE_ID` to that price id.
3. Deploy the edge functions (needs the Supabase CLI, `supabase link`ed to the project):
   ```bash
   supabase functions deploy create-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
4. Set function secrets:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...   # from step 5
   ```
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.)
5. In Stripe → Developers → Webhooks, add an endpoint pointing at the
   `stripe-webhook` function URL and subscribe to:
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its signing secret into step 4.

Once set, the "Upgrade to Pro" flow, paywalled features (AI tutor, replay trainer,
edge finder, algorithm export) and the billing portal all work. 7-day free trial,
$19/month (change the trial in `create-checkout`, the price in Stripe).

---

## 4. Custom domain (optional)

Register `inner-circle.com` (Cloudflare recommended — supports the apex CNAME
Railway needs), then add the CNAME + TXT records Railway shows under the service's
domain settings, and add the domain to Supabase redirect URLs.

---

## Local development

```bash
cp .env.example .env.local   # fill in to test auth/billing locally (optional)
npm run dev
```
