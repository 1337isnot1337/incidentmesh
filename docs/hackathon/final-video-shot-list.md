# Final video shot list

Target: 78–85 seconds. The stale-plan causal moment gets the most screen time.

| Shot | Visual | Point | Max |
| --- | --- | --- | ---: |
| Problem | `docs/gallery/jigjoy-01-cover.png` | Independent evidence is allowed to change action validity | 9 s |
| Stale-plan race | `docs/evidence/stale-plan-ablation.md` comparison table | plan rev 1; concurrent boundary rev 3 → stale/rewrite/replan; sequential boundary rev 1 → bounded proposal-only probe | 22 s |
| Authenticated execution | `docs/evidence/real-provider-run.md` | Gemini Flash-Lite, 1,389 ms three-way overlap, authenticated rollback/interception/safe-tool/follow-up | 16 s |
| Boundary enforcement | filtered `npm run demo` output | per-attempt snapshot; blocked rollback → request_corroboration | 15 s |
| Stress and symmetry | `docs/evidence/safety-stress.md` | 10,000 cases / 40,000 attempts / all critical violation counts zero; approved path still passes | 12 s |
| Close | cover or stale table | “Concurrency … changes which decisions are still valid.” | 8 s |

Pre-run commands. Crop all terminal noise. Keep `1 → 3`, `STALE`, `rollback_production`, and `request_corroboration` readable.

If the cut is long, remove pauses before compressing narration. Do not add install, benchmark, dependency, architecture-tour, or provider-setup shots.
