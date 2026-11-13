# FabriLink Mobile — Master Prompt (React Native + Expo)

> Copy everything below the line into your AI coding assistant as the first message of a new project.
> It is self-contained: it describes the product, the existing backend API contract, the business
> rules, and exactly what to build.

---

## 1. Your role

You are a senior React Native engineer. You are building **FabriLink Mobile**, the official iOS + Android
app for an existing B2B marketplace. The backend (Django REST Framework) and a React web app already
exist and are in production use. **Do not invent endpoints or fields.** Use the API contract in
section 6 exactly. If something you need is missing, stop and list it under "Backend changes required"
instead of faking it.

Work in small, verifiable phases (section 11). After each phase, the app must build and run in
Expo Go / a dev build with no TypeScript errors.

## 2. Product context

FabriLink connects **Bangladeshi export garment factories** that have surplus fabric rolls with
**small boutiques, brands and fashion startups** that need short lengths. Fabric is cut precisely at a
central **hub** (Tejgaon, Dhaka) and delivered by courier.

There are four user roles (`user.role`):

| Role        | Who                          | Main jobs in the app |
|-------------|------------------------------|----------------------|
| `BUYER`     | Boutique / brand / startup   | Browse catalog, view mill storefronts, see exclusive profiles built for them, cart, checkout, track orders, cancel early orders |
| `FACTORY`   | Garment factory / mill       | List surplus rolls, build custom fabric profiles for a specific buyer, see orders containing their rolls, see revenue |
| `HUB_STAFF` | FabriLink cutting-hub worker | Work the order queue, advance order status, scan barcodes |
| `ADMIN`     | Central admin                | KYC approval queue (approve with credit limit / reject), see all orders |

Every FACTORY and BUYER account has exactly one **company** (`user.company`). A company must have
`verification_status === "APPROVED"` (KYC) before it can list fabric (factory) or check out (buyer).
Until then, route them to a "Pending approval" screen where they can submit trade licence / TIN / BIN.

Languages: **Bangla (`bn`, default) and English (`en`)**. Currency: **BDT (৳)**. Time zone: Asia/Dhaka.

## 3. Tech stack (use exactly this unless there is a strong reason)

- **Expo** (latest stable SDK) with **TypeScript strict mode**, managed workflow + EAS Build.
- **expo-router** (file-based routing, typed routes) with route groups per role.
- **@tanstack/react-query** for all server state (caching, retries, pull-to-refresh, optimistic cart updates).
- **zustand** for client state (auth session, language, UI prefs).
- **axios** with a single configured instance and interceptors (section 5).
- **react-hook-form + zod** for every form.
- **expo-secure-store** for tokens (never AsyncStorage for secrets).
- **i18next + react-i18next + expo-localization** for bn/en. Ship a Bangla-capable font (e.g. Noto Sans Bengali via `expo-font`).
- **NativeWind** (Tailwind for RN) so design tokens match the web app's Tailwind theme.
- **expo-image** for fabric photos (caching, placeholders).
- **expo-camera** (barcode scanning) for the hub role.
- **expo-haptics**, **react-native-safe-area-context**, **react-native-gesture-handler**, **@gorhom/bottom-sheet** (cart / filters).
- Testing: **jest-expo + @testing-library/react-native**; pure business-rule functions must have unit tests.
- Lint/format: ESLint (expo config) + Prettier.

## 4. Project structure

```
app/
  _layout.tsx                 # providers, fonts, auth bootstrap, splash screen
  (public)/                   # catalog browse, roll detail, mill storefronts (no login required)
  (auth)/login.tsx, register.tsx, pending-approval.tsx
  (buyer)/                    # tabs: Catalog, Exclusive, Cart, Orders, Profile
  (factory)/                  # tabs: Dashboard, My Stock, New Listing, Orders, Profile
  (hub)/                      # tabs: Queue, Scan, Profile
  (admin)/                    # tabs: KYC Queue, All Orders, Profile
src/
  api/client.ts               # axios instance + interceptors
  api/endpoints/*.ts          # one file per backend app: auth, companies, catalog, orders
  api/types.ts                # TS types from section 7
  features/<domain>/          # hooks (useQuery/useMutation wrappers), components, screens logic
  lib/pricing.ts              # fee calculator (section 8.2) — pure + unit tested
  lib/breakdown.ts            # roll-breakdown validator (section 8.1) — pure + unit tested
  lib/orderStatus.ts          # status pipeline, labels, allowed next steps (section 8.3)
  lib/format.ts               # formatBDT, dates, yards
  store/auth.ts               # zustand auth store
  i18n/{index.ts, bn.json, en.json}
  components/ui/              # Button, Input, Card, Badge, EmptyState, ErrorState, Skeleton
```

