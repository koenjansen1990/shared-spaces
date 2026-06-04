# Shared Spaces – Project Structure

## Folder layout

```
shared-spaces/
├── schema.sql                          ← Full PostgreSQL schema + RLS + RPCs
│
├── src/
│   ├── types/
│   │   └── index.ts                    ← All domain interfaces + DB type map
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts               ← Server-side Supabase client (+ service role)
│   │   │   └── client.ts               ← Browser singleton client
│   │   ├── guards/
│   │   │   └── subscription.ts         ← checkSpaceFeatureAccess() paywall guard
│   │   └── actions/
│   │       ├── booking.ts              ← createBooking() / cancelBooking() Server Actions
│   │       └── resource.ts             ← createResource() / inviteMember() Server Actions
│   │
│   ├── app/
│   │   ├── layout.tsx                  ← Root layout: PWA meta, fonts, theme
│   │   ├── manifest.ts                 ← next/manifest: PWA manifest.webmanifest
│   │   ├── globals.css
│   │   │
│   │   └── space/
│   │       └── [slug]/
│   │           ├── layout.tsx          ← Adaptive shell: sidebar (md+) / bottom nav (mobile)
│   │           ├── schedule/
│   │           │   └── page.tsx        ← Resource + slot grid with booking buttons
│   │           ├── resources/
│   │           │   └── page.tsx        ← Resource management (admin-gated)
│   │           ├── bookings/
│   │           │   └── page.tsx        ← User's own booking history
│   │           ├── members/
│   │           │   └── page.tsx        ← Roster + invite (admin-gated)
│   │           └── settings/
│   │               └── page.tsx        ← Space settings, rules, subscription (owner-gated)
│   │
│   └── components/
│       └── space/
│           └── BookSlotButton.tsx      ← Client component: calls createBooking SA
│
└── public/
    ├── icons/                          ← icon-192.png, icon-512.png, apple-touch-icon.png
    └── splash/                         ← Apple launch screen images per device
```

## Architecture decisions

### Multi-tenancy isolation strategy
Data isolation is enforced at **two independent layers**:
1. **PostgreSQL RLS**: every table has `ENABLE ROW LEVEL SECURITY`. `fn_is_space_member()` and `fn_is_space_admin()` are `SECURITY DEFINER` helpers that check `space_members` independently of the caller's RLS context, preventing bypass.
2. **Application layer**: `createSupabaseServerClient()` always uses the anon key + user JWT, so Supabase automatically attaches `auth.uid()` before evaluating RLS predicates. The service-role client is isolated to webhook handlers only.

### Booking atomicity
`rpc_create_booking()` is a `SECURITY DEFINER` PostgreSQL function that runs **all guards in one transaction**:
- membership check
- duplicate check
- capacity check (COUNT confirmed bookings)
- weekly credit check (SUM credits_consumed)
- INSERT

This eliminates TOCTOU races that would be possible if the Server Action did these checks as separate sequential queries.

### Rules engine
`space_rules` is a generic key-value table keyed by `rule_key` enum. Adding a new rule type requires:
1. Adding a value to the `rule_key` enum in the schema.
2. Adding a check in `rpc_create_booking()` (or a new RPC for non-booking rules).
3. Adding the key to `RuleKey` in `types/index.ts`.

No application code changes are needed to store or read the rule value.

### Paywall guard
`checkSpaceFeatureAccess(spaceId, feature)` calls `rpc_check_space_feature_access()`.
The RPC returns `{ allowed: false, error: 'SUBSCRIPTION_REQUIRED', limit, current }`.
The `SUBSCRIPTION_REQUIRED` error code is the Stripe UI trigger – wire `limit` and `current` directly into the upgrade modal copy.

### PWA
- `manifest.ts` uses Next.js `MetadataRoute.Manifest` (App Router) – Next.js serialises it to `/manifest.webmanifest` automatically.
- `viewport: 'cover'` + `apple-mobile-web-app-status-bar-style: 'black-translucent'` lets the app paint under the iPhone notch and home indicator.
- `pb-[env(safe-area-inset-bottom)]` on the mobile bottom nav prevents it from clipping behind the home indicator.

### Responsive layout constraints
The `max-w-6xl mx-auto` wrapper in `[slug]/layout.tsx` caps content at ~72rem regardless of monitor width. This keeps data grids, slot lists, and booking timelines readable on ultrawide displays without any component needing its own width constraint.

## Environment variables required

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never exposed to client
```

## Next steps to wire up

- [ ] `middleware.ts`: protect `/space/*` routes, refresh session cookies
- [ ] Auth pages: `/login`, `/signup` using `@supabase/auth-ui-react` or custom
- [ ] `app/space/[slug]/settings/page.tsx`: space rules editor form
- [ ] Stripe webhook handler at `app/api/webhooks/stripe/route.ts` → updates `subscriptions` table via service-role client
- [ ] Web Push: register service worker, store `PushSubscription` in a `push_subscriptions` table, send on booking confirmation
- [ ] `next.config.ts`: configure `next-pwa` or a custom service worker for offline caching
```
