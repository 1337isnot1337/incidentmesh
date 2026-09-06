# Presentation assets

The wordmark pairs three incoming signals with an action boundary. Use the light or dark wordmark to match the surrounding page. The hero uses a separate narrow composition below 600 px; its command rewrite is an illustration of the canonical fixture, not a screenshot or a live production action.

Palette: ink `#101820`, evidence `#72d5c2`, blocked `#ffb18a`, safe rewrite `#8ee3c7`. SVGs use system fonts and contain no external resources.

The Astra development credit uses its own black, silver-white, and icy-blue treatment, drawn from [OpenAI's Astra model artwork](https://developers.openai.com/images/api/models/icons/gpt-6-astra.png). Its six-armed stellar spiral is a custom emblem, not an official logo.

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

The presentation pass compared the rendered READMEs of [uv](https://github.com/astral-sh/uv), [Zed](https://github.com/zed-industries/zed), [Supabase](https://github.com/supabase/supabase), [Bun](https://github.com/oven-sh/bun), [Sentry](https://github.com/getsentry/sentry), and [Temporal](https://github.com/temporalio/temporal). The applicable patterns were clear product identity, short positioning, an early runnable example, and detail introduced after the initial product explanation.

Three passes checked hierarchy, polish, and reduction using GitHub-rendered Markdown in GitHub's page layout at 1440 px and 390 px viewport widths. Native headings and prose reflow; the detailed replay remains linked at full size for inspection on phones.
