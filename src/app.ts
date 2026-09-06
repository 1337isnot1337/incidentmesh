import {
  Agent,
  FunctionCallItem,
  RuntimeState,
  SemanticEvent,
  SituationSpecification,
  createAgent,
  createHuman,
  defineRuntime,
} from "@mozaik-ai/core"
import type {
  ExecutableTransition,
  InterceptionHandler,
  SituationContext,
  SituationHandler,
  Tool,
} from "@mozaik-ai/core"

export const INCIDENT_OPENED = "incident.opened"
export const SPAN_STARTED = "incident.span.started"
export const HYPOTHESIS_EMITTED = "incident.hypothesis.emitted"
export const SPAN_COMPLETED = "incident.span.completed"
export const GATE_DECISION = "incident.gate.decision"
export const MITIGATION_REPLANNED = "incident.mitigation.replanned"
export const EVIDENCE_ADDED = "incident.evidence.added"

export const ROLES = ["trace", "dependency", "impact"] as const
export type Role = (typeof ROLES)[number]

export type Hypothesis = {
  role: Role
  claim: string
  confidence: number
  rootCause: string
  atMs: number
}

export type TimelineEvent = {
  atMs: number
  type: string
  producer: string
  detail: string
}

export type Span = {
  role: Role
  startedAtMs: number
  completedAtMs?: number
}

export type IncidentReport = {
  schema: "incidentmesh.report/v1"
  incident: string
  phase: "contained" | "investigating"
  gateDecision: "blocked" | "approved" | "pending"
  confidence: number
  contradictions: number
  hypotheses: Hypothesis[]
  evidence: string[]
  adaptations: string[]
  spans: Span[]
  timeline: TimelineEvent[]
  elapsedMs: number
}

export class IncidentState extends RuntimeState {
  readonly incident = "checkout-api-us-east"
  readonly startedAt = performance.now()
  readonly hypotheses: Hypothesis[] = []
  readonly evidence: string[] = []
  readonly adaptations: string[] = []
  readonly spans = new Map<Role, Span>()
  readonly timeline: TimelineEvent[] = []
  gateDecision: IncidentReport["gateDecision"] = "pending"
  confidence = 0
  contradictions = 0
  followupRequested = false
  onTrace?: (event: TimelineEvent) => void

  record(type: string, producer: string, detail: string): void {
    const participant = this.getParticipant(producer)
    const label = participant?.getManifest().name ?? producer
    const event = { atMs: Math.round(performance.now() - this.startedAt), type, producer: label, detail }
    this.timeline.push(event)
    this.onTrace?.(event)
  }

  toReport(): IncidentReport {
    const spans = [...this.spans.values()].sort((a, b) => a.startedAtMs - b.startedAtMs)
    return {
      schema: "incidentmesh.report/v1",
      incident: this.incident,
      phase: this.gateDecision === "blocked" ? "contained" : "investigating",
      gateDecision: this.gateDecision,
      confidence: Number(this.confidence.toFixed(2)),
      contradictions: this.contradictions,
      hypotheses: [...this.hypotheses],
      evidence: [...this.evidence],
      adaptations: [...this.adaptations],
      spans,
      timeline: [...this.timeline],
      elapsedMs: Math.round(performance.now() - this.startedAt),
    }
  }
}

type EventPayload = Record<string, unknown>

function isType(type: string): SituationSpecification {
  return new (class extends SituationSpecification {
    isSatisfiedBy({ event }: SituationContext): boolean {
      return event.type === type
    }
  })()
}

function isPeerType(type: string): SituationSpecification {
  return new (class extends SituationSpecification {
    isSatisfiedBy({ event, participant }: SituationContext): boolean {
      return event.type === type && event.producerId !== participant.getId()
    }
  })()
}

