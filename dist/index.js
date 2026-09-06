import process from "node:process";
import { runIncidentScenario } from "./app.js";
import { providerPreflight } from "./provider-safety.js";
import { GeminiSignaturePreservingRunner } from "./gemini-compat.js";
const env = process.env;
const dryRun = env.DRY_RUN !== "0" && env.RUN_MODEL !== "1";
const model = env.MODEL ?? "gpt-5.5";
const phase1Only = env.PHASE1_ONLY === "1";
const reasoningEffort = env.MODEL_REASONING_EFFORT;
const geminiCompatibility = env.GEMINI_SIGNATURE_COMPAT === "1" && /^gemini-/i.test(model);
const preflight = dryRun ? null : providerPreflight(model, env);
function safeProviderError(reason) {
    const raw = reason instanceof Error ? `${reason.name}: ${reason.message}\n${reason.stack ?? ""}` : String(reason);
    return raw
        .replace(/AIza[0-9A-Za-z_-]{20,}/g, "<redacted-google-key>")
        .replace(/(?:api[_-]?key|key)=([^&\s]+)/gi, "$1=<redacted>")
        .replace(/\b(?:OPENAI|ANTHROPIC|GOOGLE|GEMINI|DEEPSEEK)_API_KEY\s*=\s*\S+/gi, "<redacted-api-key-assignment>")
        .replace(/\/home\/[^\s:]+/g, "<redacted-home-path>")
        .replace(/\n+/g, " ")
        .slice(0, 4_000);
}
if (preflight && !preflight.ok) {
    console.error(JSON.stringify({
        ok: false,
        error: preflight.error,
        model: preflight.model,
        provider: preflight.provider,
        acceptedCredentialNames: preflight.acceptedCredentialNames,
        note: "No provider loops were started and no successful IncidentReport was emitted.",
    }));
    process.exitCode = 2;
}
else {
    if (!dryRun) {
        process.once("unhandledRejection", (reason) => {
            console.error(JSON.stringify({
                ok: false,
                error: "provider_inference_failed",
                model,
                reason: safeProviderError(reason),
                note: "Mozaik 4.0.5 runLoop returns void, so IncidentMesh terminates this CLI process on a rejected provider inference rather than emitting a misleading success report.",
            }));
            process.exit(1);
        });
    }
    const report = await runIncidentScenario({
        dryRun,
        model,
        phase1Only,
        reasoningEffort,
        inferenceRunner: geminiCompatibility ? new GeminiSignaturePreservingRunner() : undefined,
    });
    console.log(JSON.stringify(report));
}
