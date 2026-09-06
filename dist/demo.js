import { concurrencySpeedup, overlapCount, runIncidentScenario } from "./app.js";
console.log("\nINCIDENTMESH // LIVE CONCURRENT RESPONSE ROOM");
console.log("Incident: checkout-api-us-east — 38% checkout failures in us-east");
console.log("\nThe room opens one event. Three independent responders start immediately.\n");
const report = await runIncidentScenario({
    dryRun: true,
    trace: (event) => {
        const at = String(event.atMs).padStart(4, " ");
        const actor = event.producer.padEnd(12, " ");
        console.log(`${at}ms  ${actor}  ${event.type.replace("incident.", "")}: ${event.detail}`);
    },
});
console.log("\n--- RUNTIME PROOF ---");
console.log(`participants: Trace, Dependency, Impact + Safety Gate`);
console.log(`overlapping responder pairs: ${overlapCount(report)} / 3`);
for (const span of report.spans) {
    const end = span.completedAtMs ?? span.startedAtMs;
    const width = Math.max(1, Math.round((end - span.startedAtMs) / 8));
    console.log(`${span.role.padEnd(11, " ")} ${"█".repeat(width)} ${span.startedAtMs}–${end}ms`);
}
console.log(`concurrency speedup proxy: ${concurrencySpeedup(report)}× sequential work / wall time`);
console.log(`gate: ${report.gateDecision.toUpperCase()} — ${report.contradictions} conflicting causes at ${report.confidence.toFixed(2)} confidence`);
console.log(`adaptation: ${report.adaptations[0] ?? "none"}`);
console.log(`evidence added after adaptation: ${report.evidence.length}`);
console.log("\nFinal recommendation: canary the mitigation and require corroboration before rollback.");