function event(type: string, producerId: string, payload: EventPayload): SemanticEvent {
  return SemanticEvent.create(type, producerId, payload)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const ROLE_CONFIG: Record<Role, { name: string; capability: string; delay: number; claim: string; rootCause: string }> = {
  trace: {
    name: "Trace",
    capability: "request-path telemetry",
    delay: 80,
    claim: "p95 latency jumped on checkout requests before the error spike",
    rootCause: "cache-stampede",
  },
  dependency: {
    name: "Dependency",
    capability: "deploy and dependency health",
    delay: 130,
    claim: "deploy 8f3 correlates with database-pool wait and queue growth",
    rootCause: "deploy-8f3",
  },
  impact: {
    name: "Impact",
    capability: "customer blast-radius analysis",
    delay: 180,
    claim: "38% of checkout attempts fail for users in us-east",
    rootCause: "regional-impact",
  },
}

const rollbackTool: Tool = {
  type: "function",
  name: "rollback_production",
  description: "Propose a production rollback for the incident. Safety Gate may rewrite it.",
  parameters: {
    type: "object",
    properties: { service: { type: "string" }, reason: { type: "string" } },
    required: ["service", "reason"],
    additionalProperties: false,
  },
  strict: true,
  invoke: async (args: { service: string; reason: string }) => ({
    status: "proposal-only",
    service: args.service,
    reason: args.reason,
  }),
}

export class SafetyGateInterception implements InterceptionHandler {
  constructor(private readonly state: IncidentState) {}

  isSatisfiedBy(transition: ExecutableTransition): boolean {
    return transition.nextStateId === "function_call"
  }

  async handle(transition: ExecutableTransition): Promise<ExecutableTransition> {
    if (transition.nextStateId !== "function_call" || this.state.gateDecision !== "blocked") {
      return transition
    }
    const functionCallTransition = transition as Extract<ExecutableTransition, { nextStateId: "function_call" }>
    const call = functionCallTransition.input.call
    this.state.record("interception.rewrite", "Safety Gate", `constrained ${call.name} until corroboration`)
    const safeCall = FunctionCallItem.rehydrate({
      callId: call.callId,
      name: "request_corroboration",
      args: JSON.stringify({ originalAction: call.name, reason: "confidence/causes conflict" }),
    })
    return { ...functionCallTransition, input: { ...functionCallTransition.input, call: safeCall } }
  }
}

function responderPrompt(role: Role, state: IncidentState): string {
  const roster = state.getParticipants().map((p) => {
    const manifest = p.getManifest()
    return `${manifest.name} [${manifest.capabilities?.join(", ") ?? "none"}]`
  }).join("; ")
  return [
    `You are ${ROLE_CONFIG[role].name}, the ${role} responder in IncidentMesh.`,
    `Incident: ${state.incident}. Other participants: ${roster}.`,
    "Publish one concise claim with confidence and the evidence you would verify next.",
    "React to peer claims; do not treat an unverified claim as fact. If proposing rollback, use the rollback_production tool so the Safety Gate can inspect it.",
  ].join(" ")
}

function modelAnswerText(payload: unknown): string {
  const candidate = payload as { answer?: { content?: { text?: unknown } } }
  return typeof candidate.answer?.content?.text === "string" ? candidate.answer.content.text : "model answer unavailable"
}

function responderHandlers(
  role: Role,
  state: IncidentState,
  dryRun: boolean,
  model: string,
  maxOutputTokens: number,
  runLoop: ReturnType<typeof defineRuntime<IncidentState>>["runLoop"],
  sendEvent: ReturnType<typeof defineRuntime<IncidentState>>["sendEvent"],
): SituationHandler[] {
  const config = ROLE_CONFIG[role]
  const opened: SituationHandler = {
    specification: isType(INCIDENT_OPENED),
    processor: {
      apply({ participant }) {
        if (state.spans.has(role)) return
        if (dryRun) {
          void (async () => {
            sendEvent(event(SPAN_STARTED, participant.getId(), { role, detail: `${role} started independent investigation` }), participant.getId())
            await sleep(config.delay)
            sendEvent(event(HYPOTHESIS_EMITTED, participant.getId(), {
              role, claim: config.claim, confidence: role === "impact" ? 0.88 : role === "trace" ? 0.72 : 0.61,
              rootCause: config.rootCause,
            }), participant.getId())
            await sleep(38)
            sendEvent(event(SPAN_COMPLETED, participant.getId(), { role, detail: "independent pass complete" }), participant.getId())
          })()
          return
        }
        if (!(participant instanceof Agent)) return
        sendEvent(event(SPAN_STARTED, participant.getId(), { role, detail: `${role} started model investigation` }), participant.getId())
        runLoop(participant.getId(), responderPrompt(role, state), {
          model,
          maxOutputTokens,
          tools: [rollbackTool],
          context: participant.getMemory().getContext(),
        }, new SafetyGateInterception(state))
      },
    },
  }

  const peerAwareness: SituationHandler = {
    specification: isPeerType(HYPOTHESIS_EMITTED),
    processor: {
      apply({ event: incoming }) {
        if (dryRun) {
          const payload = incoming.payload as EventPayload
          const sourceRole = typeof payload.role === "string" ? payload.role : "peer"
          state.record("awareness.peer-observed", config.name, `${config.name} observed ${sourceRole} while active`)
        }
      },
    },
  }

  const modelAnswer: SituationHandler = {
    specification: new (class extends SituationSpecification {
      isSatisfiedBy({ event, participant }: SituationContext): boolean {
        return event.type === "model.answer" && event.producerId === participant.getId()
      }
    })(),
    processor: {
      apply({ participant, event: answerEvent }) {
        if (dryRun) return
        const claim = modelAnswerText(answerEvent.payload)
        sendEvent(event(HYPOTHESIS_EMITTED, participant.getId(), {
          role, claim, confidence: 0.7, rootCause: "model-reported",
        }), participant.getId())
        sendEvent(event(SPAN_COMPLETED, participant.getId(), { role, detail: "model response complete" }), participant.getId())
      },
    },
  }

  const blockedAdaptation: SituationHandler = {
    specification: isPeerType(GATE_DECISION),
    processor: {
      apply({ participant, event: decisionEvent }) {
        const payload = decisionEvent.payload as EventPayload
        if (payload.decision !== "blocked" || role !== "impact" || state.followupRequested) return
        state.followupRequested = true
        void (async () => {
          await sleep(35)
          state.adaptations.push("Impact changed the plan after Safety Gate blocked an uncorroborated rollback.")
          sendEvent(event(MITIGATION_REPLANNED, participant.getId(), {
            role, action: "canary", reason: "gate blocked rollback", detail: "switched from rollback to a canary plus corroboration",
          }), participant.getId())
        })()
      },
    },
  }

  const canaryEvidence: SituationHandler = {
    specification: isPeerType(MITIGATION_REPLANNED),
    processor: {
      apply({ participant, event: planEvent }) {
        if (!dryRun || (role !== "trace" && role !== "dependency")) return
        void (async () => {
          await sleep(role === "trace" ? 24 : 42)
          const note = `${config.name} supplied corroboration for the canary plan`
          state.evidence.push(note)
          sendEvent(event(EVIDENCE_ADDED, participant.getId(), { role, note, planProducer: planEvent.producerId, detail: note }), participant.getId())
        })()
      },
    },
  }
  return [opened, peerAwareness, modelAnswer, blockedAdaptation, canaryEvidence]
}

function gateHandlers(state: IncidentState, sendEvent: (event: SemanticEvent, senderId: string) => void): SituationHandler[] {
  return [{
    specification: isPeerType(HYPOTHESIS_EMITTED),
    processor: {
      apply({ participant, event: hypothesisEvent }) {
        const payload = hypothesisEvent.payload as EventPayload
        const role = payload.role
        if (typeof role !== "string" || !ROLES.includes(role as Role)) return
        if (state.hypotheses.some((item) => item.role === role)) return
        const hypothesis: Hypothesis = {
          role: role as Role,
          claim: typeof payload.claim === "string" ? payload.claim : "unspecified claim",
          confidence: typeof payload.confidence === "number" ? payload.confidence : 0,
          rootCause: typeof payload.rootCause === "string" ? payload.rootCause : "unknown",
          atMs: Math.round(performance.now() - state.startedAt),
        }
        state.hypotheses.push(hypothesis)
        state.confidence = state.hypotheses.reduce((sum, item) => sum + item.confidence, 0) / state.hypotheses.length
        state.contradictions = new Set(state.hypotheses.map((item) => item.rootCause)).size - 1
        if (state.hypotheses.length < ROLES.length || state.gateDecision !== "pending") return
        state.gateDecision = state.confidence >= 0.8 && state.contradictions === 0 ? "approved" : "blocked"
        sendEvent(event(GATE_DECISION, participant.getId(), {
          decision: state.gateDecision, confidence: state.confidence, contradictions: state.contradictions,
          detail: `${state.gateDecision}: ${state.contradictions} conflicting causes; confidence ${state.confidence.toFixed(2)}`,
        }), participant.getId())
      },
    },
  }]
}

function observerHandlers(state: IncidentState): SituationHandler[] {
  return [{
    specification: new (class extends SituationSpecification {
      isSatisfiedBy({ event }: SituationContext): boolean {
        return event.type.startsWith("incident.")
      }
    })(),
    processor: {
      apply({ event }) {
        const payload = event.payload as EventPayload
        const detail = typeof payload.detail === "string" ? payload.detail
          : typeof payload.claim === "string" ? payload.claim
            : typeof payload.note === "string" ? payload.note
            : typeof payload.decision === "string" ? payload.decision
              : event.type
        state.record(event.type, event.producerId, detail)
        if (event.type === SPAN_STARTED && typeof payload.role === "string" && ROLES.includes(payload.role as Role)) {
          const role = payload.role as Role
          if (!state.spans.has(role)) state.spans.set(role, { role, startedAtMs: Math.round(performance.now() - state.startedAt) })
        }
        if (event.type === SPAN_COMPLETED && typeof payload.role === "string" && ROLES.includes(payload.role as Role)) {
          const span = state.spans.get(payload.role as Role)
          if (span) span.completedAtMs = Math.round(performance.now() - state.startedAt)
        }
      },
    },
  }]
}

export type ScenarioOptions = {
  dryRun?: boolean
  model?: string
  maxOutputTokens?: number
  trace?: (event: TimelineEvent) => void
}

export async function runIncidentScenario(options: ScenarioOptions = {}): Promise<IncidentReport> {
  const dryRun = options.dryRun ?? true
  const model = options.model ?? "gpt-5.5"
  const maxOutputTokens = options.maxOutputTokens ?? 350
  const { initializeRuntime, join, sendEvent, runLoop } = defineRuntime<IncidentState>()
  const state = new IncidentState()
  state.onTrace = options.trace
  initializeRuntime({ state })

  const observer = createHuman({ name: "Incident Console", capabilities: ["timeline"], handlers: observerHandlers(state) })
  const gate = createHuman({ name: "Safety Gate", capabilities: ["risk-control", "interception"], handlers: gateHandlers(state, sendEvent) })
  const responders = ROLES.map((role) => createAgent({
    name: ROLE_CONFIG[role].name,
    capabilities: [ROLE_CONFIG[role].capability, "concurrent-response"],
    instruction: `You are the ${role} responder. Work independently, publish evidence, and react to peer events.`,
    tools: [],
    handlers: responderHandlers(role, state, dryRun, model, maxOutputTokens, runLoop, sendEvent),
  }))
  const human = createHuman({ name: "Incident Commander", capabilities: ["incident-input"], handlers: [] })
  for (const participant of [observer, gate, ...responders, human]) join(participant)

  sendEvent(event(INCIDENT_OPENED, human.getId(), {
    incident: state.incident,
    summary: "Checkout failures are rising in us-east; investigate and choose a safe mitigation.",
  }), human.getId())
  await sleep(dryRun ? 650 : 1500)
  return state.toReport()
}

export function concurrencySpeedup(report: IncidentReport): number {
  const completed = report.spans.filter((span) => span.completedAtMs !== undefined)
  if (completed.length === 0) return 0
  const concurrentWall = Math.max(...completed.map((span) => span.completedAtMs ?? 0))
  const sequentialWall = completed.reduce((sum, span) => sum + ((span.completedAtMs ?? 0) - span.startedAtMs), 0)
  return concurrentWall > 0 ? Number((sequentialWall / concurrentWall).toFixed(2)) : 0
}

export function overlapCount(report: IncidentReport): number {
  let overlap = 0
  for (let i = 0; i < report.spans.length; i += 1) {
    for (let j = i + 1; j < report.spans.length; j += 1) {
      const a = report.spans[i]
      const b = report.spans[j]
      if ((a.completedAtMs ?? 0) > b.startedAtMs && (b.completedAtMs ?? 0) > a.startedAtMs) overlap += 1
    }
  }
  return overlap
}
