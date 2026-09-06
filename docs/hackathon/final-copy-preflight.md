# Final submission-copy preflight

Run from the exact release candidate before pasting fields into JigJoy:

```bash
python3 - <<'PY'
from pathlib import Path
import re

submission = Path("docs/hackathon/submission.md").read_text()
readme = Path("README.md").read_text()

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

for phrase in (
    "plan can become wrong while it is still being generated",
    "1,389 ms",
    "rollback_production",
    "10,000-case safety stress test",
):
    assert phrase in description, f"description lost core phrase: {phrase}"

for phrase in (
    "incident.opened",
    "revision 1",
    "revision 3",
    "Only scheduling changes",
    "Destructive rollback remains blocked in both cases",
    "changes which decisions are still valid",
):
    assert phrase in concurrency, f"concurrency explanation lost core phrase: {phrase}"

lower = (readme + submission).lower()
for phrase in (
    "sequential scheduling permits rollback",
    "sequential rollback crosses",
    "serialization permits destructive rollback",
    "production-ready system",
    "production ready system",
    "proves simultaneous token generation",
    "improves mttr",
):
    assert phrase not in lower, f"unsafe/stale claim: {phrase}"

assert "| Destructive rollback authorized | **no** | **no** |" in readme
assert "docs/assets/gemini-proof.svg" in readme
assert "https://www.youtube.com/watch?v=ohw8Ybt_dIM" in readme
assert "1,389 ms" in readme
assert "37 focused tests" in Path("docs/judge-guide.md").read_text()

for path in (
    "docs/gallery/jigjoy-01-cover.png",
    "docs/gallery/jigjoy-02-ablation.png",
    "docs/gallery/jigjoy-03-interception.png",
    "docs/gallery/jigjoy-04-safety-proof.png",
):
    assert Path(path).is_file(), f"missing screenshot: {path}"

print(f"Description: {len(description)} / 2000")
print(f"Concurrency: {len(concurrency)} / 2000")
print(f"Demo URL: {demo}")
print("Current proof claims: PASS")
PY
```

Upload screenshots in this exact order:

1. `docs/gallery/jigjoy-01-cover.png`
2. `docs/gallery/jigjoy-02-ablation.png`
3. `docs/gallery/jigjoy-03-interception.png`
4. `docs/gallery/jigjoy-04-safety-proof.png`

The approved final demo URL is `https://www.youtube.com/watch?v=ohw8Ybt_dIM`. After resubmitting, compare the logged-out public detail record—not merely the success toast—with the fields above.
