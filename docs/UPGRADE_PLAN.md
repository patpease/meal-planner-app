# Pease Meals (Meal Planner v2) — upgrade plan (draft for review)

Status: **ready for review.** All questions are answered (see §9).

## 1. Where we are today

| | Today (v1) | v2 |
|---|---|---|
| Hosting | GitHub Pages (`/meal-planner-app/`) | Cloudflare Pages + Functions, like Caroline's Library |
| Storage | Dexie / IndexedDB **on each phone** — nothing shared | Cloudflare **D1** (one shared database) |
| Photos | Blobs in IndexedDB | Resized JPEGs on the server (see §4) |
| Login | None | Device pairing (same as the library) |
| Sync | None | Live updates between both phones (§6) |
| Backups | None | Nightly to a private `pease-meals-data` repo |
| UI | React 19 + Tailwind, sage theme | **Preact + Vite + plain CSS tokens**, same stack as the library |

The UI is rebuilt in Preact to match the library's code. Framework-free
logic from v1 is ported, not rewritten: JSON-LD recipe parsing, text import,
planner + shopping-list logic, duration parsing, wake lock, step timers,
pantry icons.

## 2. Backend architecture

Copy the library's shape so both apps are maintained the same way:

```
functions/api/[[route]].ts   every /api route (hand-rolled router, like the library)
functions/photos/[key].ts    serves recipe photos (random-UUID URLs, cacheable)
server/auth.ts               device pairing — copied from the library
server/photos.ts             store/resize/serve photos
server/importUrl.ts          fetch a recipe page server-side (no CORS problems)
shared/                      types + validation used by both sides
migrations/0001_init.sql     D1 schema
src/                         the front end
```

- **API:** JSON over `fetch`, `Authorization: Bearer <device token>` on every
  call. Writes whitelist columns (like `BOOK_FIELDS`).
- **URL import moves server-side.** Today the phone fetches recipe sites
  directly, which many sites block (CORS). A Function fetches the page and
  returns the parsed recipe + image.
- **Strict CSP** copied from the library (`public/_headers`), noindex,
  `robots.txt`.

### Draft schema (D1)

```sql
recipes        id, name, meal_type, description, prep_minutes, cook_minutes,
               servings, source_url, notes, created_at, updated_at
recipe_ingredients  id, recipe_id, position, name, qty, unit, note, store
recipe_steps   id, recipe_id, position, text, timer_seconds
recipe_photos  id, recipe_id, key, position          -- first = cover
tags / recipe_tags                                   -- like shelves / book_shelves
meals_eaten    id, recipe_id, eaten_on, meal_type, eater_id, reaction, note, device_id
               -- "times we've had it" / "last had" are COMPUTED from this
plans          id, week_start, notes
plan_meals     id, plan_id, day, meal_type, recipe_id, servings, done
shopping_items id, plan_id, name, qty, unit, store, checked, restock
pantry_items   id, name, category, location, level, qty, unit, icon, updated_at
prepped_items  id, kind (homemade/store_bought), recipe_id NULL, name, portions,
               location (freezer/fridge), made_on, use_by, store, photo_key, notes
eaters         id, name, emoji, active             -- seeded Laura, Patrick, Caroline (inactive)
devices / pair_codes                                 -- copied from the library
changes        id, table, row_id, at                 -- powers live sync (§6)
```

Rules carried over from the library: schema changes are new migration files;
counts are computed, never stored; restore only runs on an empty database.

## 3. GitHub setup

| Repo | Purpose |
|---|---|
| `patpease/pease-meals` (**created** ✅) | Pease Meals app + API. Built fresh here (Preact rebuild), with v1 logic ported in. This plan and `design/pease-meals-icons/` move here in Phase 1. |
| `patpease/pease-meals-data` (**created** ✅) | Nightly backup: `meals.json` + `photos/`. Same Action as `carolines-library-data`. |
| `patpease/meal-planner-app` (existing) | v1 stays live on GitHub Pages until cut-over. Gets one last change: the "send my data to Pease Meals" button. Archived after cut-over. |

Both new repos exist, are empty, and Claude has read and push access (checked 2026-11-01).

- **Deploy:** `npm run deploy` (wrangler), same as the library, from `pease-meals`.
  v1's GitHub Pages workflow is turned off at cut-over.
- **Secrets** (never in chat or commits): `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID` where deploys run; `SETUP_CODE` and `BACKUP_TOKEN` as
  Pages secrets; `BACKUP_TOKEN` again in the data repo's Actions secrets.
  The existing library API token can be reused if it's scoped to the account.
- **CI:** a check workflow on PRs (`npm test && npm run build`).

## 4. Storage

- **Data:** D1, one database `pease-meals`.
- **Photos:** resized on the phone before upload (long edge ~1600 px, JPEG
  ~80%, typically 150–300 KB) plus a small thumbnail for the grid.
  - **Decided: R2** bucket `pease-meals-photos` (10 GB free). Served from
    our own origin via `functions/photos/[key].ts`, so the CSP stays
    `img-src 'self'`. The nightly backup copies new photos into the data repo.
  - URL imports download the recipe's image into R2 (no third-party image hosts).
