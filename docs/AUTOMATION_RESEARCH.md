# Pease Meals — automated data entry: research and recommendations

This covers three ways to add things without typing. For each one: existing
open-source projects we can build on, licences checked on npm/PyPI
(2026-11-01), and what goes in v1 versus the backlog.

## Summary

| Feature | v1 | Backlog |
|---|---|---|
| **Scan a barcode → pantry / prepped** | Scan → look up on Open Food Facts → confirm → add. Our own `products` table remembers every barcode, including the ones we name by hand. | Scan-to-use (−1 when it's used up), reading expiry dates, receipt scanning, nutrition info, sending missing products back to Open Food Facts |
| **Recipe from a URL** | Paste link → server fetches the page → schema.org recipe → editable form → save, with the photo copied into R2 | AI fallback for pages without recipe data, Instagram/TikTok/YouTube links, bulk import of old bookmarks |
| **Recipe from a photo** | 1–5 photos of a cookbook page or card → Claude vision (Sonnet 5.5, with a "try again with Opus" button) → ingredients and steps as fields → review → save. The original photos stay attached. Free fallback: iPhone Live Text → paste box → parser. | Batch import of a stack of family recipe cards, photo of pantry shelves → items, on-device OCR |

All three end the same way: a **pre-filled form you check before saving**,
built once and shared.

---

## 1. Barcode scanning (ingredients and store-bought meals)

**Build on:**

| Project | Licence | Use |
|---|---|---|
| [`zxing-wasm`](https://github.com/Sec-ant/zxing-wasm) 3.1.6 | MIT | Barcode reader in the browser. **Already used in Caroline's Library** (`src/components/Scanner.tsx`), so we copy a working iPhone scanner, CSP rules and all (`'wasm-unsafe-eval'`, `.wasm` served from our own domain). |
| [`barcode-detector`](https://github.com/Sec-ant/barcode-detector) 3.2.3 | MIT | The same engine behind the standard `BarcodeDetector` API. An alternative wrapper; the library's direct use of zxing-wasm is fine. |
| [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/) | Data under ODbL; images under CC BY-SA | Free product lookup by barcode, no key needed. It has **~6,800 Trader Joe's products** (checked today). Limit: 15 lookups/min, with a `User-Agent` of the form `PeaseMeals/1.0 (email)`. |

**v1 flow:**
1. **Pantry → Scan** (or **Prepped → Scan**). The camera reads UPC/EAN codes.
2. The server checks our own `products` table first, then Open Food Facts.
3. A form comes up pre-filled: name, brand, photo, a suggested category and
   location (frozen goods → freezer), and the pantry icon. You set the
   quantity and confirm.
4. Unknown barcode? Type the name once, and it's saved to `products`, so the
   next scan is instant. (Trader Joe's own-label items sometimes miss.)
5. Scanning something already in the pantry offers **+1** instead of a duplicate.

New table: `products (barcode PK, name, brand, category, image_key, source, updated_at)`.
Product photos are copied into R2, so the CSP stays `img-src 'self'`.
Settings shows a line crediting Open Food Facts (ODbL).

**Backlog:** scan-to-use (−1 portion or −1 level), reading "best by" dates
from a photo, adding a whole receipt at once, nutrition info, and
contributing missing products back to Open Food Facts (needs an account).

---

## 2. Recipe from a URL

v1 already has a working schema.org JSON-LD parser
(`meal-planner-app/src/lib/recipeUrlImport.ts`). It runs on the phone, so many
sites block it (CORS). v2 moves it to the server.

**Build on:**

| Project | Licence | Use |
|---|---|---|
| [`recipe-scrapers`](https://github.com/hhursev/recipe-scrapers) 15.13 (Python) | MIT | The reference project: hundreds of sites, with per-site fixes for odd markup. We **read it for the edge cases** (`@graph` nesting, `HowToSection`, ISO durations, image arrays), but don't run it, because Cloudflare Functions run JavaScript. |
| [`recipe-scrapers-ts`](https://www.npmjs.com/package/recipe-scrapers-ts) 1.0.6 | MIT | A TypeScript port: JSON-LD plus an HTML fallback, built on `linkedom`. A candidate to use directly if it runs cleanly in a Worker; otherwise we use it as a reference and keep our own parser. Last release Aug 2025, so check it before depending on it. |
| [`linkedom`](https://github.com/WebReflection/linkedom) 0.18 | ISC (MIT-equivalent) | Lightweight HTML parser that works in Workers. Used for the microdata fallback and for finding `og:image`. |
| [`parse-ingredient`](https://github.com/jakeboone02/parse-ingredient) 3.1.0 | MIT | Turns "1 ½ cups flour, sifted" into quantity 1.5, unit cup, name "flour", note "sifted". Handles ranges and section headers ("For the sauce:"). Actively maintained (released 2026-10-28). Also used for photo and paste imports. |

**v1 flow:** paste the link (iOS doesn't let home-screen web apps appear in
the Share sheet, so it's copy-link → **Paste** button) → the server fetches
the page → the recipe is parsed → the hero photo goes into R2 → the
ingredients are split with `parse-ingredient` → review form → save. The
source URL is kept on the recipe.

**Backlog:** for pages with no recipe data, send the page text through the
same AI step as photos (§3). Also social-video recipes (Instagram, TikTok,
YouTube descriptions) and bulk import from a list of bookmarks.

---

## 3. Recipe from a photo (cookbook page, recipe card, screenshot)

**Options compared:**

| Option | Licence / cost | Quality on cookbook pages | Verdict |
|---|---|---|---|
| **Claude vision (Anthropic API)** from a Pages Function, with structured outputs (a JSON schema for title, servings, times, ingredients[], steps[]) | Pay per use. A photo is ~1.6k tokens in and ~1k out: **~1–1.5¢ on Sonnet 5.5** ($2 / $10 per million tokens), ~3¢ on Opus 5.5 ($4 / $20) | Best. Handles two-column layouts, fractions, handwriting and multi-page recipes, and returns ready-made fields | **Recommended for v1** |
| Cloudflare Workers AI, `llama-3.2-11b-vision-instruct` | Cheap, runs inside Cloudflare, no extra account | Fair on clean print, weaker on handwriting and layouts, and the JSON is less reliable | Alternative if you'd rather not have an Anthropic account |
| [`tesseract.js`](https://github.com/naptha/tesseract.js) 7.0 on the phone | Apache-2.0 (permissive, but not MIT). Free | Raw text only, poor on multi-column pages, about a 10 MB download. Fields still need parsing | Not recommended |
| **iPhone Live Text** (press on the text in the photo → Copy) → paste box → `parse-ingredient` plus a step splitter | Free, built into iOS, no code to read the image | Good text, but you choose what to copy | **Include in v1 as the free fallback**. v1's `importParser.ts` already does most of this |

**v1 flow:** **Add recipe → From photos** → take or choose 1–5 photos → the
phone shrinks them (as for all uploads) → they're stored in R2 → the server
sends them to Claude Sonnet 5.5 with the recipe schema → the review form fills in
(with **Try again with Opus** if it's wrong or failed) → save. The photos stay attached to the recipe.

Cost guard: one call per import, and a monthly cap set in Settings. If the
API is down or the cap is reached, the app falls back to the paste box.

**Backlog:** batch-import a stack of family recipe cards in one go; a photo of
the pantry or freezer → a list of items (the old meal-planner skill did this);
"what can we make from the pantry?" suggestions.

---

## What this adds to the plan

- **New Pages secret:** `ANTHROPIC_API_KEY`, on its own billing (separate from a
  Claude.ai subscription), with a spend limit set in the Anthropic Console.
- **New tables:** `products`, plus `recipes.source_kind` (manual / url / photo / paste).
- **Phases:** URL and photo import go into **Phase 2 (Recipes)**. Barcode
  scanning goes into **Phase 5 (Pantry + Prepped)**.
- **Dependencies:** `zxing-wasm`, `parse-ingredient`, `linkedom`,
  `@anthropic-ai/sdk`, and possibly `recipe-scrapers-ts`.

## Decisions

- **Photo import uses the Anthropic API** (Pease Meals' own API key and billing).
- **Model: Claude Sonnet 5.5** (`claude-sonnet-5-5`, $2 / $10 per million
  tokens), about **1–1.5¢ a photo**.
- **"Try again with Opus"**: the review form always has this button, and it's
  shown prominently when the Sonnet attempt fails. "Fails" means an API
  error, a refusal, JSON that doesn't match the schema, a result with no
  ingredients or no steps, or simply that you don't like the result. It
  re-runs the same stored photos on **Claude Opus 5.5** (`claude-opus-5-5`,
  about 3¢). It's never automatic, so Opus is only used when you choose it.
- The model IDs are server config, not code, so they can be changed without
  touching the app. The monthly cap counts both models. The server records
  which model produced each import (`recipes.import_model`), to see how often
  Opus is needed.
- Account setup is guided when we reach Phase 2 (steps in UPGRADE_PLAN §10).

## Sources

- zxing-wasm: https://github.com/Sec-ant/zxing-wasm · barcode-detector: https://github.com/Sec-ant/barcode-detector
- Open Food Facts API docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
- recipe-scrapers (Python): https://github.com/hhursev/recipe-scrapers · https://pypi.org/project/recipe-scrapers/
- recipe-scrapers-ts: https://www.pkgstats.com/pkg:recipe-scrapers-ts
- Other JS scrapers reviewed (older or less maintained): https://github.com/arcetros/scrape-recipe-schema, https://www.pkgstats.com/pkg:@dimfu/recipe-scraper, https://npmjs.com/package/html-recipe-parser
- parse-ingredient: https://github.com/jakeboone02/parse-ingredient · https://npmjs.com/package/parse-ingredient
- parse-ingredients (alternative): https://npmjs.com/package/parse-ingredients
- linkedom: https://github.com/WebReflection/linkedom
- tesseract.js: https://github.com/naptha/tesseract.js · https://socket.dev/npm/package/tesseract.js/overview/5.1.1
- Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
