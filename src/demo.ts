import { concurrencySpeedup, overlapCount, runIncidentScenario } from "./app.js"

console.log("\nINCIDENTMESH // CONCURRENT INCIDENT RESPONSE")
console.log("Incident: checkout-api-us-east — 38% checkout failures in us-east")
console.log("\nThe room opens one event. Three independent responders start immediately.\n")

const report = await runIncidentScenario({
  dryRun: true,
  trace: (event) => {
    const at = String(event.atMs).padStart(4, " ")
    const actor = event.producer.padEnd(12, " ")
    console.log(`${at}ms  ${actor}  ${event.type.replace("incident.", "")}: ${event.detail}`)
  },
})

console.log("\n--- RUNTIME PROOF ---")
console.log("participants: Trace, Dependency, Impact + Safety Gate + Action Controller")
console.log(`overlapping responder pairs: ${overlapCount(report)} / 3`)
for (const span of report.spans) {
  const end = span.completedAtMs ?? span.startedAtMs
  const width = Math.max(1, Math.round((end - span.startedAtMs) / 8))
  console.log(`${span.role.padEnd(11, " ")} ${"█".repeat(width)} ${span.startedAtMs}–${end}ms`)
}
console.log(`latency/overlap proxy: ${concurrencySpeedup(report)}× = sum of measured responder durations / concurrent wall time`)
console.log(`investigation gate: ${report.gateDecision.toUpperCase()} — ${report.gateReason}; ${report.contradictions} contradictions across ${report.hypotheses.length} authoritative hypotheses at ${report.confidence.toFixed(2)} aggregate confidence`)
console.log(`action boundary: ${report.action.gateAtBoundary?.toUpperCase() ?? "NONE"} — ${report.action.gateReasonAtBoundary ?? "no-boundary"}; safe path=${report.action.boundarySafeAction ?? "none"}`)
console.log(`action path: rollback_production -> ${report.action.executedTool ?? "not executed"} (${report.action.intercepted ? "Mozaik InterceptionHandler" : "not intercepted"})`)
console.log(`time to actionable safe mitigation: ${report.action.actionableSafePlanAtMs ?? "unavailable"}ms in this deterministic fixture`)
console.log(`adaptation: ${report.adaptations[0] ?? "none"}`)
console.log(`evidence added after adaptation: ${report.evidence.length}`)
console.log("\nFinal recommendation: proceed with the corroborated canary plan; keep rollback blocked.")
