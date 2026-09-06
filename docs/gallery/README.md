# JigJoy gallery images

Upload the four PNGs in this order. Each is 1600 × 900 (16:9), under 5 MB.

1. **jigjoy-01-cover.png** — Concurrent evidence blocks a rollback proposal; Mozaik rewrites it to corroboration.
2. **jigjoy-02-ablation.png** — The same fail-closed policy produces different available safe plans when only scheduling changes.
3. **jigjoy-03-interception.png** — Canonical responder spans and the real Mozaik interception sequence.
4. **jigjoy-04-safety-proof.png** — A timed-out required responder leaves evidence incomplete and rollback blocked.

These are designed presentation images, not screenshots of a deployed dashboard. The first image is intended for JigJoy's center-cropped, object-cover gallery card and its social preview. All four have separate jobs; the evidence images are meant to be opened at detail-page size.

## Sources and regeneration

`render.mjs` is the editable source for layout, copy, palette, and SVG generation. The SVGs are also editable. PNGs use Arial/Helvetica/system fallback rendered by Chromium; no remote fonts or images are loaded.

From the repository root, with dependencies installed and Playwright/Chromium available:

```sh
node docs/gallery/render.mjs /absolute/path/to/playwright/index.mjs
```

Alternatively omit the argument when `playwright` is resolvable in the local environment. Playwright is a presentation tool, not a new project dependency. The committed images were rendered with Playwright 1.63.0 and Chromium 153.0.8010.12; system font rendering can differ across platforms.

The generator reads `docs/evidence/replay.json` without changing it. It also runs the existing assertion-backed `src/ablation.ts` and `src/degradation.ts` scripts and derives the comparison counts, gate reasons, timeout roles, and safe tool from their output. No causal proof files or runtime code are modified.

The replay image shows selected actual canonical events in recorded order. Bar lengths and hypothesis markers come from the committed replay, and the dashed line is its configured 205 ms action boundary. All printed event times are canonical deterministic-fixture times, not live callback timing or MTTR. `SafetyGateInterception` is the implementation class in `src/app.ts`, reached through Mozaik's `InterceptionHandler`.

Both ablation arms block rollback. The concurrent case has all three hypotheses and conflicting evidence; the sequential case has one hypothesis and holds for missing evidence. Rollback is proposal-only. No authenticated provider run is claimed.

## Visual review

Reviewed the live gallery and all 15 uploaded images across synod, ClaimScope, AI SWARM STUDIO, FAULTLINE, and watchtower on 2026-09-06 UTC. Synod has the strongest first-glance hierarchy; ClaimScope has the clearest evidence presentation; FAULTLINE has the most convincing SRE product interface. Watchtower and AI SWARM STUDIO lose most information at thumbnail size.

Three passes: story and hierarchy; typography, spacing and brighter safe-action contrast; then reduction at 320 × 180 beside the five competing first images. The final cover uses one coral block event and a green rewrite strip. Its thumbnail communicates a consequence rather than requiring the reader to decode a dashboard. Center-cropping at 16:9 preserves the whole composition.

Use all four now. Consider replacing image four only when a real authenticated provider receipt through the existing interception path is committed and independently verifiable.
