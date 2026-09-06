export type ProviderPreflight = {
    ok: boolean;
    model: string;
    provider: string | null;
    acceptedCredentialNames: string[];
    error?: "unsupported_model" | "missing_provider_credential";
};
export declare function providerPreflight(model: string, env: Record<string, string | undefined>): ProviderPreflight;