- **Migrating v1 data (decided: yes):** a one-time "Send my v1 data to the new app" button
  in v1 Settings that uploads recipes, photos, pantry and plans from that
  phone's IndexedDB. Restore-style: only into an empty server, run once.

## 5. Login

Exactly the library's model, copied from `server/auth.ts`:

1. First phone pairs with a long `SETUP_CODE` (works only while no phone is paired).
2. Second phone: **Settings → Show a pairing code** on the first phone →
   6-digit code, single use, 10 minutes, brute-force guarded.
3. Each phone holds a random token in `localStorage` (via `storage.ts`); the
   server stores only its SHA-256. Lost phone → **Settings → Connected phones → Disconnect**.

No passwords, no Cloudflare Access (its redirect breaks out of the home-screen app).

## 6. Live updates between the two phones

**Decided: polling.** No extra Worker.

- While the app is open, every ~15 s it calls `GET /api/changes?since=<n>`
  (a tiny query on the `changes` table). If anything changed, it refetches
  only the affected lists.
- It also checks immediately when the app comes back to the foreground
  (as the library does) and right after your own writes.
- Polling pauses while the app is hidden, so it costs nothing in the background.
- Upgrade path if 15 s ever feels slow: a Durable Object + WebSocket can be
  added later without changing the data model.
- **Conflicts:** last write wins per field, scoped to the row. Shopping-list
  ticks and pantry +/- are single-field updates, so two people editing
  at once doesn't clobber other fields.
- **Offline:** read-only offline (last-loaded recipes + plan cached so
  cooking mode works with a bad signal). Edits need a connection.

## 7. Front end

Library-style look: photo-first, big tap targets, bottom tab bar, sheets for
details, light + dark tokens, short celebratory motion (none under Reduce Motion).

**Tabs:** Plan · Recipes · Pantry · Prepped · Settings

