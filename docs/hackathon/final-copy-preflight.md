# Submission-copy and repository-evidence preflight

The public JigJoy fields are already published. This preflight verifies two things without conflating them:

1. the frozen field copy in [`submission.md`](submission.md) remains internally safe and matches the still-true historical provider claim used in the public submission;
2. the repository's newer release-SHA Phase-1 provider evidence is present, byte-identified, and scoped correctly.

Run from the repository root:

```bash
python3 - <<'PY'
from pathlib import Path
import hashlib
import json
import re

submission = Path("docs/hackathon/submission.md").read_text()
readme = Path("README.md").read_text()
judge_guide = Path("docs/judge-guide.md").read_text()


def section(title):
    match = re.search(rf"^## {re.escape(title)}\n\n(.*?)(?=\n## |\Z)", submission, re.M | re.S)
    if not match:
        raise SystemExit(f"missing section: {title}")
    return match.group(1).strip()


description = section("Description")
concurrency = section("How do the agents run concurrently?")
demo = section("Demo/video URL")

assert len(description) <= 2000, len(description)
assert len(concurrency) <= 2000, len(concurrency)
assert demo == "https://www.youtube.com/watch?v=ohw8Ybt_dIM", demo

for name, value in (("Description", description), ("Concurrency", concurrency)):
    for marker in ("**", "`"):
        assert marker not in value, f"{name} contains Markdown marker {marker}"

# Frozen public field copy: this intentionally refers to the historical full-path receipt.
for phrase in (
    "plan can become wrong while it is still being generated",
    "1,389 ms",
    "rollback_production",
    "10,000-case safety stress test",
):
    assert phrase in description, f"published description lost core phrase: {phrase}"

for phrase in (
    "incident.opened",
    "revision 1",
    "revision 3",
    "Only scheduling changes",
    "Destructive rollback remains blocked in both cases",
    "changes which decisions are still valid",
):
    assert phrase in concurrency, f"published concurrency explanation lost core phrase: {phrase}"

lower = (readme + submission + judge_guide).lower()
for phrase in (
    "sequential scheduling permits rollback",
    "sequential rollback crosses",
    "serialization permits destructive rollback",
    "production-ready system",
    "production ready system",
    "proves simultaneous token generation",
    "improves mttr",
    "fresh authenticated phase-2 interception against the release sha",
):
    assert phrase not in lower, f"unsafe/stale claim: {phrase}"

# Current README/judge surface must expose both authenticated evidence classes.
assert "| Destructive rollback authorized | **no** | **no** |" in readme
assert "docs/assets/gemini-proof.svg" in readme
assert "https://www.youtube.com/watch?v=ohw8Ybt_dIM" in readme
assert "1,363 ms" in readme
assert "1,389 ms" in readme
assert "37 focused tests" in judge_guide
assert "release-phase1-provider-run.md" in readme
assert "real-provider-run.md" in readme

# Fresh release-SHA raw receipt: verify provenance and recompute provider-call overlap
# from inference events rather than the broader participant-span overlap field.
raw_path = Path("docs/evidence/release-phase1-provider-run.json")
raw_bytes = raw_path.read_bytes()
raw = json.loads(raw_bytes)
raw_sha = hashlib.sha256(raw_bytes).hexdigest()
assert raw_sha == "6a53fd13cac4eae9e02ba2e1361881432a98e9cc23e58808ace6b006c1ebf313", raw_sha
assert raw["commit"] == "e98376445c42ea532cbe4993095911d932a3a57a"
assert raw["provider"] == "google"
assert raw["model"] == "gemini-3.5-flash-lite"
assert raw["gateDecision"] == "blocked"
assert len(raw["hypotheses"]) == 3
assert {h["role"] for h in raw["hypotheses"]} == {"trace", "dependency", "impact"}
assert raw["interceptionObserved"] is False
assert raw["action"]["proposed"] is False
assert raw["action"]["requestedTool"] is None
assert raw["action"]["intercepted"] is False
assert raw["action"]["executedTool"] == "request_corroboration"

windows = {}
for role in ("Trace", "Dependency", "Impact"):
    starts = [e["atMs"] for e in raw["inferenceEvents"] if e["producer"] == role and e["type"] == "mozaik.inference.started"]
    ends = [e["atMs"] for e in raw["inferenceEvents"] if e["producer"] == role and e["type"] == "mozaik.inference.completed"]
    assert len(starts) == 1 and len(ends) == 1, (role, starts, ends)
    windows[role] = (starts[0], ends[0])

common_start = max(start for start, _ in windows.values())
common_end = min(end for _, end in windows.values())
assert (common_start, common_end, common_end - common_start) == (4, 1367, 1363), (common_start, common_end)

manifest = json.loads(Path("docs/evidence/release-phase1-provider-manifest.json").read_text())
assert manifest["capture"]["sourceSha"] == raw["commit"]
assert manifest["phase1"]["commonThreeWayOverlap"]["durationMs"] == 1363
assert manifest["phase2"]["complete"] is False
assert manifest["phase2"]["rollbackProductionProposed"] is False
assert manifest["phase2"]["interceptionObserved"] is False
assert manifest["preservedRawArtifacts"]["rawJsonCommittedVerbatim"] is True
assert manifest["preservedRawArtifacts"]["rawJsonSha256"] == raw_sha

for path in (
    "docs/gallery/jigjoy-01-cover.png",
    "docs/gallery/jigjoy-02-ablation.png",
    "docs/gallery/jigjoy-03-interception.png",
    "docs/gallery/jigjoy-04-safety-proof.png",
):
    assert Path(path).is_file(), f"missing screenshot: {path}"

print(f"Published Description: {len(description)} / 2000")
print(f"Published Concurrency: {len(concurrency)} / 2000")
print(f"Published Demo URL: {demo}")
print(f"Fresh raw receipt SHA-256: {raw_sha}")
print(f"Fresh release-SHA provider overlap: {common_end - common_start} ms")
print("Submission copy + current evidence claims: PASS")
PY
```

## Published screenshot order

1. `docs/gallery/jigjoy-01-cover.png`
2. `docs/gallery/jigjoy-02-ablation.png`
3. `docs/gallery/jigjoy-03-interception.png`
4. `docs/gallery/jigjoy-04-safety-proof.png`

The published demo URL is `https://www.youtube.com/watch?v=ohw8Ybt_dIM`.

For current public-surface verification, use [`submission-surface-audit.md`](submission-surface-audit.md). Do not rewrite the frozen field copy merely because newer repository evidence exists; only change those fields if the public JigJoy submission is intentionally changed too.
