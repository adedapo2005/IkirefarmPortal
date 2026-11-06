# DAENEM Farms official sign-in logo pack

## What this is

This package contains the exact official DAENEM Farms full-logo PNG recovered from the canonical Farms sign-in source. It is the full brand lockup used on the sign-in experience, not a redraw.

**Important:** the tagline **“Modern Agriculture. Naturally Better.”** is already baked into the PNG. Do not add a second external tagline underneath it unless the owner explicitly asks for a new composition.

## Authoritative asset

- File: `daenem-farms-official-logo.png`
- Format: PNG / RGBA transparency
- Dimensions: 1320 x 800
- SHA-256: `2c34f4adb338adf6825771e7af8d3f256944429ac08ff99d3644c939b224c213`

The same hash appears for both the canonical sign-in copy and the approved asset copy in the Farms source lineage.

## Context reference

`signin-page-reference.png` is a historical sign-in screenshot included only to show placement and context. Do not crop the logo out of the screenshot and use that as the logo asset. Use the transparent PNG above.

## Live DOM structure

The canonical Webflow-transfer structure was conceptually:

```html
<div class="df-brand" aria-label="Daenem Farms official logo">
  <div class="df-mark">
    <img class="dfx-owner-logo-live" src=".../daenem-logo.png" alt="Daenem Farms">
  </div>
</div>
```

## Historical live behavior

The project went through several controlled refinements. This pack preserves all three useful historical treatments so another chat can reproduce the correct family without inventing behavior.

### A. Premium live sign-in treatment — recommended when asked for the animated original look

Recovered source values:

```css
filter:
  brightness(1.06)
  saturate(1.06)
  drop-shadow(0 14px 26px rgba(2,35,27,.28))
  drop-shadow(0 0 18px rgba(230,202,112,.36));

animation:
  logo-reveal .8s cubic-bezier(.2,.78,.2,1) both,
  logo-halo 7s 1s ease-in-out 2;
```

Reveal:
- starts at opacity 0
- `translateY(-9px) scale(.975)`
- settles to normal over 0.8 s

Halo:
- restrained warm-green/gold aura
- dark depth shadow stays constant
- halo grows from 14 px / 0.25 alpha to 22 px / 0.42 alpha at midpoint
- 7 s cycle, delayed 1 s, two iterations

This is implemented as `data-treatment="premium-live"` in `daenem-farms-logo-live.css`.

### B. Earlier original float treatment

Recovered source values:

```css
filter:
  drop-shadow(0 14px 24px rgba(1,24,18,.42))
  drop-shadow(0 0 15px rgba(255,228,157,.24));

animation: logo-float 7.4s cubic-bezier(.45,0,.55,1) infinite;
```

The motion is only 4 px vertically at the midpoint. It is intentionally subtle.

Use `data-treatment="original-float"`.

### C. Later stabilized Webflow treatment

The later accepted Webflow structure kept the same official asset but intentionally stopped continuous logo animation:

```css
filter:
  brightness(1.05)
  contrast(1.08)
  saturate(1.02)
  drop-shadow(0 8px 20px rgba(0,0,0,.28));
animation: none;
```

Use `data-treatment="stable-webflow"`.

## Responsive Webflow sizing

Recovered full-logo sizing:

- Main: `clamp(180px,13vw,280px)`
- Medium: `clamp(160px,22vw,230px)`
- Small: `clamp(145px,38vw,210px)`
- Tiny: `clamp(132px,44vw,188px)`
- Large: `clamp(210px,14vw,320px)`

The logo must remain transparent with `object-fit: contain`. Do not place it in a white square tile.

## Reduced Motion

Historical implementation disabled the branding animation when `prefers-reduced-motion: reduce` was active. Preserve that behavior.

## Instruction for the receiving chat

When recreating another DAENEM Farms sign-in page:

1. Use `daenem-farms-official-logo.png` exactly; do not redraw it.
2. Do not retype or duplicate the tagline because it is already part of the artwork.
3. Use the `premium-live` treatment if the owner asks for the animated historical sign-in presentation.
4. Keep the motion restrained; do not add perpetual spinning, aggressive zooming, neon effects, or large movement.
5. Respect Reduced Motion.
6. Keep the logo transparent and responsive.
7. Use the included screenshot only as contextual evidence for placement, not as an image source.

## Files

- `daenem-farms-official-logo.png` — authoritative transparent logo artwork
- `daenem-farms-logo-live.css` — recovered/reconstructed live treatments with exact source values
- `demo.html` — portable browser demo
- `signin-page-reference.png` — historical context screenshot
- `manifest.json` — provenance and integrity metadata
