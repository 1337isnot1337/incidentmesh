import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { runIncidentScenario, type TimelineEvent } from "./app.js"

const outputSvg = resolve(process.argv[2] ?? "docs/evidence/replay.svg")
const outputJson = resolve(process.argv[3] ?? "docs/evidence/replay.json")
// Optional source report lets presentation changes preserve captured evidence.
const report: Awaited<ReturnType<typeof runIncidentScenario>> = process.argv[4]
  ? JSON.parse(await readFile(resolve(process.argv[4]), "utf8"))
  : await runIncidentScenario({ dryRun: true, scheduleMode: "concurrent", actionBoundaryMs: 205 })

const esc = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")

const first = (type: string): TimelineEvent | undefined => report.timeline.find((item) => item.type === type)
const all = (type: string): TimelineEvent[] => report.timeline.filter((item) => item.type === type)

const keyEvents = [
  { key: "proposal", label: "Rollback pending", event: first("incident.action.proposed") },
  { key: "gate", label: "Safety Gate: BLOCKED", event: first("incident.gate.decision") },
  { key: "interception", label: "Mozaik interception", event: first("mozaik.interception.started") },
  { key: "rewrite", label: "Rewritten to request_corroboration", event: first("mozaik.interception.rewritten") },
  { key: "safe", label: "Safe tool executed", event: first("incident.action.safe-executed") },
  { key: "canary", label: "Impact → canary", event: first("incident.mitigation.replanned") },
  ...all("incident.evidence.added").map((event, index) => ({ key: `evidence-${index}`, label: `${event.producer} corroborates`, event })),
].filter((item): item is { key: string; label: string; event: TimelineEvent } => item.event !== undefined)

const canonicalBoundaryMs = report.action.boundaryMs
if (canonicalBoundaryMs === null) throw new Error("canonical replay requires a fixed deterministic action boundary")
const maxObserved = Math.max(report.elapsedMs, ...report.timeline.map((item) => item.atMs), canonicalBoundaryMs) + 12
const x0 = 220
const x1 = 920
const scaleX = (ms: number): number => x0 + (ms / maxObserved) * (x1 - x0)
const spanY: Record<string, number> = { trace: 174, dependency: 238, impact: 302 }
const spanLabel: Record<string, string> = { trace: "Trace", dependency: "Dependency", impact: "Impact" }
const height = 480 + keyEvents.length * 48
const svg: string[] = []
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}" role="img" aria-labelledby="title desc">`)
svg.push(`<title id="title">IncidentMesh canonical replay</title><desc id="desc">Measured responder spans, configured timer and observed callback, followed by recorded action events. Source: companion replay.json.</desc>`)
svg.push(`<rect width="960" height="${height}" rx="16" fill="#101820"/><g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">`)
svg.push(`<text x="40" y="56" fill="#f0f5f7" font-size="32" font-weight="700">Evidence arrives before the action.</text>`)
svg.push(`<text x="40" y="92" fill="#b0c1cc" font-size="21">Canonical replay · measured time in milliseconds</text>`)
for (const span of report.spans) {
  const y = spanY[span.role]
  const end = span.completedAtMs ?? report.elapsedMs
  svg.push(`<text x="40" y="${y + 7}" fill="#f0f5f7" font-size="23">${spanLabel[span.role]}</text>`)
  svg.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#25343f" stroke-width="14" stroke-linecap="round"/>`)
  svg.push(`<line x1="${scaleX(span.startedAtMs)}" y1="${y}" x2="${scaleX(end)}" y2="${y}" stroke="#72d5c2" stroke-width="14" stroke-linecap="round"/>`)
  svg.push(`<text x="${x0}" y="${y + 30}" fill="#b0c1cc" font-size="18">${span.startedAtMs}–${end} ms</text>`)
}
const boundaryX = scaleX(canonicalBoundaryMs)
svg.push(`<line x1="${boundaryX}" y1="126" x2="${boundaryX}" y2="337" stroke="#ffb18a" stroke-width="2" stroke-dasharray="6 5"/>`)
svg.push(`<text x="${boundaryX - 12}" y="133" text-anchor="end" fill="#ffb18a" font-size="18">Configured: ${canonicalBoundaryMs} ms</text>`)
svg.push(`<path d="M40 365 H920" stroke="#30404b"/>`)
svg.push(`<text x="40" y="405" fill="#f0f5f7" font-size="25" font-weight="700">Action event ledger</text>`)
svg.push(`<text x="920" y="405" text-anchor="end" fill="#b0c1cc" font-size="20">Observed callback: ${report.action.attemptedAtMs} ms</text>`)
keyEvents.forEach((item, index) => {
  const y = 456 + index * 48
  const color = item.key === "gate" ? "#ffb18a" : item.key === "safe" || item.key === "canary" || item.key.startsWith("evidence") ? "#8ee3c7" : "#e0e9ee"
  svg.push(`<text x="40" y="${y}" fill="#b0c1cc" font-size="21" font-family="ui-monospace, SFMono-Regular, Consolas, monospace">${item.event.atMs} ms</text>`)
  svg.push(`<circle cx="195" cy="${y - 7}" r="4" fill="${color}"/>`)
  svg.push(`<text x="220" y="${y}" fill="${color}" font-size="23" font-weight="${item.key === "gate" ? "700" : "400"}">${esc(item.label)}</text>`)
})
svg.push(`</g></svg>`)

await mkdir(dirname(outputSvg), { recursive: true })
await mkdir(dirname(outputJson), { recursive: true })
await writeFile(outputSvg, svg.join("\n") + "\n", "utf8")
await writeFile(outputJson, JSON.stringify(report, null, 2) + "\n", "utf8")
console.log(JSON.stringify({ svg: outputSvg, json: outputJson, elapsedMs: report.elapsedMs, action: report.action, gate: report.gateDecision }))
