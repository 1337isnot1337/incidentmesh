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

card = description[:240]
for phrase in ("authenticated Gemini calls overlap", "controlled stale-plan ablation", "Mozaik intercepts"):
    assert phrase in card, f"gallery-card opening lost: {phrase}"

lower = (readme + submission).lower()
for phrase in (
    "sequential scheduling permits rollback",
    "sequential rollback crosses",
    "phase 2 remains unverified",
    "phase-2 remains unverified",
):
    assert phrase not in lower, f"stale claim: {phrase}"
assert "both arms fail closed" in lower or "both rollback arms fail closed" in lower
assert "1,389 ms" in readme
assert "37 focused tests" in readme
assert "90-second demo guide" not in readme
print(f"Description: {len(description)} / 2000")
print(f"Concurrency: {len(concurrency)} / 2000")
print("Gallery card:", card)
print("Current proof claims: PASS")
PY
```

Upload screenshots in this exact order:

1. `docs/gallery/jigjoy-01-cover.png`
2. `docs/gallery/jigjoy-02-ablation.png`
3. `docs/gallery/jigjoy-03-interception.png`
4. `docs/gallery/jigjoy-04-safety-proof.png`

Preserve any existing public video/deployment URL during resubmission. After submitting, compare the public detail record—not merely the success toast—with the fields above.
