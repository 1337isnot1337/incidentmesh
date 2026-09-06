# Presentation assets

The wordmark pairs three incoming signals with an action boundary. Use the light or dark wordmark to match the surrounding page. The hero uses a separate narrow composition below 600 px; its command rewrite is an illustration of the canonical fixture, not a screenshot or a live production action.

Palette: ink `#101820`, evidence `#72d5c2`, blocked `#ffb18a`, safe rewrite `#8ee3c7`. SVGs use system fonts and contain no external resources.

The Astra development credit uses its own black, silver-white, and icy-blue treatment, drawn from [OpenAI's Astra model artwork](https://developers.openai.com/images/api/models/icons/gpt-6-astra.png). Its six-armed stellar spiral is a custom emblem, not an official logo. It is intentionally kept out of the README header so it cannot collide with the product wordmark on narrow GitHub layouts.

## Authenticated Gemini proof

`gemini-proof.svg` summarizes the historical authenticated provider receipt without replacing it. The plot reserves a fixed gutter for exact timing labels, highlights the **1,389 ms** common three-way provider-call overlap, and shows the recorded Phase-2 path from `rollback_production` through `SafetyGateInterception` to `request_corroboration` and provider follow-up. `gemini-proof-narrow.svg` carries the same facts in a stacked 440 × 560 composition so the evidence remains legible instead of being scaled down on narrow GitHub layouts.

The arrows in this asset are vector paths rather than font glyphs so the rendering does not depend on a particular symbol font. The footer preserves the historical receipt provenance and explicitly avoids presenting it as final-SHA provider evidence.

## Social preview

`social-preview.png` is the upload-ready 1280 × 640 asset. `social-preview.svg` is its editable source. Upload the PNG in the repository's **Settings → General → Social preview**. Committing this file does not set GitHub's social preview.

To export with a locally installed Playwright browser:

```bash
npx playwright screenshot --viewport-size="1280,640" docs/assets/social-preview.svg docs/assets/social-preview.png
```

## Evidence rendering

The replay's spans, event times, configured boundary, and observed callback come from its companion JSON. To restyle an existing capture without replacing its evidence:

```bash
npm run replay:visual -- docs/evidence/replay.svg /tmp/incidentmesh-replay-copy.json docs/evidence/replay.json
```

Without the third path, the command runs a new canonical scenario. Default output paths remain `docs/evidence/replay.svg` and `docs/evidence/replay.json`.

## Visual review

All committed presentation SVGs were rasterized and visually inspected together after the README clarity pass: product mark, light/dark wordmarks, hero and narrow hero, wide and narrow Gemini proof, social preview, replay, Astra credit, and all four gallery source SVGs. The audit checked for clipping, collisions, unsupported glyphs, poor edge spacing, and misleading visual provenance.

The audit found and fixed three concrete rendering problems:

- the original Gemini proof allowed the longest inference bar to collide with the exact timing-label column;
- Unicode minus/arrow glyphs rendered as missing-character boxes in some SVG renderers;
- the floated Astra credit could compete with the wordmark on narrow README layouts.

For small technical SVGs, prefer ASCII punctuation or drawn vector arrows instead of relying on optional Unicode symbol glyphs. Keep exact-value labels outside plotted regions rather than placing text over data marks.

The presentation pass also compared the rendered READMEs of [uv](https://github.com/astral-sh/uv), [Zed](https://github.com/zed-industries/zed), [Supabase](https://github.com/supabase/supabase), [Bun](https://github.com/oven-sh/bun), [Sentry](https://github.com/getsentry/sentry), and [Temporal](https://github.com/temporalio/temporal). The applicable patterns were clear product identity, short positioning, an early runnable example, and detail introduced after the initial product explanation.