## 5. Networking & authentication

**Base URL** comes from `EXPO_PUBLIC_API_BASE_URL` (e.g. `https://api.example.com/api/v1`).
For local dev: Android emulator uses `http://10.0.2.2:8000/api/v1`, iOS simulator `http://localhost:8000/api/v1`,
a physical device uses the computer's LAN IP (and that host must be in the backend's `ALLOWED_HOSTS`).

**Tokens:** JWT. Access token lifetime ≈ 30 min, refresh ≈ 7 days. Refresh tokens are **rotated and
the old one blacklisted on every refresh** — so refreshing twice with the same token logs the user out.

Requirements:
1. Send `Authorization: Bearer <access>` on every request.
2. On a `401` (except from login/register/refresh), run **one single-flight refresh** shared by all
   in-flight requests (a module-level promise), then replay the failed requests once. If refresh fails,
   clear the session and go to login.
3. Store access + refresh tokens in `expo-secure-store`. Restore the session on app start
   (splash screen stays up until `GET /auth/me/` resolves or fails).
4. Logout: `POST /auth/logout/` with `{ "refresh": "<token>" }`, then wipe secure storage and the query cache.

> ⚠️ **Backend change required before auth works on mobile:** the web app receives the refresh token
> only as an httpOnly cookie (`fabrilink_refresh_token`, path `/api/v1/auth/`), and login/register
> responses don't include it in the body. Native apps should not depend on cookies. Add to the backend:
> when the request header `X-Client-Platform: mobile` is present, `register`, `login` and
> `token/refresh` also return `"refresh_token"` inside `data`. `token/refresh` and `logout` already accept
> `{ "refresh": "..." }` in the body. Send `X-Client-Platform: mobile` on every request.

## 6. API contract (existing backend — do not change shapes)

**Envelope.** Success: `{ "success": true, "data": ..., "message"?: string }`.
Error: `{ "success": false, "error": { "code": string, "message": string, "details": object } }`.
Always show `error.message` to the user. Field-level validation errors are in `error.details`
(`{ field: [messages] }`) — map them onto form fields. List endpoints return a plain array in `data`
(not paginated).

Important error codes: `company_not_verified` (403 → route to pending-approval), `insufficient_stock`,
`invalid_roll_breakdown`, `invalid_state_transition`, `credit_not_available`, `credit_limit_exceeded`,
`permission_denied`, `not_found`, `validation_error`.

### Auth — `/auth/`
| Method | Path | Auth | Body / Query | `data` |
|---|---|---|---|---|
| POST | `/auth/register/` | public | `{ email, phone, password(min 8), role: "FACTORY"\|"BUYER", company_name, first_name?, last_name?, preferred_language?: "bn"\|"en" }` | `{ user, access_token }` (201) |
| POST | `/auth/login/` | public | `{ email, password }` | `{ user, access_token }` |
| POST | `/auth/token/refresh/` | public | `{ refresh }` | `{ access_token }` |
| POST | `/auth/logout/` | yes | `{ refresh }` | — |
| GET | `/auth/me/` | yes | — | `User` |
| PATCH | `/auth/me/` | yes | `{ first_name?, last_name?, designation?, preferred_language? }` | `User` |

Phone numbers are Bangladeshi; accept `01XXXXXXXXX`, `8801XXXXXXXXX`, `+8801XXXXXXXXX`
(regex `^(?:\+?88)?01[3-9]\d{8}$`). The server normalises to `+8801XXXXXXXXX`.

