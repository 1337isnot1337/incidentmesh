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

assert len(description) <= 2000, len(description)
assert len(concurrency) <= 2000, len(concurrency)

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

assert "destructive rollback authorized | **no** | **no**" in readme
assert "docs/assets/gemini-proof.svg" in readme
assert "1,389 ms" in readme
assert "37 focused tests" in Path("docs/judge-guide.md").read_text()

print(f"Description: {len(description)} / 2000")
print(f"Concurrency: {len(concurrency)} / 2000")
print("Current proof claims: PASS")
PY
```

Upload screenshots in this exact order unless the final video/submission plan intentionally changes them:

1. `docs/gallery/jigjoy-01-cover.png`
2. `docs/gallery/jigjoy-02-ablation.png`
3. `docs/gallery/jigjoy-03-interception.png`
4. `docs/gallery/jigjoy-04-safety-proof.png`

Preserve any existing public video/deployment URL during resubmission. Add the final public video URL once the recording is approved. After submitting, compare the public detail record—not merely the success toast—with the fields above.
