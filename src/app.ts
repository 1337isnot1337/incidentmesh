import {
  Agent,
  FunctionCallItem,
  ModelMessageItem,
  RuntimeState,
  SemanticEvent,
  SituationSpecification,
  createAgent,
  createHuman,
  defineRuntime,
} from "@mozaik-ai/core"
import type {
  ExecutableTransition,
  InferenceInput,
  InferenceOutput,
  InferenceRunner,
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
export const ACTION_PROPOSED = "incident.action.proposed"
export const ACTION_EXECUTION_REQUESTED = "incident.action.execution-requested"
export const SAFE_ACTION_EXECUTED = "incident.action.safe-executed"
export const RESPONDER_DEGRADED = "incident.responder.degraded"
export const MITIGATION_PHASE_STARTED = "incident.mitigation.phase-started"

export const ROLES = ["trace", "dependency", "impact"] as const
export type Role = (typeof ROLES)[number]
export type ScheduleMode = "concurrent" | "sequential"

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
  scheduleMode: ScheduleMode
  phase: "contained" | "investigating"
  gateDecision: "blocked" | "approved" | "pending"
  confidence: number
  contradictions: number
  hypotheses: Hypothesis[]
  evidence: string[]
  adaptations: string[]
  degradedRoles: Role[]
  action: {
    proposed: boolean
    requestedTool: "rollback_production" | null
    boundaryMs: number | null
    attemptedAtMs: number | null
    gateAtBoundary: "blocked" | "approved" | "pending" | null
    hypothesesAtBoundary: number
    contradictionsAtBoundary: number
    intercepted: boolean
    executedTool: "rollback_production" | "request_corroboration" | null
    mitigationPhaseStarted: boolean
    modelRecommendation: string | null
  }
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
  readonly degradedRoles: Role[] = []
  readonly spans = new Map<Role, Span>()
  readonly timeline: TimelineEvent[] = []
  scheduleMode: ScheduleMode = "concurrent"
  gateDecision: IncidentReport["gateDecision"] = "pending"
  confidence = 0
  contradictions = 0
  followupRequested = false
  actionProposed = false
  actionAttemptStarted = false
  actionBoundaryMs: number | null = 205
  requestedActionTool: "rollback_production" | null = null
  actionAttemptedAtMs: number | null = null
  gateAtActionBoundary: IncidentReport["gateDecision"] | null = null
  hypothesesAtActionBoundary = 0
  contradictionsAtActionBoundary = 0
  actionIntercepted = false
  actionExecutedTool: "rollback_production" | "request_corroboration" | null = null
  mitigationPhaseStarted = false
  modelMitigationRecommendation: string | null = null
  onTrace?: (event: TimelineEvent) => void
  private readonly changeListeners = new Set<() => void>()

  private notifyChange(): void {
    for (const listener of this.changeListeners) listener()
  }

  async waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
    if (predicate()) return true
    return await new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const finish = (result: boolean) => {
        if (timer !== undefined) clearTimeout(timer)
        this.changeListeners.delete(check)
        resolve(result)
      }
      const check = () => {
        if (predicate()) finish(true)
      }
      this.changeListeners.add(check)
      timer = setTimeout(() => finish(false), timeoutMs)
      check()
    })
  }

  record(type: string, producer: string, detail: string): void {
    const participant = this.getParticipant(producer)
    const label = participant?.getManifest().name ?? producer
    const event = { atMs: Math.round(performance.now() - this.startedAt), type, producer: label, detail }
    this.timeline.push(event)
    this.onTrace?.(event)
    this.notifyChange()
  }

  toReport(): IncidentReport {
    const spans = [...this.spans.values()].map((span) => ({ ...span })).sort((a, b) => a.startedAtMs - b.startedAtMs)
    return {
      schema: "incidentmesh.report/v1",
      incident: this.incident,
      scheduleMode: this.scheduleMode,
      phase: this.gateDecision === "blocked" ? "contained" : "investigating",
      gateDecision: this.gateDecision,
      confidence: Number(this.confidence.toFixed(2)),
      contradictions: this.contradictions,
      hypotheses: this.hypotheses.map((hypothesis) => ({ ...hypothesis })),
      evidence: [...this.evidence],
      adaptations: [...this.adaptations],
      degradedRoles: [...this.degradedRoles],
      action: {
        proposed: this.actionProposed,
        requestedTool: this.requestedActionTool,
        boundaryMs: this.actionBoundaryMs,
        attemptedAtMs: this.actionAttemptedAtMs,
        gateAtBoundary: this.gateAtActionBoundary,
        hypothesesAtBoundary: this.hypothesesAtActionBoundary,
        contradictionsAtBoundary: this.contradictionsAtActionBoundary,
        intercepted: this.actionIntercepted,
        executedTool: this.actionExecutedTool,
        mitigationPhaseStarted: this.mitigationPhaseStarted,
        modelRecommendation: this.modelMitigationRecommendation,
      },
      spans,
      timeline: this.timeline.map((item) => ({ ...item })),
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

type RollbackArgs = { service: string; reason: string }

function createRollbackTool(onInvoke?: (args: RollbackArgs) => void): Tool {
  return {
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
    invoke: async (args: RollbackArgs) => {
      onInvoke?.(args)
      return {
        status: "proposal-only",
        service: args.service,
        reason: args.reason,
      }
    },
  }
}

const rollbackTool: Tool = createRollbackTool()

type CorroborationArgs = { originalAction: string; reason: string }

export function createRequestCorroborationTool(onInvoke?: (args: CorroborationArgs) => void): Tool {
  return {
    type: "function",
    name: "request_corroboration",
    description: "Record that a proposed production action needs corroboration before it can proceed.",
    parameters: {
      type: "object",
      properties: { originalAction: { type: "string" }, reason: { type: "string" } },
      required: ["originalAction", "reason"],
      additionalProperties: false,
    },
    strict: true,
    invoke: async (args: CorroborationArgs) => {
      onInvoke?.(args)
      return {
        status: "blocked-pending-corroboration",
        originalAction: args.originalAction,
        reason: args.reason,
      }
    },
  }
}

export const requestCorroborationTool: Tool = createRequestCorroborationTool()

const responderTools: Tool[] = [rollbackTool, requestCorroborationTool]

export class SafetyGateInterception implements InterceptionHandler {
  constructor(private readonly state: IncidentState) {}

  isSatisfiedBy(transition: ExecutableTransition): boolean {
    return this.state.gateDecision === "blocked"
      && transition.nextStateId === "function_call"
      && transition.input.call.name === "rollback_production"
  }

  async handle(transition: ExecutableTransition): Promise<ExecutableTransition> {
    if (!this.isSatisfiedBy(transition) || transition.nextStateId !== "function_call") {
      return transition
    }
    const functionCallTransition = transition as Extract<ExecutableTransition, { nextStateId: "function_call" }>
    const call = functionCallTransition.input.call
    this.state.actionIntercepted = true
    this.state.record("mozaik.interception.rewritten", "Safety Gate", `rewrote ${call.name} -> request_corroboration`)
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
    "Return one concise incident hypothesis with a claim, confidence from 0 to 1, and a short root-cause slug.",
    "Do not treat an unverified peer claim as fact. If proposing rollback, use the rollback_production tool so the Safety Gate can inspect it.",
  ].join(" ")
}

function modelAnswerText(payload: unknown): string {
  const candidate = payload as { answer?: { content?: { text?: unknown } } }
  return typeof candidate.answer?.content?.text === "string" ? candidate.answer.content.text : "model answer unavailable"
}

type ModelHypothesis = Pick<Hypothesis, "claim" | "confidence" | "rootCause">

export function parseModelHypothesis(payload: unknown, role: Role): ModelHypothesis {
  const text = modelAnswerText(payload)
  try {
    const parsed = JSON.parse(text) as { claim?: unknown; confidence?: unknown; rootCause?: unknown }
    if (typeof parsed.claim === "string" && typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      && typeof parsed.rootCause === "string") {
      return {
        claim: parsed.claim,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        rootCause: parsed.rootCause,
      }
    }
  } catch {
    // Keep provider mode observable even if a custom model ignores the structured-output contract.
  }
  return { claim: text, confidence: 0.5, rootCause: `model-unparsed-${role}` }
}

const MODEL_HYPOTHESIS_OUTPUT = {
  name: "incident_hypothesis",
  schema: {
    type: "object",
    properties: {
      claim: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      rootCause: { type: "string" },
    },
    required: ["claim", "confidence", "rootCause"],
    additionalProperties: false,
  },
  strict: true,
} as const


const RESPONDER_TAIL_MS = 38

function responderStartOffset(role: Role, scheduleMode: ScheduleMode): number {
  if (scheduleMode === "concurrent" || role === "trace") return 0
  const traceDuration = ROLE_CONFIG.trace.delay + RESPONDER_TAIL_MS
  if (role === "dependency") return traceDuration
  return traceDuration + ROLE_CONFIG.dependency.delay + RESPONDER_TAIL_MS
}

class DeterministicActionInferenceRunner implements InferenceRunner {
  async run(request: InferenceInput): Promise<InferenceOutput> {
    const hasToolOutput = request.context.getItems().some((item) => item.type === "function_call_output")
    if (!hasToolOutput) {
      return {
        items: [FunctionCallItem.rehydrate({
          callId: "incidentmesh-deterministic-rollback",
          name: "rollback_production",
          args: JSON.stringify({ service: "checkout-api", reason: "restore service before action deadline" }),
        })],
        tokenUsage: undefined,
        rowResponse: { fixture: "rollback_proposal" },
      }
    }
    return {
      items: [ModelMessageItem.rehydrate({ text: "Action boundary resolved through safety control." })],
      tokenUsage: undefined,
      rowResponse: { fixture: "action_complete" },
    }
  }

  async *stream(request: InferenceInput): AsyncGenerator<SemanticEvent> {
    yield SemanticEvent.create("inference.output", "deterministic-action-runner", await this.run(request))
  }
}

function responderHandlers(
  role: Role,
  state: IncidentState,
  dryRun: boolean,
  scheduleMode: ScheduleMode,
  simulateDependencyTimeout: boolean,
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
            const startOffset = responderStartOffset(role, scheduleMode)
            if (startOffset > 0) await sleep(startOffset)
            sendEvent(event(SPAN_STARTED, participant.getId(), { role, detail: `${role} started ${scheduleMode} investigation` }), participant.getId())
            await sleep(config.delay)
            if (simulateDependencyTimeout && role === "dependency") {
              sendEvent(event(RESPONDER_DEGRADED, participant.getId(), {
                role, reason: "timeout", detail: "Dependency timed out before publishing a hypothesis",
              }), participant.getId())
              sendEvent(event(SPAN_COMPLETED, participant.getId(), { role, detail: "investigation ended without evidence: timeout" }), participant.getId())
              return
            }
            sendEvent(event(HYPOTHESIS_EMITTED, participant.getId(), {
              role, claim: config.claim, confidence: role === "impact" ? 0.88 : role === "trace" ? 0.85 : 0.82,
              rootCause: config.rootCause,
            }), participant.getId())
            await sleep(RESPONDER_TAIL_MS)
            sendEvent(event(SPAN_COMPLETED, participant.getId(), { role, detail: "independent pass complete" }), participant.getId())
          })()
          return
        }
        if (!(participant instanceof Agent)) return
        sendEvent(event(SPAN_STARTED, participant.getId(), { role, detail: `${role} started model investigation` }), participant.getId())
        runLoop(participant.getId(), responderPrompt(role, state), {
          model,
          maxOutputTokens,
          tools: participant.getTools(),
          structuredOutput: MODEL_HYPOTHESIS_OUTPUT,
          context: participant.getMemory().getContext(),
        }, new SafetyGateInterception(state))
      },
    },
  }

  const peerAwareness: SituationHandler = {
    specification: isPeerType(HYPOTHESIS_EMITTED),
    processor: {
      apply({ event: incoming }) {
        const payload = incoming.payload as EventPayload
        const sourceRole = typeof payload.role === "string" ? payload.role : "peer"
        state.record("awareness.peer-observed", config.name, `${config.name} observed ${sourceRole} hypothesis`)
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
        const hypothesis = parseModelHypothesis(answerEvent.payload, role)
        sendEvent(event(HYPOTHESIS_EMITTED, participant.getId(), {
          role, ...hypothesis,
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
        if (!dryRun || payload.decision !== "blocked" || role !== "impact" || state.followupRequested) return
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
        if (!dryRun || (role !== "trace" && role !== "dependency") || (simulateDependencyTimeout && role === "dependency")) return
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

function mitigationPrompt(state: IncidentState): string {
  const evidence = state.hypotheses
    .map((item) => `- ${item.role}: confidence=${item.confidence.toFixed(2)} rootCause=${item.rootCause} claim=${item.claim}`)
    .join("\n")
  return [
    "You are the mitigation owner in IncidentMesh. Phase 1 is complete.",
    `Incident: ${state.incident}.`,
    `Safety Gate: ${state.gateDecision}; aggregate confidence=${state.confidence.toFixed(2)}; contradictions=${state.contradictions}.`,
    "Shared evidence from independent responders:",
    evidence,
    "Choose the next mitigation using this shared evidence. If you choose a production rollback, call rollback_production; the Safety Gate will inspect that tool transition. If corroboration is required, account for the tool result and then give a concise final recommendation. Do not claim that Phase-1 responder models saw one another's evidence.",
  ].join("\n")
}

function actionHandlers(
  state: IncidentState,
  dryRun: boolean,
  actionProposalMs: number,
  actionBoundaryMs: number,
  model: string,
  maxOutputTokens: number,
  runLoop: ReturnType<typeof defineRuntime<IncidentState>>["runLoop"],
  sendEvent: ReturnType<typeof defineRuntime<IncidentState>>["sendEvent"],
): SituationHandler[] {
  const deterministicBoundary: SituationHandler = {
    specification: isType(INCIDENT_OPENED),
    processor: {
      apply({ participant }) {
        if (!dryRun || state.actionProposed) return
        if (!(participant instanceof Agent)) return
        void (async () => {
          await sleep(actionProposalMs)
          state.actionProposed = true
          state.requestedActionTool = "rollback_production"
          sendEvent(event(ACTION_PROPOSED, participant.getId(), {
            action: "rollback_production",
            service: "checkout-api",
            boundaryMs: actionBoundaryMs,
            detail: `rollback_production is pending; fixed action boundary is ${actionBoundaryMs}ms`,
          }), participant.getId())

          await sleep(actionBoundaryMs - actionProposalMs)
          if (state.actionAttemptStarted) return
          state.actionAttemptStarted = true
          state.actionAttemptedAtMs = Math.round(performance.now() - state.startedAt)
          state.hypothesesAtActionBoundary = state.hypotheses.length
          state.contradictionsAtActionBoundary = state.contradictions
          sendEvent(event(ACTION_EXECUTION_REQUESTED, participant.getId(), {
            action: "rollback_production",
            hypotheses: state.hypotheses.length,
            contradictions: state.contradictions,
            detail: `action boundary reached with hypotheses=${state.hypotheses.length}, contradictions=${state.contradictions}`,
          }), participant.getId())
          state.gateAtActionBoundary = state.gateDecision
          runLoop(participant.getId(), "Execute the pending rollback proposal at the fixed action boundary.", {
            model: "incidentmesh-deterministic-action",
            tools: participant.getTools(),
            context: participant.getMemory().getContext(),
          }, new SafetyGateInterception(state))
        })()
      },
    },
  }

  const providerMitigationPhase: SituationHandler = {
    specification: isPeerType(GATE_DECISION),
    processor: {
      apply({ participant }) {
        if (dryRun || state.mitigationPhaseStarted || !(participant instanceof Agent)) return
        state.mitigationPhaseStarted = true
        state.actionBoundaryMs = null
        sendEvent(event(MITIGATION_PHASE_STARTED, participant.getId(), {
          gateDecision: state.gateDecision,
          hypotheses: state.hypotheses.length,
          detail: `Phase 2 mitigation loop started with ${state.hypotheses.length} shared hypotheses and gate=${state.gateDecision}`,
        }), participant.getId())
        runLoop(participant.getId(), mitigationPrompt(state), {
          model,
          maxOutputTokens,
          tools: participant.getTools(),
          context: participant.getMemory().getContext(),
        }, new SafetyGateInterception(state))
      },
    },
  }

  const providerRecommendation: SituationHandler = {
    specification: new (class extends SituationSpecification {
      isSatisfiedBy({ event, participant }: SituationContext): boolean {
        return event.type === "model.answer" && event.producerId === participant.getId()
      }
    })(),
    processor: {
      apply({ participant, event: answerEvent }) {
        if (dryRun || !state.mitigationPhaseStarted || state.modelMitigationRecommendation !== null) return
        const recommendation = modelAnswerText(answerEvent.payload)
        state.modelMitigationRecommendation = recommendation
        state.adaptations.push(`Action Controller model recommendation: ${recommendation}`)
        sendEvent(event(MITIGATION_REPLANNED, participant.getId(), {
          role: "action-controller",
          source: "model.answer",
          detail: recommendation,
        }), participant.getId())
      },
    },
  }

  return [deterministicBoundary, providerMitigationPhase, providerRecommendation]
}

function gateDecisionForCurrentEvidence(state: IncidentState): "blocked" | "approved" {
  if (state.degradedRoles.length > 0) return "blocked"
  return state.hypotheses.length > 0 && state.confidence >= 0.8 && state.contradictions === 0 ? "approved" : "blocked"
}

function emitGateDecision(
  state: IncidentState,
  participantId: string,
  sendEvent: (event: SemanticEvent, senderId: string) => void,
  reason: "action-boundary" | "late-evidence" | "evidence-aggregation",
): void {
  const nextDecision = gateDecisionForCurrentEvidence(state)
  const changed = state.gateDecision !== nextDecision
  state.gateDecision = nextDecision
  if (!changed && reason === "late-evidence") return
  sendEvent(event(GATE_DECISION, participantId, {
    decision: state.gateDecision,
    confidence: state.confidence,
    contradictions: state.contradictions,
    hypotheses: state.hypotheses.length,
    reason,
    detail: `${state.gateDecision}: ${state.contradictions} contradictions across ${state.hypotheses.length} root-cause hypotheses; confidence ${state.confidence.toFixed(2)} (${reason})`,
  }), participantId)
}

function gateHandlers(state: IncidentState, dryRun: boolean, sendEvent: (event: SemanticEvent, senderId: string) => void): SituationHandler[] {
  const collectHypothesis: SituationHandler = {
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
        if (!dryRun && state.hypotheses.length === ROLES.length && state.gateDecision === "pending") {
          emitGateDecision(state, participant.getId(), sendEvent, "evidence-aggregation")
          return
        }
        if (state.actionAttemptStarted) emitGateDecision(state, participant.getId(), sendEvent, "late-evidence")
      },
    },
  }

  const recordDegradation: SituationHandler = {
    specification: isPeerType(RESPONDER_DEGRADED),
    processor: {
      apply({ event: degradedEvent }) {
        const payload = degradedEvent.payload as EventPayload
        const role = payload.role
        if (typeof role === "string" && ROLES.includes(role as Role) && !state.degradedRoles.includes(role as Role)) {
          state.degradedRoles.push(role as Role)
        }
      },
    },
  }

  const decideAtActionBoundary: SituationHandler = {
    specification: isPeerType(ACTION_EXECUTION_REQUESTED),
    processor: {
      apply({ participant }) {
        emitGateDecision(state, participant.getId(), sendEvent, "action-boundary")
      },
    },
  }

  return [collectHypothesis, recordDegradation, decideAtActionBoundary]
}

function frameworkObserverHandlers(state: IncidentState): SituationHandler[] {
  const frameworkTypes = new Set(["interception.started", "interception.finished", "function_call.started", "function_call.completed"])
  return [{
    specification: new (class extends SituationSpecification {
      isSatisfiedBy({ event }: SituationContext): boolean {
        return frameworkTypes.has(event.type)
      }
    })(),
    processor: {
      apply({ event: frameworkEvent }) {
        const payload = frameworkEvent.payload as EventPayload
        if (frameworkEvent.type === "interception.started") {
          const input = payload.input as { call?: { name?: string } } | undefined
          const callName = input?.call?.name
          if (callName === "rollback_production") {
            state.actionProposed = true
            state.requestedActionTool = "rollback_production"
            if (!state.actionAttemptStarted) {
              state.actionAttemptStarted = true
              state.actionAttemptedAtMs = Math.round(performance.now() - state.startedAt)
              state.gateAtActionBoundary = state.gateDecision
              state.hypothesesAtActionBoundary = state.hypotheses.length
              state.contradictionsAtActionBoundary = state.contradictions
            }
          }
          state.record("mozaik.interception.started", frameworkEvent.producerId, `InterceptionHandler received ${callName ?? "function call"}`)
          return
        }
        if (frameworkEvent.type === "interception.finished") {
          const input = payload.input as { call?: { name?: string } } | undefined
          state.record("mozaik.interception.finished", frameworkEvent.producerId, `InterceptionHandler returned ${input?.call?.name ?? "rewritten call"}`)
          return
        }
        if (frameworkEvent.type === "function_call.started") {
          const call = payload.call as { name?: string } | undefined
          if (call?.name === "rollback_production") {
            state.actionProposed = true
            state.requestedActionTool = "rollback_production"
            if (!state.actionAttemptStarted) {
              state.actionAttemptStarted = true
              state.actionAttemptedAtMs = Math.round(performance.now() - state.startedAt)
              state.gateAtActionBoundary = state.gateDecision
              state.hypothesesAtActionBoundary = state.hypotheses.length
              state.contradictionsAtActionBoundary = state.contradictions
            }
          }
          state.record("mozaik.function-call.started", frameworkEvent.producerId, `Mozaik executing ${call?.name ?? "tool"}`)
          return
        }
        state.record("mozaik.function-call.completed", frameworkEvent.producerId, "Mozaik function tool completed")
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
  timeoutMs?: number
  scheduleMode?: ScheduleMode
  actionProposalMs?: number
  actionBoundaryMs?: number
  simulateDependencyTimeout?: boolean
  inferenceRunner?: InferenceRunner
  trace?: (event: TimelineEvent) => void
}

export async function runIncidentScenario(options: ScenarioOptions = {}): Promise<IncidentReport> {
  const dryRun = options.dryRun ?? true
  const model = options.model ?? "gpt-5.5"
  const maxOutputTokens = options.maxOutputTokens ?? 350
  const scheduleMode = options.scheduleMode ?? "concurrent"
  const actionProposalMs = options.actionProposalMs ?? 45
  const actionBoundaryMs = options.actionBoundaryMs ?? 205
  const simulateDependencyTimeout = options.simulateDependencyTimeout ?? false
  if (actionProposalMs < 0 || actionBoundaryMs <= actionProposalMs) {
    throw new Error("actionBoundaryMs must be greater than actionProposalMs >= 0")
  }
  const { initializeRuntime, join, sendEvent, runLoop } = defineRuntime<IncidentState>()
  const state = new IncidentState()
  state.scheduleMode = scheduleMode
  state.actionBoundaryMs = actionBoundaryMs
  state.onTrace = options.trace
  const inferenceRunner = options.inferenceRunner ?? (dryRun ? new DeterministicActionInferenceRunner() : undefined)
  initializeRuntime(inferenceRunner
    ? { state, inferenceRunnerConfig: { runner: inferenceRunner } }
    : { state })

  const observer = createHuman({
    name: "Incident Console",
    capabilities: ["timeline"],
    handlers: [...observerHandlers(state), ...frameworkObserverHandlers(state)],
  })
  const gate = createHuman({ name: "Safety Gate", capabilities: ["risk-control", "interception"], handlers: gateHandlers(state, dryRun, sendEvent) })
  const responders = ROLES.map((role) => createAgent({
    name: ROLE_CONFIG[role].name,
    capabilities: [ROLE_CONFIG[role].capability, "concurrent-response"],
    instruction: `You are the ${role} responder. Work independently, publish evidence, and react to peer events.`,
    tools: responderTools,
    handlers: responderHandlers(role, state, dryRun, scheduleMode, simulateDependencyTimeout, model, maxOutputTokens, runLoop, sendEvent),
  }))
  let actionController!: Agent
  const actionTools: Tool[] = [
    createRollbackTool(() => {
      state.actionExecutedTool = "rollback_production"
      sendEvent(event("incident.action.rollback-tool-executed", actionController.getId(), {
        action: "rollback_production",
        detail: "rollback_production tool crossed the action boundary without interception (proposal-only fixture)",
      }), actionController.getId())
    }),
    createRequestCorroborationTool((args) => {
      state.actionExecutedTool = "request_corroboration"
      sendEvent(event(SAFE_ACTION_EXECUTED, actionController.getId(), {
        action: "request_corroboration",
        originalAction: args.originalAction,
        detail: `safe tool executed for blocked ${args.originalAction}`,
      }), actionController.getId())
    }),
  ]
  actionController = createAgent({
    name: "Action Controller",
    capabilities: ["production-change", "action-boundary"],
    instruction: "Execute proposed incident mitigations only through the Safety Gate.",
    tools: actionTools,
    handlers: actionHandlers(state, dryRun, actionProposalMs, actionBoundaryMs, model, maxOutputTokens, runLoop, sendEvent),
  })
  const human = createHuman({ name: "Incident Commander", capabilities: ["incident-input"], handlers: [] })
  for (const participant of [observer, gate, ...responders, actionController, human]) join(participant)

  sendEvent(event(INCIDENT_OPENED, human.getId(), {
    incident: state.incident,
    summary: "Checkout failures are rising in us-east; investigate and choose a safe mitigation.",
  }), human.getId())

  const timeoutMs = options.timeoutMs ?? (dryRun ? 2_000 : 30_000)
  const settled = await state.waitFor(() => {
    const respondersComplete = ROLES.every((role) => state.spans.get(role)?.completedAtMs !== undefined)
    if (!respondersComplete || state.gateDecision === "pending") return false
    if (dryRun && state.gateDecision === "blocked" && state.adaptations.length === 0) return false
    const expectedFollowupEvidence = simulateDependencyTimeout ? 1 : 2
    if (dryRun && state.gateDecision === "blocked" && state.evidence.length < expectedFollowupEvidence) return false
    if (dryRun && (!state.actionProposed || state.actionExecutedTool === null)) return false
    if (!dryRun && (!state.mitigationPhaseStarted || state.modelMitigationRecommendation === null)) return false
    return true
  }, timeoutMs)
  if (!settled) {
    state.record("incident.scenario.timeout", "Incident Console", `scenario did not settle within ${timeoutMs}ms`)
  }
  return state.toReport()
}

export function concurrencySpeedup(report: IncidentReport): number {
  const completed = report.spans.filter((span) => span.completedAtMs !== undefined)
  if (completed.length === 0) return 0
  const concurrentStart = Math.min(...completed.map((span) => span.startedAtMs))
  const concurrentEnd = Math.max(...completed.map((span) => span.completedAtMs ?? span.startedAtMs))
  const concurrentWall = concurrentEnd - concurrentStart
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
