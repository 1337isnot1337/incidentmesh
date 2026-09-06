import { supportedModels } from "@mozaik-ai/core";
const PROVIDER_CREDENTIALS = {
    openai: ["OPENAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY"],
    google: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    deepseek: ["DEEPSEEK_API_KEY"],
};
export function providerPreflight(model, env) {
    const specification = supportedModels.find((candidate) => candidate.specification.name === model)?.specification;
    if (!specification) {
        return { ok: false, model, provider: null, acceptedCredentialNames: [], error: "unsupported_model" };
    }
    const acceptedCredentialNames = PROVIDER_CREDENTIALS[specification.provider] ?? [];
    const hasCredential = acceptedCredentialNames.length === 0
        || acceptedCredentialNames.some((name) => typeof env[name] === "string" && env[name].trim().length > 0);
    return hasCredential
        ? { ok: true, model, provider: specification.provider, acceptedCredentialNames }
        : { ok: false, model, provider: specification.provider, acceptedCredentialNames, error: "missing_provider_credential" };
}
