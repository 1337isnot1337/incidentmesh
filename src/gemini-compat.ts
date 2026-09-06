import { GoogleGenAI } from "@google/genai"
import {
  DeveloperMessageItem,
  FunctionCallItem,
  FunctionCallOutputItem,
  ModelMessageItem,
  ReasoningItem,
  SemanticEvent,
  SystemMessageItem,
  UserMessageItem,
} from "@mozaik-ai/core"
import type { InferenceInput, InferenceOutput, InferenceRunner } from "@mozaik-ai/core"

type GeminiPart = {
  text?: string
  thought?: boolean
  thoughtSignature?: string
  functionCall?: { id?: string; name?: string; args?: Record<string, unknown> }
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>
  usageMetadata?: unknown
}

type GeminiClient = {
  models: { generateContent(request: { model: string; contents: unknown[]; config: Record<string, unknown> }): Promise<GeminiResponse> }
}

function jsonObject(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text)
    return value && typeof value === "object" && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

/**
 * Gemini-compatible Mozaik runner. Gemini's thought signatures are provider
 * metadata, so they stay in this runner's private call-id map rather than in
 * IncidentState or the public report.
 */
export class GeminiSignaturePreservingRunner implements InferenceRunner {
  private readonly signatures = new Map<string, string>()
  private readonly callNames = new Map<string, string>()
  private readonly client: GeminiClient

  constructor(client?: GeminiClient) {
    this.client = client ?? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) as unknown as GeminiClient
  }

  async run(request: InferenceInput): Promise<InferenceOutput> {
    const { contents, systemInstruction } = this.mapContext(request)
    const config: Record<string, unknown> = {}
    if (systemInstruction) config.systemInstruction = systemInstruction
    if (request.tools && request.tools.length > 0) {
      config.tools = [{ functionDeclarations: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.parameters,
      })) }]
    }
    if (request.structuredOutput) {
      config.responseMimeType = "application/json"
      config.responseSchema = request.structuredOutput.schema
    }
    // Gemini's API has no `none` thinking level. Treat the generic opt-out
    // value as omission so callers can disable extra reasoning safely.
    if (request.reasoningEffort && request.reasoningEffort !== "none") {
      config.thinkingConfig = { thinkingLevel: request.reasoningEffort, includeThoughts: true }
    }
    const response = await this.client.models.generateContent({ model: request.model, contents, config })
    return this.mapResponse(response)
  }

  async *stream(request: InferenceInput): AsyncGenerator<SemanticEvent> {
    yield SemanticEvent.create("inference.output", "gemini-signature-preserving", await this.run(request))
  }

  private mapContext(request: InferenceInput): { contents: unknown[]; systemInstruction?: string } {
    const contents: Array<{ role: "user" | "model"; parts: unknown[] }> = []
    const system: string[] = []
    const add = (role: "user" | "model", part: unknown): void => {
      const last = contents.at(-1)
      if (last?.role === role) last.parts.push(part)
      else contents.push({ role, parts: [part] })
    }
    for (const item of request.context.getItems()) {
      if (item instanceof DeveloperMessageItem || item instanceof SystemMessageItem) {
        system.push(item.content.text)
      } else if (item instanceof UserMessageItem) {
        add("user", { text: item.content.text })
      } else if (item instanceof ModelMessageItem) {
        add("model", { text: item.content.text })
      } else if (item instanceof ReasoningItem) {
        if (item.content?.text) add("model", { text: item.content.text, thought: true })
      } else if (item instanceof FunctionCallItem) {
        this.callNames.set(item.callId, item.name)
        const functionCall: Record<string, unknown> = {
          id: item.callId,
          name: item.name,
          args: jsonObject(item.args),
        }
        const signature = this.signatures.get(item.callId)
        add("model", signature ? { functionCall, thoughtSignature: signature } : { functionCall })
      } else if (item instanceof FunctionCallOutputItem) {
        add("user", {
          functionResponse: {
            id: item.callId,
            name: this.callNames.get(item.callId) ?? "",
            response: jsonObject(item.output.text),
          },
        })
      }
    }
    return { contents, systemInstruction: system.length > 0 ? system.join("\n\n") : undefined }
  }

  private mapResponse(response: GeminiResponse): InferenceOutput {
    const items: Array<FunctionCallItem | ModelMessageItem | ReasoningItem> = []
    const parts = response.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      if (part.functionCall) {
        const callId = part.functionCall.id ?? ""
        const name = part.functionCall.name ?? ""
        if (part.thoughtSignature) this.signatures.set(callId, part.thoughtSignature)
        this.callNames.set(callId, name)
        items.push(FunctionCallItem.rehydrate({ callId, name, args: JSON.stringify(part.functionCall.args ?? {}) }))
      } else if (part.thought && part.text) {
        items.push(ReasoningItem.rehydrate({ content: { type: "input_text", text: part.text } as never, encryptedContent: undefined, summary: [] }))
      } else if (part.text) {
        items.push(ModelMessageItem.rehydrate({ text: part.text }))
      }
    }
    return { items, tokenUsage: undefined, rowResponse: response }
  }
}
