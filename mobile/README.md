# FabriLink Mobile

iOS + Android app for FabriLink, built with **Expo SDK 58**, **expo-router**, **TypeScript (strict)**,
TanStack Query, Zustand, react-hook-form + zod and i18next (Bangla / English). It talks to the Django
backend in `../backend`.

## Run it

You need the backend running first (see the root `README.md`), then:

```powershell
cd mobile
npm install          # first time only
npm start            # Expo dev server; press a = Android, i = iOS, w = web
```

| Where the app runs | API address it uses | Backend `.env` needs |
|---|---|---|
| Android emulator | `http://10.0.2.2:8000/api/v1` (automatic) | `10.0.2.2` in `ALLOWED_HOSTS` |
| iOS simulator / web | `http://localhost:8000/api/v1` (automatic) | — |
| Physical phone (Expo Go) | set `EXPO_PUBLIC_API_BASE_URL=http://<your-PC-LAN-IP>:8000/api/v1` in `mobile/.env` | your LAN IP in `ALLOWED_HOSTS`, and start Django with `runserver 0.0.0.0:8000` |

Restart `npm start` after changing `mobile/.env`.

Demo accounts are the same as the web app (e.g. buyer `buyer@dhakatrendz.com` / `Buyer12345!`).

## Checks

```powershell
npm run typecheck    # tsc --noEmit
npm test             # jest (business rules, schemas, refresh logic, translations)
npm run check        # all of the above + Expo dependency compatibility
```

## Structure

```
app/                     expo-router routes
  _layout.tsx            providers, splash screen, session restore
  index.tsx              redirects to the user's home by role
  (auth)/                login, register, pending-approval (KYC)
  buyer/                 tabs: catalog, exclusive, cart, orders, profile (catalog open to guests)
  factory/               tabs: dashboard, stock, new-listing, orders, profile
  hub/                   tabs: queue, scan, profile
  admin/                 tabs: KYC queue, all orders, profile
  roll/[id].tsx          fabric detail + yard ruler + add to cart / buy now
  mill/[id].tsx          mill storefront
  order/[id].tsx         order detail, timeline, status actions
  requests/              sourcing requests: buyers post, mills see the open board, admins see all
  credit.tsx             buyer's B2B credit line (limit, owed, available)
src/
  api/                   axios client (single-flight token refresh), typed endpoints, types
  components/            UI kit (ui/), roll/order components, sheets
  hooks/queries.ts       React Query hooks + cache invalidation
  lib/                   business rules mirrored from the backend: breakdown, pricing,
                         orderStatus, schemas, routing, formatting
  i18n/                  bn.json (default) and en.json
  store/auth.ts          session state (tokens live in expo-secure-store)
```

## How auth works

Every request sends `X-Client-Platform: mobile`, so the backend returns `refresh_token` in the response
body (web clients keep using the httpOnly cookie). Tokens are stored in `expo-secure-store`. On a 401
the client runs **one** shared refresh for all in-flight requests, because the backend rotates and
blacklists refresh tokens: two parallel refreshes would log the user out.

## Design

Built with the `frontend-design` skill's process (plan → check against generic defaults → build).

- **Palette from the mill floor:** greige `#EEF0EA` (unbleached cloth) ground, loom-ink `#17262B`
  text, dye-house teal `#0B6E69` for actions, jute gold `#B8860B` only for exclusive profiles,
  madder `#A63A2B` only for errors. Full dark theme in `src/theme.ts`.
- **One typeface:** Hind Siliguri, drawn for Bangla with a matching Latin, so both languages share
  one voice. Taller line heights for Bangla; tabular figures for prices and yardage.
- **The memorable element:** the tape-measure yard ruler (`src/components/YardRuler.tsx`) — the
  roll drawn as a tape, the cut shaded, and the lengths the breakdown rule forbids tinted madder.
  Tap to jump; +/− for precision; screen readers get an adjustable control.
- Each roll card carries a swatch strip in the fabric's real `color_hex`.
- Respects Reduce Motion; every icon button is labelled; destructive actions confirm.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Buyer | `buyer@dhakatrendz.com` | `Buyer12345!` |
| Factory | `sales@squarefashions.com` | `Factory12345!` |
| Hub staff | `hub@fabrilink.com.bd` | `Hub12345!` |
| Admin | `admin@fabrilink.com.bd` | `Admin12345!` |

## Troubleshooting

- **"You're signed in to Expo Go as …"** — sign out in Expo Go (Settings), or run `expo-login.cmd`.
- **`Unable to resolve "./cjs/…"` while bundling** — stop Expo, delete `%TEMP%\metro-cache`, start
  again. Don't run two Expo servers for this folder at once; they corrupt each other's cache.
- **`npx` not recognized** — use `start-mobile.cmd`, or reopen the terminal (Node.js is installed).

## Deviations from `MOBILE_APP_MASTER_PROMPT.md`

- **Styling:** typed theme tokens + `StyleSheet` (`src/theme.ts`) instead of NativeWind, to avoid
  Babel/Metro compatibility risk on a brand-new SDK. Light and dark themes follow the system setting.
- **Bottom sheets:** React Native `Modal` (`src/components/ui/Sheet.tsx`) instead of
  `@gorhom/bottom-sheet`; cart rows use a delete button instead of swipe-to-delete.
- **Not built yet:** photo upload (needs a backend upload endpoint — listings take an image URL),
  push notifications, real bKash/Nagad/SSLCommerz SDKs (the backend marks orders as paid on checkout).

## Builds

`eas.json` defines `development`, `preview` (Android APK) and `production` profiles:

```powershell
npm install -g eas-cli
eas login
eas build --profile preview --platform android
```
