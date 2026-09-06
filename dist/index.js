import process from "node:process";
import { runIncidentScenario } from "./app.js";
import { providerPreflight } from "./provider-safety.js";
const env = process.env;
const dryRun = env.DRY_RUN !== "0" && env.RUN_MODEL !== "1";
const model = env.MODEL ?? "gpt-5.5";
const preflight = dryRun ? null : providerPreflight(model, env);
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
        process.once("unhandledRejection", () => {
            console.error(JSON.stringify({
                ok: false,
                error: "provider_inference_failed",
                model,
                note: "Mozaik 4.0.5 runLoop returns void, so IncidentMesh terminates this CLI process on a rejected provider inference rather than emitting a misleading success report.",
            }));
            process.exit(1);
        });
    }
    const report = await runIncidentScenario({ dryRun, model });
    console.log(JSON.stringify(report));
}
