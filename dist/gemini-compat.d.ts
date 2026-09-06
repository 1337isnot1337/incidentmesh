import { SemanticEvent } from "@mozaik-ai/core";
import type { InferenceInput, InferenceOutput, InferenceRunner } from "@mozaik-ai/core";
type GeminiPart = {
    text?: string;
    thought?: boolean;
    thoughtSignature?: string;
    functionCall?: {
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
    };
};
type GeminiResponse = {
    candidates?: Array<{
        content?: {
            parts?: GeminiPart[];
        };
    }>;
    usageMetadata?: unknown;
};
type GeminiClient = {
    models: {
        generateContent(request: {
            model: string;
            contents: unknown[];
            config: Record<string, unknown>;
        }): Promise<GeminiResponse>;
    };
};
/**
 * Gemini-compatible Mozaik runner. Gemini's thought signatures are provider
 * metadata, so they stay in this runner's private call-id map rather than in
 * IncidentState or the public report.
 */
export declare class GeminiSignaturePreservingRunner implements InferenceRunner {
    private readonly signatures;
    private readonly callNames;
    private readonly client;
    constructor(client?: GeminiClient);
    run(request: InferenceInput): Promise<InferenceOutput>;
    stream(request: InferenceInput): AsyncGenerator<SemanticEvent>;
    private mapContext;
    private mapResponse;
}
export {};