| Screen | What it does |
|---|---|
| **Recipes** | Photo grid (☰ list toggle). Badge: times we've had it. Filter by meal type/tag, sort by most/least/longest-ago had, search. |
| **Recipe detail** | Photo carousel, ingredients (with "in pantry ✓" hints), steps, notes, history of when we had it. Buttons: **We had it! ✨** (date, who, reaction), **Cook** (cooking mode), **Add to plan**, **Made extra → freezer**. |
| **Add recipe** | From a URL (server import), from 1–5 photos (Claude reads them into fields; **Try again with Opus** if it's wrong), by pasting text (iPhone Live Text), or by hand. Always ends on a review form. |
| **Plan** | This week by day; tap a slot to pick a recipe; mark done (logs a "had it"). Shared shopping list grouped by store, live-ticked. |
| **Pantry** | **Scan a barcode** to add (Open Food Facts lookup). Ingredients by location (pantry / fridge / freezer / spices), level or quantity, low/out list feeds the shopping list. |
| **Prepped** | Frozen + prepped meals, **homemade or store-bought** (e.g. TJ's dumplings): portions left, date made/bought, use-by with "eat soon" warning; −1 portion when eaten (logs "had it"). Homemade items link back to their recipe; store-bought ones note the store. |
| **Settings** | Connected phones, pairing code, download backup, eaters (switch Caroline on), defaults (servings, stores, weekly plan generation). |

### Name, icon and look

**Name: Pease Meals.** Icon: "Peas in a Pod" — three smiling peas, two big and
one small, for the three of us. Source assets and the designer's handover are
in `design/pease-meals-icons/` (`HANDOVER.md`).

**Installing the icon (Phase 1):**

- Copy `design/pease-meals-icons/web/*` into `public/`, so it's served from `/`:
  `favicon.ico`, `favicon.svg`, `favicon-16/32/48.png`, `apple-touch-icon.png`
  (180 px, opaque — this is the one iPhones use on the home screen),
  `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
- `index.html` head: the handover's `<link rel="icon">` ×2,
  `apple-touch-icon`, `manifest` and `theme-color` tags. Also
  `apple-mobile-web-app-title` = "Pease Meals" so the home-screen label fits.
- `public/manifest.webmanifest`: `name` "Pease Meals", `short_name`
  "Pease Meals", `display: standalone`, the three `icons` entries,
  `theme_color #6F8C6A`, `background_color #FBF7F2`.
- **Skipped from the handover:** the Xcode/`AppIcon.appiconset` steps and the
  `ios/` PNGs. Pease Meals is a home-screen web app, not a native iOS app, so
  there's no Xcode project. The files stay in `design/` in case that ever changes.
- Check: the favicon shows in a browser tab, and the icon looks right after
  **Add to Home Screen** on an iPhone (it gets a fresh icon only on re-adding).

**Colour tokens** (`src/styles.css` `:root`, from the icon palette):

| Token | Light | Use |
|---|---|---|
| `--bg` | cream `#FBF7F2` | App background |
| `--ink` | `#2F3B2D` | Text |
| `--accent` | sage `#6F8C6A` | Buttons, active tab, theme colour |
| `--accent-strong` | sage-dark `#5E7A5A` | Pressed states, links |
| `--surface-soft` | sage-light `#DCE6D5` | Cards, chips |
| `--pea` | `#9BBE8A` | Badges, "in pantry ✓", progress |
| `--leaf` | `#8FA98A` | Secondary icons |
| `--blush` | `#F4DCD4` | Highlight panels, "We had it!" celebration |
| `--blush-deep` | `#E8A898` | "Eat soon" / low-stock warnings, accents |

Dark mode: one `prefers-color-scheme: dark` block with deep sage/charcoal
backgrounds, light sage text and the same pea/blush accents, checked at
390 px in both modes.

**Typeface: Nunito**, self-hosted with `@fontsource/nunito` like the library
(the strict CSP allows fonts from our own origin only).

## 8. Build phases

1. **Foundation** — Preact app with the Pease Meals name, icon, palette and Nunito, Cloudflare Pages + D1 + R2 + pairing + empty shell; deploy to
   the new domain. You pair both phones.
2. **Recipes** — schema, CRUD, photos, grid + detail, "We had it", **URL import** (server-side) and **photo import** (Claude Sonnet 5.5, a "try again with Opus" button, and a Live Text paste fallback). Starts with the guided Anthropic API setup.
3. **Live sync** — `changes` table + 15 s polling + foreground refresh.
4. **Plan + shopping list** — port v1 planner logic to the server data.
5. **Pantry + Prepped** — including "made extra → freezer", portions, and **barcode scanning** (zxing-wasm + Open Food Facts).
6. **Migration + backups** — v1 "send to new app" button (ships to v1 on GitHub Pages), `/api/export`, data repo Action, restore script.
7. **Polish + cut-over** — dark mode pass at 390 px, final icon check on both phones, retire GitHub Pages.

Each phase is a PR you can review on its own.

## 8a. Automated data entry

Researched in [`AUTOMATION_RESEARCH.md`](AUTOMATION_RESEARCH.md). v1 includes
barcode → pantry/prepped, recipe from URL, and recipe from photos. Scan-to-use,
receipt and expiry reading, social-video links and batch card import are backlog.

## 9. Decisions

| Topic | Decision |
|---|---|
| Repos | New private `pease-meals` (app) + `pease-meals-data` (backups); `meal-planner-app` keeps v1 until cut-over |
| Photo import AI | Anthropic API, **Claude Sonnet 5.5**; user-triggered **"Try again with Opus"** (Claude Opus 5.5) on failure or a poor result; monthly cap |
| Name & icon | **Pease Meals**, "Peas in a Pod" icon, sage/blush/cream palette, Nunito |
| Front end | Rebuild in **Preact** (port v1 logic) |
| Live sync | **~15 s polling** + refresh on reopen |
| v1 data | **Migrate** it (one-time button in v1) |
| Photos | **R2** |
| Address | `meals.peasestudio.com` |
| Offline | **Read-only** offline (recipes, plan, cooking mode); edits need a connection |
| "We had it" | Date + who + reaction (😍 😊 😐 🙅) |
| Pregnancy-safe filter | **Removed** (v1's `pregnancySafe` field is dropped during migration) |
| Stores | **Keep** Trader Joe's (primary) / Whole Foods (secondary) suggestions on ingredients and the shopping list |
| Weekly plan | **Keep** auto-generation (port v1 `planner.ts`, minus the pregnancy-safe rules) |
| Prepped meals | Both **homemade** (optional recipe link) and **store-bought** |
| Pantry amounts | Level (full/half/low/empty) **or** exact quantity, per item |
| Eaters | **Laura, Patrick, Caroline** (first names). Patrick and Laura are active. Caroline won't eat solid food for ~6 months (until about May 2027), so she's seeded as *inactive*: hidden from "who ate" pickers and from serving counts in plan generation until switched on in **Settings → Eaters**. |

## 10. Still to do before building

- ✅ Repos `pease-meals` and `pease-meals-data` created; access verified (read + push) on 2026-11-01.
- Confirm the Cloudflare API token can be reused (or create one scoped to Pages, D1, R2 Edit + DNS for `peasestudio.com`).

### Anthropic API setup (guided at the start of Phase 2)

1. Go to **console.anthropic.com** and sign up. Use a Pease Meals or family
   workspace; this is separate from a Claude.ai subscription.
2. **Billing:** add a card and buy a small prepaid credit (e.g. $10). Turn
   auto-reload off to start.
3. **Limits:** set a monthly spend limit (e.g. $5) for the workspace.
4. **API Keys → Create Key**, named `pease-meals`. Copy it once.
5. Store it as a Pages secret yourself:
   `npx wrangler pages secret put ANTHROPIC_API_KEY --project-name pease-meals`
   (paste when prompted). **Never paste the key into chat or a commit.**
6. Tell me it's done, and I'll run a test import.
