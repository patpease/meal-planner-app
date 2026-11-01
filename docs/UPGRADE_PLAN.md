# Meal Planner v2 — upgrade plan (draft for review)

Status: **draft**. Open questions are marked **❓** with a recommended default;
anything you don't answer, we build with the default.

## 1. Where we are today

| | Today (v1) | v2 |
|---|---|---|
| Hosting | GitHub Pages (`/meal-planner-app/`) | Cloudflare Pages + Functions, like Caroline's Library |
| Storage | Dexie / IndexedDB **on each phone** — nothing shared | Cloudflare **D1** (one shared database) |
| Photos | Blobs in IndexedDB | Resized JPEGs on the server (see §4) |
| Login | None | Device pairing (same as the library) |
| Sync | None | Live updates between both phones (§6) |
| Backups | None | Nightly to a private `meal-planner-data` repo |
| UI | React 19 + Tailwind, sage theme | Library-style: photo grid, detail sheets, light + dark tokens |

What we keep from v1 (it works and is ~3k lines): recipe form, URL import
(JSON-LD parsing), text import, cooking mode (wake lock + step timers), the
weekly planner + shopping list logic, pantry icons.

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
               servings, source_url, notes, pregnancy_safe, created_at, updated_at
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
prepped_items  id, recipe_id NULL, name, portions, location (freezer/fridge),
               made_on, use_by, photo_key, notes
eaters         id, name, emoji                      -- seeded with the two of you
devices / pair_codes                                 -- copied from the library
changes        id, table, row_id, at                 -- powers live sync (§6)
```

Rules carried over from the library: schema changes are new migration files;
counts are computed, never stored; restore only runs on an empty database.

## 3. GitHub setup

| Repo | Purpose |
|---|---|
| `patpease/meal-planner-app` (this one) | App + API. v2 is built on a branch; `main` keeps v1 until cut-over. |
| `patpease/meal-planner-data` (**new, private** — you create it) | Nightly backup: `meals.json` + `photos/`. Same Action as `carolines-library-data`. |

- **Deploy:** `npm run deploy` (wrangler), same as the library. The existing
  GitHub Pages workflow is removed at cut-over.
- **Secrets** (never in chat or commits): `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID` where deploys run; `SETUP_CODE` and `BACKUP_TOKEN` as
  Pages secrets; `BACKUP_TOKEN` again in the data repo's Actions secrets.
  The existing library API token can be reused if it's scoped to the account.
- **CI:** a check workflow on PRs (`npm test && npm run build`).

## 4. Storage

- **Data:** D1, one database `meal-planner`.
- **Photos:** resized on the phone before upload (long edge ~1600 px, JPEG
  ~80%, typically 150–300 KB) plus a small thumbnail for the grid.
  - **Recommended: R2** (Cloudflare object storage, 10 GB free). Recipes get
    several photos and cooking photos are bigger than book covers; D1 has a
    2 MB row limit and a 5 GB/database cap on the paid tier (500 MB free).
  - Alternative: keep them in D1 like the library (one place, simpler
    backups) — fine up to a few hundred recipes.
  - ❓ **Q4** below.
- **Migrating v1 data:** a one-time "Send my v1 data to the new app" button
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

- **Recommended: Durable Object + WebSocket.** One small Durable Object
  ("the kitchen") holds both phones' sockets. Every write through the API
  pings it; it tells the other phone "recipes changed" and that phone refetches.
  Changes show up in about a second (e.g. one of you ticks off the shopping
  list in the store while the other watches). Durable Objects are on the
  free plan with SQLite storage. Note: a Durable Object needs a small Worker
  next to the Pages project.
- **Fallback (always on):** refetch when the app comes back to the foreground
  (what the library does) and every ~15 s while open, so nothing is lost if
  the socket drops (iOS kills it in the background).
- **Conflicts:** last write wins per field, scoped to the row. Shopping-list
  ticks and pantry +/- are single-field updates, so two people editing
  at once doesn't clobber other fields.
- **Offline:** read-only offline (last-loaded recipes + plan cached so
  cooking mode works with a bad signal). Edits need a connection. ❓ Q3.

## 7. Front end

Library-style look: photo-first, big tap targets, bottom tab bar, sheets for
details, light + dark tokens, short celebratory motion (none under Reduce Motion).

**Tabs:** Plan · Recipes · Pantry · Prepped · Settings

| Screen | What it does |
|---|---|
| **Recipes** | Photo grid (☰ list toggle). Badge: times we've had it. Filter by meal type/tag, sort by most/least/longest-ago had, search. |
| **Recipe detail** | Photo carousel, ingredients (with "in pantry ✓" hints), steps, notes, history of when we had it. Buttons: **We had it! ✨** (date, who, reaction), **Cook** (cooking mode), **Add to plan**, **Made extra → freezer**. |
| **Add recipe** | From a URL (server import), by hand, or photo of a cookbook page (just stores the photo for v2; ❓ OCR later). Take/choose photos. |
| **Plan** | This week by day; tap a slot to pick a recipe; mark done (logs a "had it"). Shared shopping list grouped by store, live-ticked. |
| **Pantry** | Ingredients by location (pantry / fridge / freezer / spices), level or quantity, low/out list feeds the shopping list. |
| **Prepped** | Frozen + prepped meals: portions left, date made, use-by with "eat soon" warning; −1 portion when eaten (logs "had it"); link back to the recipe. |
| **Settings** | Connected phones, pairing code, download backup, defaults (servings, stores, pregnancy-safe filter). |

Name and icons: placeholders until you supply them (`public/icon*.png`,
`manifest.webmanifest`, `apple-touch-icon.png`).

## 8. Build phases

1. **Foundation** — Cloudflare Pages + D1 + pairing + empty shell; deploy to
   the new domain. You pair both phones.
2. **Recipes** — schema, CRUD, photos, URL import, grid + detail, "We had it".
3. **Live sync** — Durable Object + foreground/poll fallback.
4. **Plan + shopping list** — port v1 planner logic to the server data.
5. **Pantry + Prepped** — including "made extra → freezer" and portions.
6. **Migration + backups** — v1 data import, `/api/export`, data repo Action, restore script.
7. **Polish + cut-over** — dark mode pass at 390 px, your icons/name, retire GitHub Pages.

Each phase is a PR you can review on its own.

## 9. Open questions

| # | Question | Recommended default |
|---|---|---|
| Q1 | Front-end framework: keep React + Tailwind (reuse v1 code) or move to Preact like the library? | Keep React + Tailwind, restyled with library-style tokens |
| Q2 | Address? | `meals.peasestudio.com` |
| Q3 | Offline: read-only, or full offline editing with sync? | Read-only offline |
| Q4 | Photos in R2 or D1? | R2 |
| Q5 | Is there real data in v1 on either phone to carry over? | Yes — build the one-time migration |
| Q6 | "We had it" — who and a reaction (like the library), or just the date? | Date + who + reaction (😍 😊 😐 🙅) |
| Q7 | Keep pregnancy-safe filter, TJ's / Whole Foods store split, and the auto-generated weekly plan? | Keep all three |
| Q8 | Frozen meals: always tied to a recipe, or also store-bought items (e.g. TJ's dumplings)? | Both; recipe link optional |
| Q9 | Pantry: level (full/half/low) or exact quantities? | Both, per item (as v1) |
| Q10 | Eaters: just the two of you, or also kids/guests for "who ate"? | The two of you; editable list |
