# Nova

A social super-app — posts, communities, messaging, live streaming, Pulse videos, calls, marketplace, and a NOVA coin wallet. Built with React 19, Vite, Tailwind CSS 4, and Supabase.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- **Payments:** Stripe Checkout → webhook credits the NOVA wallet
- **Calls/Live:** WebRTC mesh signaling over Supabase Realtime

## Develop

```bash
npm install
npm run dev
```

Copy `.env.example` values into `.env`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## Database & functions

```bash
supabase link --project-ref <ref>
supabase db push          # apply migrations
supabase functions deploy # deploy edge functions
```

Edge functions: `create-checkout` (Stripe coin purchases), `stripe-webhook` (credits wallet on payment).
Secrets required for payments: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

## Build

```bash
npm run build
```