### Companies — `/companies/`
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/companies/my-company/` | any logged-in | `Company` (404 `no_company` if none) |
| PATCH | `/companies/my-company/` | owner | KYC fields: `name, trade_license_number, tin_number, bin_number, contact_email, contact_phone` (+ files as multipart: `trade_license_file, tin_file, bin_file`). A REJECTED company goes back to PENDING. |
| GET | `/companies/addresses/` | owner | `CompanyAddress[]` |
| POST | `/companies/addresses/` | owner | `{ address_type: FACTORY_PREMISES\|WAREHOUSE\|BILLING\|DELIVERY, division, district, upazila_thana, street_address, postal_code, landmark?, gps_lat?, gps_lng?, is_default? }` |
| GET | `/companies/buyers/` | FACTORY / ADMIN only | `[{ id, name, contact_email, contact_phone, verification_status }]` for the "build profile for buyer" picker |
| GET | `/companies/factories/` | public | approved mills with `stats` |
| GET | `/companies/factories/{id}/` | public | one mill storefront |
| GET | `/companies/admin/kyc-queue/?status=PENDING\|APPROVED\|REJECTED\|SUSPENDED\|ALL` | ADMIN | default = PENDING |
| POST | `/companies/admin/{id}/verify/` | ADMIN | `{ action: "APPROVE"\|"REJECT"\|"SUSPEND", rejection_reason?, credit_limit?, credit_terms_days? }` |

### Catalog — `/catalog/`
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/catalog/categories/` | public | categories with nested `fabric_types` |
| GET | `/catalog/rolls/` | public (richer when logged in) | query: `search, category (slug), fabric_type (slug), min_gsm, max_gsm, color, min_yards, max_price, factory_id, mine=true (factory: own stock incl. drafts/sold out), custom_only=true (buyer: profiles built for me), target_buyer_id (owner/admin only)` |
| GET | `/catalog/rolls/{id}/` | public | `FabricRollDetail`; private profiles of other buyers return 404 |
| POST | `/catalog/rolls/` | APPROVED FACTORY (or ADMIN with `factory_id`) | see `FabricRollCreate` below; returns `FabricRollDetail` (201) |

Visibility rules enforced by the server: anonymous users and factories browsing see only public rolls;
a buyer sees public rolls **plus** custom profiles where `target_buyer_id === myCompany.id`.

### Orders — `/orders/`
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/orders/cart/` | BUYER | `{ items: CartItem[], fees: Fees }` (fees are strings) |
| POST | `/orders/cart/items/` | BUYER | `{ fabric_roll_id, requested_yards }` → `CartItem` (201). Adding the same roll again **replaces** its yards. |
| DELETE | `/orders/cart/items/{itemId}/` | BUYER | |
| POST | `/orders/checkout/` | APPROVED BUYER | `{ payment_method: BKASH\|NAGAD\|SSLCOMMERZ\|B2B_CREDIT\|COD, delivery_notes?, item_ids?: string[] }`. Omit `item_ids` to check out the whole cart; pass one id for "Buy now". → `Order` (201) |
| GET | `/orders/?status=` | any logged-in | Buyer: own orders. Factory: orders containing its rolls (items filtered to its own). Hub/Admin: all. |
| GET | `/orders/{id}/` | scoped as above | |
| PATCH | `/orders/{id}/status/` | HUB_STAFF / ADMIN; BUYER may only send `CANCELLED` for own order | `{ status, notes?, location? }` |

## 7. TypeScript types (match the server exactly)

Decimal fields arrive as **strings** (e.g. `"250.00"`). Parse with `Number()` only for display/maths;
send numbers or numeric strings back.

```ts
type Role = "FACTORY" | "BUYER" | "HUB_STAFF" | "ADMIN";
type Verification = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

interface User {
  id: string; email: string; phone: string; role: Role;
  is_verified: boolean; is_active: boolean; date_joined: string;
  profile: { id: string; first_name: string; last_name: string; full_name: string;
             designation: string; avatar: string | null; preferred_language: "bn" | "en" } | null;
  company: { id: string; name: string; company_type: "FACTORY" | "BUYER";
             verification_status: Verification; credit_limit: string } | null;
}

interface FabricRollListItem {
  id: string; roll_code: string; title: string; fabric_type_name: string;
  mill_name: string; factory_id: string; mill_location: string;
  composition: string; gsm: number; width_inches: string;
  color_name: string; color_hex: string; pattern: string; finish: string;
  available_yards: string; min_cut_length_yards: string; price_per_yard: string;
  quality_grade: "GRADE_A" | "GRADE_B" | "SURPLUS_FRESH" | "REMNANT";
  status: "DRAFT" | "ACTIVE" | "RESERVED_PARTIAL" | "SOLD_OUT" | "ARCHIVED";
  is_sample_available: boolean; sample_price: string; primary_image: string | null;
  target_buyer_id: string | null; target_buyer_name: string | null;
  is_custom_profile: boolean; buyer_spec_notes: string; created_at: string;
}

