# Pease Meals — App Icon Handover

**For:** Claude Code
**Icon:** "Peas in a Pod" (concept #1, approved)
**Concept:** Three smiling peas in an open pod: two larger peas and one small one, for the Pease family (Laura, Patrick, Caroline). The name is a play on "peas."

## Task for Claude Code

Install these icon assets into the Pease Meals codebase:

1. **iOS app.** Replace the contents of `Assets.xcassets/AppIcon.appiconset/` with `ios/AppIcon-1024.png` and `ios/Contents.json`.
   - This uses the single-size 1024 setup (Xcode 14+). Xcode generates the other sizes itself.
   - The other `ios/AppIcon-*.png` files are only for legacy or manual use.
2. **Web app.** Copy everything in `web/` to the public or static root, so the files are served from `/`.
3. **HTML head.** Add the tags in the snippet below.
4. **Manifest.** Add or merge the manifest `icons` entries below.
5. **Theme colors.** Set the theme and background colors to match the palette.
6. **Check.**
   - Run `xcodebuild` (or open Xcode) and confirm there are no asset catalog warnings.
   - Load the site and confirm the favicon shows in the browser tab.

## Files

| Path | Use |
|---|---|
| `svg/app-icon.svg` | Master artwork. Square, full-bleed (no rounded corners), source for all exports. |
| `svg/app-icon-rounded.svg` | Rounded-corner version for marketing and web display. |
| `svg/favicon.svg` | Simplified version without faces or stem, so it stays legible at 16–48 px. |
| `ios/AppIcon-1024.png` | App Store / Xcode icon. Opaque, no alpha, square (iOS applies its own mask). |
| `ios/AppIcon-{20…180}.png` | Legacy fixed sizes, all opaque. |
| `ios/Contents.json` | Asset catalog manifest for the single-size icon. |
| `web/favicon.ico` | Multi-size favicon: 16, 32, 48. |
| `web/favicon.svg` | Vector favicon for modern browsers. |
| `web/favicon-{16,32,48}.png` | PNG favicons. |
| `web/apple-touch-icon.png` | 180×180 icon for iOS "Add to Home Screen". |
| `web/icon-192.png`, `web/icon-512.png` | PWA icons with rounded corners. |
| `web/icon-maskable-512.png` | PWA maskable icon. Full-bleed; the artwork sits inside the safe zone. |

## HTML head snippet

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#6F8C6A">
```

## Manifest icons

```json
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
],
"theme_color": "#6F8C6A",
"background_color": "#FBF7F2"
```

## Palette

| Token | Hex | Role |
|---|---|---|
| blush | `#F4DCD4` | Icon background |
| blush-deep | `#E8A898` | Cheeks, accents |
| sage-dark | `#5E7A5A` | Stem |
| sage | `#6F8C6A` | Pod, theme color |
| sage-leaf | `#8FA98A` | Leaf |
| pea | `#9BBE8A` | Peas |
| sage-light | `#DCE6D5` | Pod interior |
| cream | `#FBF7F2` | App background |
| ink | `#2F3B2D` | Faces, text |

**Typeface used on the concept board:** Nunito (Google Fonts). It's a good fit for app UI.

## Regenerating exports

If the SVG changes, re-export with `rsvg-convert` and flatten the iOS PNGs so they have no alpha channel:

```bash
rsvg-convert -w 1024 -h 1024 svg/app-icon.svg -o ios/AppIcon-1024.png
convert ios/AppIcon-1024.png -background "#F4DCD4" -alpha remove -alpha off ios/AppIcon-1024.png
for s in 16 32 48; do rsvg-convert -w $s -h $s svg/favicon.svg -o web/favicon-$s.png; done
convert web/favicon-16.png web/favicon-32.png web/favicon-48.png web/favicon.ico
```
