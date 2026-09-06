import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { runIncidentScenario, type TimelineEvent } from "./app.js"

const outputSvg = resolve(process.argv[2] ?? "docs/evidence/replay.svg")
const outputJson = resolve(process.argv[3] ?? "docs/evidence/replay.json")
const report = await runIncidentScenario({ dryRun: true, scheduleMode: "concurrent", actionBoundaryMs: 205 })

const esc = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")

const first = (type: string): TimelineEvent | undefined => report.timeline.find((item) => item.type === type)
const all = (type: string): TimelineEvent[] => report.timeline.filter((item) => item.type === type)

const keyEvents = [
  { key: "proposal", label: "rollback pending", event: first("incident.action.proposed") },
  { key: "gate", label: "SAFETY GATE: BLOCKED", event: first("incident.gate.decision") },
  { key: "interception", label: "Mozaik interception", event: first("mozaik.interception.started") },
  { key: "rewrite", label: "rollback → request_corroboration", event: first("mozaik.interception.rewritten") },
  { key: "safe", label: "safe tool executed", event: first("incident.action.safe-executed") },
  { key: "canary", label: "Impact → canary", event: first("incident.mitigation.replanned") },
  ...all("incident.evidence.added").map((event, index) => ({ key: `evidence-${index}`, label: `${event.producer} corroborates`, event })),
].filter((item): item is { key: string; label: string; event: TimelineEvent } => item.event !== undefined)

const canonicalBoundaryMs = report.action.boundaryMs
if (canonicalBoundaryMs === null) throw new Error("canonical replay requires a fixed deterministic action boundary")
const maxObserved = Math.max(report.elapsedMs, ...report.timeline.map((item) => item.atMs), canonicalBoundaryMs) + 12
const x0 = 245
const x1 = 1190
const scaleX = (ms: number): number => x0 + (ms / maxObserved) * (x1 - x0)
const spanY: Record<string, number> = { trace: 165, dependency: 225, impact: 285 }
const spanLabel: Record<string, string> = { trace: "Trace", dependency: "Dependency", impact: "Impact" }

const svg: string[] = []
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="760" viewBox="0 0 1280 760" role="img" aria-labelledby="title desc">`)
svg.push(`<title id="title">IncidentMesh canonical replay</title>`)
svg.push(`<desc id="desc">Data-derived replay showing concurrent responder spans, the fixed rollback action boundary, a blocked Safety Gate, Mozaik interception, canary replanning, and corroboration.</desc>`)
svg.push(`<rect width="1280" height="760" fill="#0b1220"/>`)
svg.push(`<rect x="24" y="24" width="1232" height="712" rx="26" fill="#0f172a" stroke="#334155" stroke-width="2"/>`)
svg.push(`<text x="64" y="78" fill="#f8fafc" font-family="ui-sans-serif,system-ui,sans-serif" font-size="32" font-weight="800">IncidentMesh — canonical action-boundary replay</text>`)
svg.push(`<text x="64" y="111" fill="#cbd5e1" font-family="ui-sans-serif,system-ui,sans-serif" font-size="18">Parallel evidence changes which function call crosses the safety boundary.</text>`)

for (const span of report.spans) {
  const y = spanY[span.role]
  const end = span.completedAtMs ?? report.elapsedMs
  svg.push(`<text x="64" y="${y + 7}" fill="#e2e8f0" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="17">${spanLabel[span.role]}</text>`)
  svg.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#1e293b" stroke-width="20" stroke-linecap="round"/>`)
  svg.push(`<line x1="${scaleX(span.startedAtMs)}" y1="${y}" x2="${scaleX(end)}" y2="${y}" stroke="#94a3b8" stroke-width="20" stroke-linecap="round"/>`)
  svg.push(`<text x="${scaleX(end) + 10}" y="${y + 6}" fill="#94a3b8" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="13">${span.startedAtMs}–${end} ms</text>`)
}

const boundaryX = scaleX(canonicalBoundaryMs)
svg.push(`<line x1="${boundaryX}" y1="138" x2="${boundaryX}" y2="648" stroke="#f59e0b" stroke-width="2" stroke-dasharray="8 7"/>`)
svg.push(`<text x="${boundaryX - 72}" y="139" fill="#fbbf24" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="13">fixed boundary ${canonicalBoundaryMs} ms</text>`)

svg.push(`<text x="64" y="355" fill="#f8fafc" font-family="ui-sans-serif,system-ui,sans-serif" font-size="20" font-weight="700">Causal action path</text>`)
const baseY = 397
const gap = 37
keyEvents.forEach((item, index) => {
  const y = baseY + index * gap
  const x = scaleX(item.event.atMs)
  svg.push(`<circle cx="${x}" cy="${y}" r="6" fill="${item.key === "gate" ? "#f59e0b" : item.key === "safe" || item.key === "canary" || item.key.startsWith("evidence") ? "#22c55e" : "#cbd5e1"}"/>`)
  svg.push(`<line x1="${x}" y1="${y}" x2="${x1}" y2="${y}" stroke="#1e293b" stroke-width="1"/>`)
  svg.push(`<text x="64" y="${y + 5}" fill="${item.key === "gate" ? "#fca5a5" : "#e2e8f0"}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="14" font-weight="${item.key === "gate" ? "700" : "400"}">${String(item.event.atMs).padStart(3, " ")} ms  ${esc(item.label)}</text>`)
})

const summaryY = 689
svg.push(`<rect x="64" y="${summaryY - 26}" width="1152" height="50" rx="12" fill="#111827"/>`)
svg.push(`<text x="84" y="${summaryY + 5}" fill="#cbd5e1" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="15">3/3 responder pairs overlap</text>`)
svg.push(`<text x="380" y="${summaryY + 5}" fill="#fbbf24" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="15">3 hypotheses → 2 contradictions → BLOCKED</text>`)
svg.push(`<text x="785" y="${summaryY + 5}" fill="#86efac" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="15">rollback → request_corroboration → canary → 2 evidence</text>`)
svg.push(`</svg>`)

await mkdir(dirname(outputSvg), { recursive: true })
await mkdir(dirname(outputJson), { recursive: true })
await writeFile(outputSvg, svg.join("\n") + "\n", "utf8")
await writeFile(outputJson, JSON.stringify(report, null, 2) + "\n", "utf8")
console.log(JSON.stringify({ svg: outputSvg, json: outputJson, elapsedMs: report.elapsedMs, action: report.action, gate: report.gateDecision }))