interface FabricRollDetail extends Omit<FabricRollListItem, "primary_image"> {
  category_name: string; mill_contact_phone: string; total_yards: string;
  lot_batch_number: string; defect_notes: string; updated_at: string;
  images: { id: string; image_url: string; is_primary: boolean; sort_order: number }[];
}

interface FabricRollCreate {
  title: string; fabric_type: string /* FabricType id */; composition: string;
  gsm: number; width_inches: number; color_name: string; color_hex: string /* #RRGGBB */;
  pattern?: string; finish?: string; total_yards: number; available_yards?: number;
  min_cut_length_yards?: number; price_per_yard: number; lot_batch_number?: string;
  quality_grade?: FabricRollListItem["quality_grade"]; defect_notes?: string;
  is_sample_available?: boolean; sample_price?: number; image_url?: string;
  target_buyer_id?: string | null; buyer_spec_notes?: string;
  factory_id?: string; // ADMIN only
}

interface CartItem {
  id: string; fabric_roll: string; roll_code: string; roll_title: string;
  roll_color_name: string; roll_color_hex: string; roll_gsm: number; roll_width: string;
  roll_available_yards: string; roll_min_cut: string;
  requested_yards: string; unit_price: string; item_subtotal: string; created_at: string;
}

interface Fees {
  items_subtotal: string; platform_commission_fee: string; cutting_fee: string;
  delivery_fee: string; vat_tax_amount: string; total_amount: string;
}

type OrderStatus = "DRAFT" | "REQUESTED" | "QUOTED_CONFIRMED" | "PAID_CREDIT_APPROVED"
  | "PICKUP_SCHEDULED" | "PICKED_UP" | "AT_HUB" | "CUTTING" | "CUT_DONE" | "PACKED"
  | "OUT_FOR_DELIVERY" | "DELIVERED" | "COMPLETED" | "CANCELLED" | "DISPUTED" | "REFUNDED";

interface Order extends Fees {
  id: string; order_number: string; buyer_name: string; status: OrderStatus;
  currency: "BDT"; payment_method: string; delivery_notes: string; cancellation_reason: string;
  items: { id: string; fabric_roll: string; roll_code: string; roll_title: string; color_name: string;
           requested_yards: string; unit_price: string; subtotal: string; status: string }[];
  tracking_events: { id: string; from_status: string; to_status: OrderStatus; title: string;
                     description: string; location: string; created_at: string }[];
  created_at: string; updated_at: string;
}
```

## 8. Business rules to mirror on the client (server stays the source of truth)

### 8.1 Roll-breakdown rule (yard picker)
For a roll with `available` yards and `minCut` minimum cut:
- `requested > 0` and `requested >= minCut`
- `requested <= available`
- leftover `available - requested` must be **0** (take the whole roll) **or `>= minCut`** (no unsellable remnant)

The yard stepper must show which rule is broken, offer a "Take whole roll" shortcut, and disable
Add-to-cart while invalid. Step size 0.5 yd, max 2 decimals.

### 8.2 Price estimate (show live while the user changes yards)
```
fabric      = Σ yards × price_per_yard
commission  = fabric × 0.06
cutting     = 150 + totalYards × 5
delivery    = 120
vat         = (commission + cutting) × 0.15
total       = fabric + commission + cutting + delivery + vat      (round each to 2 dp)
```
Label it "Estimate". The cart screen must display the server's `fees`, not the local estimate.

### 8.3 Order status pipeline
Forward-only: `PAID_CREDIT_APPROVED → PICKUP_SCHEDULED → PICKED_UP → AT_HUB → CUTTING → CUT_DONE → PACKED → OUT_FOR_DELIVERY → DELIVERED → COMPLETED`.
Hub may skip ahead but never go back. `CANCELLED` only from PAID…AT_HUB (stock is restocked).
`DELIVERED → DISPUTED`, `DISPUTED → REFUNDED | COMPLETED`, `CANCELLED → REFUNDED`.
Show a vertical timeline from `tracking_events`. Hub screens only offer valid next steps.
Buyers see a "Cancel order" button only while the order is still cancellable.

### 8.4 Payment
`B2B_CREDIT` is only offered when the buyer's company has a credit limit > 0; the server checks the
remaining limit. Other methods are recorded as authorised immediately (no payment gateway SDK yet —
leave a clearly marked `PaymentProvider` interface for bKash/Nagad/SSLCommerz later).

## 9. Screens

**Public / Buyer**
1. **Catalog** — search bar (debounced 300 ms), category chips, filter bottom sheet (fabric type, GSM light ≤200 / mid 201–300 / heavy ≥301, max price, colour), sort (newest, price ↑↓, most yards), 2-column grid of cards (photo, title, mill, GSM · width, ৳/yd, available yd, colour dot, "Exclusive" badge). Pull-to-refresh, skeleton loaders, empty state.
2. **Roll detail** — image carousel, specs table, mill card (tap → storefront), yard picker (8.1), live estimate (8.2), Add to cart, Buy now (`item_ids` = the new cart item id), call-mill button (`tel:`).
3. **Mill storefront** — header with stats, address, list of that mill's rolls (`factory_id`).
4. **Exclusive for you** (buyer tab) — `custom_only=true`, with `buyer_spec_notes`.
5. **Cart** — items with swipe-to-delete, edit yards (re-POST), server fees breakdown, payment method picker, delivery notes, Checkout. Badge on tab with item count.
6. **Orders** — list with status chips and filter; detail with timeline, items, fees, cancel button.

**Factory**
7. **Dashboard** — KPIs: yards listed, orders awaiting pickup, revenue (sum of *their* items' `subtotal`, excluding CANCELLED/REFUNDED), net payout (×0.94).
8. **My stock** — `mine=true`, segmented filter All / Public / Buyer-custom / Sold out.
9. **New listing** — multi-step form: (a) Public listing or Custom profile for a buyer (buyer picker from `/companies/buyers/`), (b) fabric type & specs, (c) colour (swatches + hex input), (d) yards, min cut, price, (e) photo URL / photo picker (upload endpoint is a "Backend change required"), (f) review & submit. Validate: positive numbers, `available ≤ total`, `minCut ≤ total`, hex `#RRGGBB`.

**Hub**
10. **Queue** — filter by status, card per order with the next valid action button(s) and optional notes. Confirm before advancing.
11. **Scan** — camera barcode/QR scanner; a scanned order number opens that order. Haptic feedback on scan.

**Admin**
12. **KYC queue** — tabs by status; approve sheet (credit limit, terms days) / reject sheet (reason).
13. **All orders** — list + detail (same components as buyer, plus status actions).

**Auth**
14. Login, Register (role choice FACTORY/BUYER, company name, BD phone validation), Pending approval (KYC form, status banner, rejection reason, pull-to-refresh `/auth/me/`).

**Routing guard:** after auth, route by role; FACTORY/BUYER with company not APPROVED → Pending approval
(catalog browsing still allowed for buyers). A `403 company_not_verified` anywhere → Pending approval.

## 10. Quality bar

- TypeScript strict, no `any` in app code. All API calls go through typed functions in `src/api/endpoints`.
- Every screen handles **loading (skeleton), empty, error (with Retry) and offline** states.
- React Query: sensible `staleTime` (catalog 2 min, cart 0), invalidate cart + orders after checkout, optimistic cart delete.
- Accessibility: labels on all touchables, min 44 pt targets, supports Dynamic Type / font scaling, colour is never the only signal.
- Full bn/en translation coverage; numbers/currency via `Intl.NumberFormat("bn-BD" | "en-BD", { style: "currency", currency: "BDT" })`.
- Dark mode support via the theme tokens.
- No secrets in the bundle; config via `EXPO_PUBLIC_*` and `app.config.ts`.
- Unit tests for `breakdown.ts`, `pricing.ts`, `orderStatus.ts`, the refresh interceptor (concurrent 401s → exactly one refresh call), and form schemas.
- EAS profiles: `development`, `preview`, `production`.

## 11. Delivery phases (stop and summarise after each)

1. **Foundation** — Expo app, routing skeleton per role, theme, i18n, API client + single-flight refresh, secure session restore, login/register/logout, role routing. *(List the backend change from section 5.)*
2. **Catalog** — categories, roll list with filters, roll detail, mill storefronts.
3. **Buyer commerce** — yard picker, cart, checkout (incl. Buy now), orders list/detail/timeline, cancel.
4. **Factory** — dashboard, my stock, multi-step new listing / custom profile.
5. **Hub & Admin** — queue with status actions, barcode scanner, KYC queue.
6. **Polish** — offline handling, push-notification scaffold (expo-notifications, no server yet), accessibility pass, tests, EAS build config, README with run instructions.

At the end, give me: the file tree, how to run it against a local backend on emulator and device,
and a final "Backend changes required" list.
