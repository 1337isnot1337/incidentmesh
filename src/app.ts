import {
  Agent,
  FunctionCallItem,
  ModelMessageItem,
  RuntimeState,
  SemanticEvent,
  supportedModels,
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
export const HYPOTHESIS_REJECTED = "incident.hypothesis.rejected"
export const SPAN_COMPLETED = "incident.span.completed"
export const GATE_DECISION = "incident.gate.decision"
export const MITIGATION_REPLANNED = "incident.mitigation.replanned"
export const EVIDENCE_ADDED = "incident.evidence.added"
export const ACTION_PROPOSED = "incident.action.proposed"
export const ACTION_EXECUTION_REQUESTED = "incident.action.execution-requested"
export const SAFE_ACTION_EXECUTED = "incident.action.safe-executed"
export const RESPONDER_DEGRADED = "incident.responder.degraded"
export const MITIGATION_PHASE_STARTED = "incident.mitigation.phase-started"
export const DECISION_REVISION_ADVANCED = "incident.decision.revision-advanced"
export const PLAN_STARTED = "incident.plan.started"
export const PLAN_PROPOSED = "incident.plan.proposed"
export const PLAN_STALE = "incident.plan.stale"
export const PLAN_REPLAN_REQUESTED = "incident.plan.replan-requested"
export const PLAN_REPLANNED = "incident.plan.replanned"
export const ACTION_ATTEMPT_SNAPSHOTTED = "incident.action.attempt-snapshotted"

export const ROLES = ["trace", "dependency", "impact"] as const
export type Role = (typeof ROLES)[number]
export type ScheduleMode = "concurrent" | "sequential"
export type PlanningMode = "post-aggregation" | "speculative-bounded"
export type GateDecision = "blocked" | "approved" | "pending"
export type ActionName = "request_corroboration" | "targeted_canary_probe" | "rollback_production"
export type ActionRisk = "safe" | "bounded" | "destructive"
export type GateReason =
  | "pending-required-evidence"
  | "incomplete-required-evidence"
  | "conflicting-evidence"
  | "low-confidence-evidence"
  | "degraded-required-responder"
  | "sufficient-consistent-evidence"
export type BoundarySafeAction =
  | "rollback-approved"
  | "canary-with-targeted-corroboration"
  | "hold-for-missing-evidence"
  | "request-broader-corroboration"
export type GateEvaluation = {
  decision: GateDecision
  reason: GateReason
  confidence: number
  contradictions: number
  availableRoles: Role[]
  missingRequiredRoles: Role[]
}
export type PlanContext = Readonly<{
  planId: string
  producerId: string
  basedOnRevision: number
  availableRoles: readonly Role[]
  hypotheses: readonly Readonly<Pick<Hypothesis, "role" | "claim" | "confidence" | "rootCause">>[]
  startedAtMs: number
}>
export type ActionPolicyReason =
  | GateReason
  | "safe-action"
  | "fresh-bounded-evidence"
  | "stale-plan"
  | "invalid-plan-provenance"
  | "insufficient-bounded-evidence"
  | "bounded-target-mismatch"
  | "degraded-evidence"
export type ActionAttemptSnapshot = Readonly<{
  attemptId: string
  planId: string
  actionProducerId: string
  basedOnRevision: number
  boundaryRevision: number
  fresh: boolean
  atMs: number
  investigationDecision: GateDecision
  investigationReason: GateReason
  gateDecision: Exclude<GateDecision, "pending">
  gateReason: Exclude<GateReason, "pending-required-evidence">
  policyDecision: Exclude<GateDecision, "pending">
  policyReason: ActionPolicyReason
  // Backward-compatible aliases used by the existing report/evidence tooling.
  decision: Exclude<GateDecision, "pending">
  reason: ActionPolicyReason
  availableRoles: readonly Role[]
  missingRequiredRoles: readonly Role[]
  degradedRoles: readonly Role[]
  confidence: number
  perRoleConfidence: Readonly<Record<Role, number | null>>
  contradictions: number
  proposedAction: ActionName
  actionRisk: ActionRisk
  targetCause: string | null
}>
export type ActionBoundarySnapshot = ActionAttemptSnapshot
export type HypothesisAcceptanceStatus =
  | "accepted"
  | "late-accepted"
  | "duplicate"
  | "spoofed-role"
  | "unknown-role"
  | "malformed"
  | "closed-role"

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
  gateDecision: GateDecision
  gateReason: GateReason
  confidence: number
  contradictions: number
  hypotheses: Hypothesis[]
  evidence: string[]
  adaptations: string[]
  degradedRoles: Role[]
  action: {
    proposed: boolean
    requestedTool: ActionName | null
    boundaryMs: number | null
    attemptedAtMs: number | null
    gateAtBoundary: GateDecision | null
    gateReasonAtBoundary: GateReason | null
    hypothesesAtBoundary: number
    contradictionsAtBoundary: number
    boundarySnapshot: ActionBoundarySnapshot | null
    plans: PlanContext[]
    attempts: ActionAttemptSnapshot[]
    decisionRevision: number
    boundarySafeAction: BoundarySafeAction | null
    actionableSafePlan: "canary-with-targeted-corroboration" | null
    actionableSafePlanAtMs: number | null
    intercepted: boolean
    executedTool: ActionName | null
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
  gateDecision: GateDecision = "pending"
  gateReason: GateReason = "pending-required-evidence"
  confidence = 0
  contradictions = 0
  followupRequested = false
  holdPlanRecorded = false
  private readonly responderIds = new Map<Role, string>()
  private safetyGateId: string | null = null
  private actionControllerId: string | null = null
  private planSequence = 0
  private attemptSequence = 0
  private activePlanId: string | null = null
  private readonly planContexts: PlanContext[] = []
  private readonly attemptSnapshots: ActionAttemptSnapshot[] = []
  decisionRevision = 0
  actionProposed = false
  actionAttemptStarted = false
  actionBoundaryMs: number | null = 205
  requestedActionTool: ActionName | null = null
  actionAttemptedAtMs: number | null = null
  gateAtActionBoundary: GateDecision | null = null
  gateReasonAtActionBoundary: GateReason | null = null
  hypothesesAtActionBoundary = 0
  contradictionsAtActionBoundary = 0
  actionBoundarySnapshot: ActionBoundarySnapshot | null = null
  boundarySafeAction: BoundarySafeAction | null = null
  actionableSafePlan: "canary-with-targeted-corroboration" | null = null
  actionableSafePlanAtMs: number | null = null
  actionIntercepted = false
  actionExecutedTool: ActionName | null = null
  mitigationPhaseStarted = false
  staleReplanRequired = false
  freshReplanStarted = false
  modelMitigationRecommendation: string | null = null
  onTrace?: (event: TimelineEvent) => void
  private readonly changeListeners = new Set<() => void>()

  private notifyChange(): void {
    for (const listener of this.changeListeners) listener()
  }

  registerResponder(role: Role, participantId: string): void {
    this.responderIds.set(role, participantId)
  }

  isResponderProducer(role: Role, participantId: string): boolean {
    return this.responderIds.get(role) === participantId
  }

  registerSafetyGate(participantId: string): void {
    this.safetyGateId = participantId
  }

  isSafetyGateProducer(participantId: string): boolean {
    return this.safetyGateId === participantId
  }

  registerActionController(participantId: string): void {
    this.actionControllerId = participantId
  }

  isActionControllerProducer(participantId: string): boolean {
    return this.actionControllerId === participantId
  }

  private advanceDecisionRevision(cause: string, producerId: string): void {
    const previous = this.decisionRevision
    this.decisionRevision += 1
    this.record(
      DECISION_REVISION_ADVANCED,
      producerId,
      `decision revision ${previous} -> ${this.decisionRevision}: ${cause}`,
    )
  }

  markDegraded(role: Role, producerId = this.responderIds.get(role) ?? "Safety Gate"): boolean {
    const registeredResponder = this.responderIds.get(role)
    const internallyAuthorized = producerId === registeredResponder || producerId === this.safetyGateId || producerId === "Safety Gate"
    if (!internallyAuthorized) return false
    if (this.degradedRoles.includes(role)) return false
    this.degradedRoles.push(role)
    this.advanceDecisionRevision(`${role} closed/degraded`, producerId)
    this.notifyChange()
    return true
  }

  private recalculateAggregate(): void {
    if (this.hypotheses.length === 0) {
      this.confidence = 0
      this.contradictions = 0
      return
    }
    this.confidence = this.hypotheses.reduce((sum, item) => sum + item.confidence, 0) / this.hypotheses.length
    this.contradictions = new Set(this.hypotheses.map((item) => item.rootCause)).size - 1
  }

  acceptHypothesis(producerId: string, payload: EventPayload): { status: HypothesisAcceptanceStatus; role?: Role } {
    const rawRole = payload.role
    if (typeof rawRole !== "string" || !ROLES.includes(rawRole as Role)) return { status: "unknown-role" }
    const role = rawRole as Role
    if (!this.isResponderProducer(role, producerId)) return { status: "spoofed-role", role }
    if (this.hypotheses.some((item) => item.role === role)) return { status: "duplicate", role }
    // Once a required responder is degraded/closed for this action phase, a delayed
    // completion may be observed but cannot improve the authoritative gate state.
    if (this.degradedRoles.includes(role)) return { status: "closed-role", role }

    const confidence = payload.confidence
    const claim = payload.claim
    const rootCause = payload.rootCause
    if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1
      || typeof claim !== "string" || claim.trim().length === 0
      || typeof rootCause !== "string" || rootCause.trim().length === 0) {
      this.markDegraded(role)
      return { status: "malformed", role }
    }

    this.hypotheses.push({
      role,
      claim: claim.trim(),
      confidence,
      rootCause: rootCause.trim(),
      atMs: Math.round(performance.now() - this.startedAt),
    })
    this.recalculateAggregate()
    this.advanceDecisionRevision(`${role} hypothesis accepted`, producerId)
    this.notifyChange()
    return { status: this.actionBoundarySnapshot === null ? "accepted" : "late-accepted", role }
  }

  startPlan(producerId: string, planId = `plan-${++this.planSequence}`): PlanContext | null {
    if (!this.isActionControllerProducer(producerId)) {
      this.record(PLAN_STARTED, producerId, `rejected plan ${planId}: invalid Action Controller provenance`)
      return null
    }
    if (this.planContexts.some((plan) => plan.planId === planId)) return null
    const hypotheses = this.hypotheses.map((item) => Object.freeze({
      role: item.role,
      claim: item.claim,
      confidence: item.confidence,
      rootCause: item.rootCause,
    }))
    const plan: PlanContext = Object.freeze({
      planId,
      producerId,
      basedOnRevision: this.decisionRevision,
      availableRoles: Object.freeze(hypotheses.map((item) => item.role)),
      hypotheses: Object.freeze(hypotheses),
      startedAtMs: Math.round(performance.now() - this.startedAt),
    })
    this.planContexts.push(plan)
    this.activePlanId = plan.planId
    this.record(
      PLAN_STARTED,
      producerId,
      `${plan.planId} started at revision ${plan.basedOnRevision} with roles=${plan.availableRoles.join(",") || "none"}`,
    )
    return plan
  }

  getPlan(planId: string): PlanContext | null {
    return this.planContexts.find((plan) => plan.planId === planId) ?? null
  }

  get actionAttempts(): readonly ActionAttemptSnapshot[] {
    return this.attemptSnapshots
  }

  getActivePlan(): PlanContext | null {
    return this.activePlanId === null ? null : this.getPlan(this.activePlanId)
  }

  private riskFor(action: ActionName): ActionRisk {
    return action === "rollback_production" ? "destructive"
      : action === "targeted_canary_probe" ? "bounded"
        : "safe"
  }

  captureActionAttempt(input: {
    proposedAction: ActionName
    producerId: string
    planId?: string | null
    targetCause?: string | null
  }): ActionAttemptSnapshot {
    const attemptId = `attempt-${++this.attemptSequence}`
    const plan = input.planId === undefined
      ? this.getActivePlan()
      : input.planId === null
        ? null
        : this.getPlan(input.planId)
    const validProvenance = plan !== null
      && plan.producerId === input.producerId
      && this.isActionControllerProducer(input.producerId)
    const basedOnRevision = plan?.basedOnRevision ?? -1
    const boundaryRevision = this.decisionRevision
    const fresh = validProvenance && basedOnRevision === boundaryRevision
    const evaluation = evaluateSafetyGate(this.hypotheses, this.degradedRoles, "action-boundary")
    const actionRisk = this.riskFor(input.proposedAction)
    const targetCause = typeof input.targetCause === "string" && input.targetCause.trim().length > 0
      ? input.targetCause.trim()
      : null
    const visibleCauses = new Set(this.hypotheses.map((item) => item.rootCause))
    const availableStrong = this.hypotheses.length > 0
      && this.hypotheses.every((item) => Number.isFinite(item.confidence) && item.confidence >= 0.8)

    let policyDecision: Exclude<GateDecision, "pending"> = "blocked"
    let policyReason: ActionPolicyReason
    if (actionRisk === "safe") {
      policyDecision = "approved"
      policyReason = "safe-action"
    } else if (!validProvenance) {
      policyReason = "invalid-plan-provenance"
    } else if (!fresh) {
      policyReason = "stale-plan"
    } else if (actionRisk === "bounded") {
      if (this.degradedRoles.length > 0) policyReason = "degraded-evidence"
      else if (!availableStrong) policyReason = "insufficient-bounded-evidence"
      else if (evaluation.contradictions > 0) policyReason = "conflicting-evidence"
      else if (targetCause === null || visibleCauses.size !== 1 || !visibleCauses.has(targetCause)) {
        policyReason = "bounded-target-mismatch"
      } else {
        policyDecision = "approved"
        policyReason = "fresh-bounded-evidence"
      }
    } else if (evaluation.decision === "approved") {
      policyDecision = "approved"
      policyReason = evaluation.reason
    } else {
      policyReason = evaluation.reason as Exclude<GateReason, "pending-required-evidence">
    }

    const perRoleConfidence = Object.freeze(Object.fromEntries(ROLES.map((role) => [
      role,
      this.hypotheses.find((item) => item.role === role)?.confidence ?? null,
    ])) as Record<Role, number | null>)
    const snapshot: ActionAttemptSnapshot = Object.freeze({
      attemptId,
      planId: plan?.planId ?? "invalid-plan",
      actionProducerId: input.producerId,
      basedOnRevision,
      boundaryRevision,
      fresh,
      atMs: Math.round(performance.now() - this.startedAt),
      investigationDecision: this.gateDecision,
      investigationReason: this.gateReason,
      gateDecision: evaluation.decision as Exclude<GateDecision, "pending">,
      gateReason: evaluation.reason as Exclude<GateReason, "pending-required-evidence">,
      policyDecision,
      policyReason,
      decision: policyDecision,
      reason: policyReason,
      availableRoles: Object.freeze([...evaluation.availableRoles]),
      missingRequiredRoles: Object.freeze([...evaluation.missingRequiredRoles]),
      degradedRoles: Object.freeze([...this.degradedRoles]),
      confidence: Number(evaluation.confidence.toFixed(2)),
      perRoleConfidence,
      contradictions: evaluation.contradictions,
      proposedAction: input.proposedAction,
      actionRisk,
      targetCause,
    })
    this.attemptSnapshots.push(snapshot)
    this.actionBoundarySnapshot = snapshot
    this.gateAtActionBoundary = snapshot.gateDecision
    this.gateReasonAtActionBoundary = snapshot.gateReason
    this.hypothesesAtActionBoundary = snapshot.availableRoles.length
    this.contradictionsAtActionBoundary = snapshot.contradictions
    this.boundarySafeAction = snapshot.proposedAction === "rollback_production" && snapshot.policyDecision === "approved"
      ? "rollback-approved"
      : snapshot.gateReason === "conflicting-evidence"
        ? "canary-with-targeted-corroboration"
        : snapshot.gateReason === "incomplete-required-evidence"
          ? "hold-for-missing-evidence"
          : "request-broader-corroboration"
    if (this.boundarySafeAction === "canary-with-targeted-corroboration") {
      this.actionableSafePlan = "canary-with-targeted-corroboration"
      this.actionableSafePlanAtMs = snapshot.atMs
    }
    this.record(
      ACTION_ATTEMPT_SNAPSHOTTED,
      input.producerId,
      `${snapshot.attemptId} ${snapshot.proposedAction} plan=${snapshot.planId} revision=${snapshot.basedOnRevision}->${snapshot.boundaryRevision} ${snapshot.fresh ? "fresh" : "stale"} policy=${snapshot.policyDecision}:${snapshot.policyReason}`,
    )
    this.notifyChange()
    return snapshot
  }

  captureActionBoundarySnapshot(proposedAction: "rollback_production"): ActionBoundarySnapshot {
    const producerId = this.actionControllerId ?? "unregistered-action-controller"
    const plan = this.getActivePlan() ?? this.startPlan(producerId)
    return this.captureActionAttempt({ proposedAction, producerId, planId: plan?.planId })
  }

  markActionableCanaryAvailable(): void {
    if (this.actionableSafePlanAtMs !== null) return
    this.actionableSafePlan = "canary-with-targeted-corroboration"
    this.actionableSafePlanAtMs = Math.round(performance.now() - this.startedAt)
    this.notifyChange()
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
      gateReason: this.gateReason,
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
        gateReasonAtBoundary: this.gateReasonAtActionBoundary,
        hypothesesAtBoundary: this.hypothesesAtActionBoundary,
        contradictionsAtBoundary: this.contradictionsAtActionBoundary,
        boundarySnapshot: this.actionBoundarySnapshot === null ? null : {
          ...this.actionBoundarySnapshot,
          availableRoles: [...this.actionBoundarySnapshot.availableRoles],
          missingRequiredRoles: [...this.actionBoundarySnapshot.missingRequiredRoles],
          degradedRoles: [...this.actionBoundarySnapshot.degradedRoles],
          perRoleConfidence: { ...this.actionBoundarySnapshot.perRoleConfidence },
        },
        plans: this.planContexts.map((plan) => ({
          ...plan,
          availableRoles: [...plan.availableRoles],
          hypotheses: plan.hypotheses.map((hypothesis) => ({ ...hypothesis })),
        })),
        attempts: this.attemptSnapshots.map((attempt) => ({
          ...attempt,
          availableRoles: [...attempt.availableRoles],
          missingRequiredRoles: [...attempt.missingRequiredRoles],
          degradedRoles: [...attempt.degradedRoles],
          perRoleConfidence: { ...attempt.perRoleConfidence },
        })),
        decisionRevision: this.decisionRevision,
        boundarySafeAction: this.boundarySafeAction,
        actionableSafePlan: this.actionableSafePlan,
        actionableSafePlanAtMs: this.actionableSafePlanAtMs,
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

type CanaryProbeArgs = { service: string; targetCause: string; scope: string }

export function createTargetedCanaryProbeTool(onInvoke?: (args: CanaryProbeArgs) => void): Tool {
  return {
    type: "function",
    name: "targeted_canary_probe",
    description: "Record a bounded, reversible, proposal-only diagnostic canary probe for one evidenced cause.",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string" },
        targetCause: { type: "string" },
        scope: { type: "string" },
      },
      required: ["service", "targetCause", "scope"],
      additionalProperties: false,
    },
    strict: true,
    invoke: async (args: CanaryProbeArgs) => {
      onInvoke?.(args)
      return {
        status: "proposal-only-bounded-probe",
        service: args.service,
        targetCause: args.targetCause,
        scope: args.scope,
      }
    },
  }
}

type InterceptionContext = {
  producerId?: string
  planId?: string | null
}

export class SafetyGateInterception implements InterceptionHandler {
  constructor(
    private readonly state: IncidentState,
    private readonly context: InterceptionContext = {},
  ) {}

  isSatisfiedBy(transition: ExecutableTransition): boolean {
    // Every non-safe proposal must cross this handler. Authorization is derived
    // only from its own immutable attempt snapshot, never the mutable live gate.
    return transition.nextStateId === "function_call"
      && (transition.input.call.name === "rollback_production" || transition.input.call.name === "targeted_canary_probe")
  }

  async handle(transition: ExecutableTransition): Promise<ExecutableTransition> {
    if (!this.isSatisfiedBy(transition) || transition.nextStateId !== "function_call") {
      return transition
    }
    const functionCallTransition = transition as Extract<ExecutableTransition, { nextStateId: "function_call" }>
    const call = functionCallTransition.input.call
    const proposedAction = call.name as Extract<ActionName, "rollback_production" | "targeted_canary_probe">
    let targetCause: string | null = null
    if (proposedAction === "targeted_canary_probe") {
      try {
        const args = JSON.parse(call.args) as { targetCause?: unknown }
        if (typeof args.targetCause === "string") targetCause = args.targetCause
      } catch {
        // A malformed target is deterministically rejected by bounded policy.
      }
    }
    // Authorization context is bound by the Action Controller call site. Never
    // let an unbound transition borrow whichever plan happens to be active.
    const producerId = this.context.producerId ?? "unregistered-action-controller"
    const snapshot = this.state.captureActionAttempt({
      proposedAction,
      producerId,
      planId: this.context.planId ?? null,
      targetCause,
    })
    this.state.actionProposed = true
    this.state.requestedActionTool = proposedAction
    this.state.actionAttemptStarted = true
    this.state.actionAttemptedAtMs ??= snapshot.atMs
    this.state.record(
      PLAN_PROPOSED,
      producerId,
      `${snapshot.planId} proposed ${proposedAction} based on revision ${snapshot.basedOnRevision}`,
    )
    if (snapshot.policyDecision === "approved") return transition

    this.state.actionIntercepted = true
    const reason = snapshot.policyReason
    if (!snapshot.fresh && snapshot.actionRisk !== "safe") {
      this.state.staleReplanRequired = true
      this.state.record(
        PLAN_STALE,
        producerId,
        `${snapshot.planId} invalidated: based on revision ${snapshot.basedOnRevision}, boundary revision ${snapshot.boundaryRevision}`,
      )
      this.state.record(
        PLAN_REPLAN_REQUESTED,
        producerId,
        `${snapshot.planId} routed to request_corroboration before fresh replanning`,
      )
    }
    this.state.record("mozaik.interception.rewritten", "Safety Gate", `rewrote ${call.name} -> request_corroboration (${reason})`)
    const safeCall = FunctionCallItem.rehydrate({
      callId: call.callId,
      name: "request_corroboration",
      args: JSON.stringify({ originalAction: call.name, reason }),
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
    "Do not treat an unverified peer claim as fact. Phase 1 is investigation-only; do not propose or execute mitigations.",
  ].join(" ")
}

function modelAnswerText(payload: unknown): string {
  const candidate = payload as { answer?: { content?: { text?: unknown } } }
  return typeof candidate.answer?.content?.text === "string" ? candidate.answer.content.text : "model answer unavailable"
}

type ModelHypothesis = Pick<Hypothesis, "claim" | "confidence" | "rootCause">

export function parseModelHypothesis(payload: unknown, _role: Role): ModelHypothesis | null {
  const text = modelAnswerText(payload)
  try {
    const parsed = JSON.parse(text) as { claim?: unknown; confidence?: unknown; rootCause?: unknown }
    if (typeof parsed.claim === "string" && parsed.claim.trim().length > 0
      && typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      && parsed.confidence >= 0 && parsed.confidence <= 1
      && typeof parsed.rootCause === "string" && parsed.rootCause.trim().length > 0) {
      return {
        claim: parsed.claim.trim(),
        confidence: parsed.confidence,
        rootCause: parsed.rootCause.trim(),
      }
    }
  } catch {
    // Invalid provider output is rejected below.
  }
  return null
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
  constructor(private readonly speculativePlanningMs = 0) {}

  async run(request: InferenceInput): Promise<InferenceOutput> {
    const hasToolOutput = request.context.getItems().some((item) => item.type === "function_call_output")
    if (!hasToolOutput) {
      const contextText = JSON.stringify(request.context.getItems())
      if (contextText.includes("revision-stamped speculative plan")) {
        if (this.speculativePlanningMs > 0) await sleep(this.speculativePlanningMs)
        const match = /targetCause=([a-z0-9-]+)/.exec(contextText)
        return {
          items: [FunctionCallItem.rehydrate({
            callId: "incidentmesh-deterministic-bounded-probe",
            name: "targeted_canary_probe",
            args: JSON.stringify({
              service: "checkout-api",
              targetCause: match?.[1] ?? "unknown-cause",
              scope: "five-percent-diagnostic-canary",
            }),
          })],
          tokenUsage: undefined,
          rowResponse: { fixture: "revision_stamped_bounded_proposal" },
        }
      }
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
  reasoningEffort: string | undefined,
  runLoop: ReturnType<typeof defineRuntime<IncidentState>>["runLoop"],
  sendEvent: ReturnType<typeof defineRuntime<IncidentState>>["sendEvent"],
  evidenceOverride?: Partial<Record<Role, Pick<Hypothesis, "claim" | "confidence" | "rootCause">>>,
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
            const fixture = evidenceOverride?.[role]
            sendEvent(event(HYPOTHESIS_EMITTED, participant.getId(), {
              role,
              claim: fixture?.claim ?? config.claim,
              confidence: fixture?.confidence ?? (role === "impact" ? 0.88 : role === "trace" ? 0.85 : 0.82),
              rootCause: fixture?.rootCause ?? config.rootCause,
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
          ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
          tools: [],
          structuredOutput: MODEL_HYPOTHESIS_OUTPUT,
          context: participant.getMemory().getContext(),
        }, new SafetyGateInterception(state, { producerId: participant.getId(), planId: null }))
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
        if (hypothesis === null) {
          sendEvent(event(HYPOTHESIS_REJECTED, participant.getId(), {
            role, reason: "malformed-model-evidence", detail: `${role} model evidence rejected as malformed`,
          }), participant.getId())
          sendEvent(event(RESPONDER_DEGRADED, participant.getId(), {
            role, reason: "malformed-model-evidence", detail: `${role} produced no valid hypothesis for this phase`,
          }), participant.getId())
          sendEvent(event(SPAN_COMPLETED, participant.getId(), { role, detail: "model response complete without valid evidence" }), participant.getId())
          return
        }
        sendEvent(event(HYPOTHESIS_EMITTED, participant.getId(), { role, ...hypothesis }), participant.getId())
        sendEvent(event(SPAN_COMPLETED, participant.getId(), { role, detail: "model response complete" }), participant.getId())
      },
    },
  }

  const blockedAdaptation: SituationHandler = {
    specification: isPeerType(GATE_DECISION),
    processor: {
      apply({ participant, event: decisionEvent }) {
        const payload = decisionEvent.payload as EventPayload
        if (!dryRun || payload.decision !== "blocked" || role !== "impact" || !state.actionAttemptStarted) return
        const gateReason = payload.gateReason
        if (gateReason === "conflicting-evidence" && !state.followupRequested) {
          state.followupRequested = true
          state.markActionableCanaryAvailable()
          void (async () => {
            await sleep(35)
            state.adaptations.push("Impact selected a canary with targeted corroboration after conflicting evidence blocked rollback.")
            sendEvent(event(MITIGATION_REPLANNED, participant.getId(), {
              role, action: "canary", reason: "conflicting-evidence", detail: "switched from rollback to a canary plus targeted corroboration",
            }), participant.getId())
          })()
          return
        }
        if (gateReason === "incomplete-required-evidence" && !state.holdPlanRecorded) {
          state.holdPlanRecorded = true
          void (async () => {
            await sleep(10)
            if (state.degradedRoles.length > 0) {
              state.adaptations.push("Action path held the broad rollback and requested surviving-signal corroboration because required evidence was unavailable.")
              sendEvent(event(MITIGATION_REPLANNED, participant.getId(), {
                role, action: "degraded-hold", reason: "incomplete-required-evidence", detail: "held rollback; requested surviving-signal corroboration",
              }), participant.getId())
            } else {
              state.adaptations.push("Action path held the broad rollback while waiting for missing required evidence.")
            }
          })()
        }
      },
    },
  }

  const canaryEvidence: SituationHandler = {
    specification: isPeerType(MITIGATION_REPLANNED),
    processor: {
      apply({ participant, event: planEvent }) {
        if (!dryRun) return
        const payload = planEvent.payload as EventPayload
        const action = payload.action
        const canCorroborateCanary = action === "canary" && (role === "trace" || role === "dependency") && !(simulateDependencyTimeout && role === "dependency")
        const canCorroborateDegradedHold = action === "degraded-hold" && role === "trace"
        if (!canCorroborateCanary && !canCorroborateDegradedHold) return
        void (async () => {
          await sleep(role === "trace" ? 24 : 42)
          const note = action === "canary"
            ? `${config.name} supplied corroboration for the canary plan`
            : `${config.name} supplied surviving-signal corroboration for the degraded hold`
          state.evidence.push(note)
          sendEvent(event(EVIDENCE_ADDED, participant.getId(), { role, note, planProducer: planEvent.producerId, detail: note }), participant.getId())
        })()
      },
    },
  }
  return [opened, peerAwareness, modelAnswer, blockedAdaptation, canaryEvidence]
}

function mitigationPrompt(state: IncidentState, plan: PlanContext): string {
  const evidence = plan.hypotheses
    .map((item) => `- ${item.role}: confidence=${item.confidence.toFixed(2)} rootCause=${item.rootCause} claim=${item.claim}`)
    .join("\n")
  return [
    "You are the mitigation owner in IncidentMesh. Phase-1 evidence collection is closed for this action phase.",
    `Incident: ${state.incident}.`,
    `Planning context: ${plan.planId}, decision revision ${plan.basedOnRevision}.`,
    `Safety Gate: ${state.gateDecision} (${state.gateReason}); aggregate confidence=${state.confidence.toFixed(2)}; contradictions=${state.contradictions}.`,
    "Shared evidence from independent responders:",
    evidence,
    "Choose the next mitigation using this shared evidence. If you choose a production rollback, call rollback_production; the Safety Gate will inspect that tool transition. If corroboration is required, account for the tool result and then give a concise final recommendation. Do not claim that Phase-1 responder models saw one another's evidence.",
  ].join("\n")
}

function actionHandlers(
  state: IncidentState,
  dryRun: boolean,
  phase1Only: boolean,
  planningMode: PlanningMode,
  actionProposalMs: number,
  actionBoundaryMs: number,
  model: string,
  maxOutputTokens: number,
  reasoningEffort: string | undefined,
  runLoop: ReturnType<typeof defineRuntime<IncidentState>>["runLoop"],
  sendEvent: ReturnType<typeof defineRuntime<IncidentState>>["sendEvent"],
): SituationHandler[] {
  const deterministicBoundary: SituationHandler = {
    specification: isType(INCIDENT_OPENED),
    processor: {
      apply({ participant }) {
        if (!dryRun || planningMode !== "post-aggregation" || state.actionProposed) return
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
          const plan = state.startPlan(participant.getId())
          if (plan === null) {
            state.record("incident.plan.error", participant.getId(), "Action Controller could not establish an authoritative plan context")
            return
          }
          state.actionAttemptStarted = true
          state.actionAttemptedAtMs = Math.round(performance.now() - state.startedAt)
          sendEvent(event(ACTION_EXECUTION_REQUESTED, participant.getId(), {
            action: "rollback_production",
            planId: plan.planId,
            basedOnRevision: plan.basedOnRevision,
            hypotheses: state.hypotheses.length,
            contradictions: state.contradictions,
            detail: `action boundary reached with hypotheses=${state.hypotheses.length}, contradictions=${state.contradictions}`,
          }), participant.getId())
          runLoop(participant.getId(), "Execute the pending rollback proposal at the fixed action boundary.", {
            model: "incidentmesh-deterministic-action",
            tools: participant.getTools(),
            context: participant.getMemory().getContext(),
          }, new SafetyGateInterception(state, { producerId: participant.getId(), planId: plan.planId }))
        })()
      },
    },
  }

  const speculativeBoundedPlanning: SituationHandler = {
    specification: isPeerType(HYPOTHESIS_EMITTED),
    processor: {
      apply({ participant, event: hypothesisEvent }) {
        if (!dryRun || planningMode !== "speculative-bounded" || state.mitigationPhaseStarted || !(participant instanceof Agent)) return
        const payload = hypothesisEvent.payload as EventPayload
        if (payload.role !== "trace") return
        void (async () => {
          const accepted = await state.waitFor(() => state.hypotheses.some((item) => item.role === "trace"), 50)
          if (!accepted || state.mitigationPhaseStarted) return
          const traceHypothesis = state.hypotheses.find((item) => item.role === "trace")
          if (traceHypothesis === undefined) return
          const plan = state.startPlan(participant.getId())
          if (plan === null) return
          state.mitigationPhaseStarted = true
          state.actionBoundaryMs = null
          sendEvent(event(MITIGATION_PHASE_STARTED, participant.getId(), {
            planId: plan.planId,
            basedOnRevision: plan.basedOnRevision,
            planningMode,
            detail: `speculative bounded planning started at revision ${plan.basedOnRevision} while peer investigations continue`,
          }), participant.getId())
          runLoop(participant.getId(), [
            "Execute the revision-stamped speculative plan.",
            `planId=${plan.planId}`,
            `basedOnRevision=${plan.basedOnRevision}`,
            `targetCause=${traceHypothesis.rootCause}`,
            "Propose only the bounded targeted_canary_probe; the action boundary will enforce revision freshness and policy.",
          ].join(" "), {
            model: "incidentmesh-deterministic-action",
            tools: participant.getTools(),
            context: participant.getMemory().getContext(),
          }, new SafetyGateInterception(state, { producerId: participant.getId(), planId: plan.planId }))
        })()
      },
    },
  }

  const providerMitigationPhase: SituationHandler = {
    specification: isPeerType(GATE_DECISION),
    processor: {
      apply({ participant, event: decisionEvent }) {
        if (dryRun || phase1Only || state.mitigationPhaseStarted || !(participant instanceof Agent)) return
        if (!state.isSafetyGateProducer(decisionEvent.producerId)) return
        const payload = decisionEvent.payload as EventPayload
        if (payload.scope !== "investigation" || payload.decision !== state.gateDecision || payload.gateReason !== state.gateReason) return
        state.mitigationPhaseStarted = true
        state.actionBoundaryMs = null
        const plan = state.startPlan(participant.getId())
        if (plan === null) {
          state.record("incident.plan.error", participant.getId(), "Provider Action Controller could not establish an authoritative plan context")
          return
        }
        sendEvent(event(MITIGATION_PHASE_STARTED, participant.getId(), {
          planId: plan.planId,
          basedOnRevision: plan.basedOnRevision,
          gateDecision: state.gateDecision,
          hypotheses: state.hypotheses.length,
          detail: `Phase 2 mitigation loop started with ${state.hypotheses.length} shared hypotheses and gate=${state.gateDecision}`,
        }), participant.getId())
        runLoop(participant.getId(), mitigationPrompt(state, plan), {
          model,
          maxOutputTokens,
          ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
          tools: participant.getTools(),
          context: participant.getMemory().getContext(),
        }, new SafetyGateInterception(state, { producerId: participant.getId(), planId: plan.planId }))
      },
    },
  }

  const stalePlanReplanning: SituationHandler = {
    specification: isType(SAFE_ACTION_EXECUTED),
    processor: {
      apply({ participant }) {
        if (!dryRun || planningMode !== "speculative-bounded" || !state.staleReplanRequired
          || state.freshReplanStarted || !(participant instanceof Agent)) return
        const staleAttempt = state.actionAttempts.find((attempt) => attempt.policyReason === "stale-plan")
        if (staleAttempt === undefined || staleAttempt.targetCause === null) return
        const plan = state.startPlan(participant.getId())
        if (plan === null) return
        state.freshReplanStarted = true
        sendEvent(event(PLAN_REPLANNED, participant.getId(), {
          previousPlanId: staleAttempt.planId,
          planId: plan.planId,
          basedOnRevision: plan.basedOnRevision,
          detail: `fresh replan ${plan.planId} started at revision ${plan.basedOnRevision} after ${staleAttempt.planId} was invalidated`,
        }), participant.getId())
        runLoop(participant.getId(), [
          "Execute the revision-stamped speculative plan as a fresh replan.",
          `planId=${plan.planId}`,
          `basedOnRevision=${plan.basedOnRevision}`,
          `targetCause=${staleAttempt.targetCause}`,
          "Re-evaluate the same bounded targeted_canary_probe under current authoritative evidence.",
        ].join(" "), {
          model: "incidentmesh-deterministic-action",
          tools: participant.getTools(),
          context: participant.getMemory().getContext(),
        }, new SafetyGateInterception(state, { producerId: participant.getId(), planId: plan.planId }))
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

  return [deterministicBoundary, speculativeBoundedPlanning, stalePlanReplanning, providerMitigationPhase, providerRecommendation]
}

export function evaluateSafetyGate(
  hypotheses: readonly Hypothesis[],
  degradedRoles: readonly Role[] = [],
  scope: "investigation" | "action-boundary" = "investigation",
): GateEvaluation {
  const byRole = new Map<Role, Hypothesis>()
  for (const hypothesis of hypotheses) {
    if (!byRole.has(hypothesis.role)) byRole.set(hypothesis.role, hypothesis)
  }
  const authoritative = ROLES.flatMap((role) => {
    const item = byRole.get(role)
    return item === undefined ? [] : [item]
  })
  const availableRoles = authoritative.map((item) => item.role)
  const missingRequiredRoles = ROLES.filter((role) => !byRole.has(role))
  const confidence = authoritative.length === 0
    ? 0
    : authoritative.reduce((sum, item) => sum + item.confidence, 0) / authoritative.length
  const contradictions = authoritative.length === 0 ? 0 : new Set(authoritative.map((item) => item.rootCause)).size - 1

  if (missingRequiredRoles.length > 0) {
    const degradedMissing = missingRequiredRoles.some((role) => degradedRoles.includes(role))
    if (scope === "action-boundary" || degradedMissing) {
      return { decision: "blocked", reason: "incomplete-required-evidence", confidence, contradictions, availableRoles, missingRequiredRoles }
    }
    return { decision: "pending", reason: "pending-required-evidence", confidence, contradictions, availableRoles, missingRequiredRoles }
  }
  if (degradedRoles.length > 0) {
    return { decision: "blocked", reason: "degraded-required-responder", confidence, contradictions, availableRoles, missingRequiredRoles }
  }
  if (contradictions > 0) {
    return { decision: "blocked", reason: "conflicting-evidence", confidence, contradictions, availableRoles, missingRequiredRoles }
  }
  if (!Number.isFinite(confidence) || authoritative.some((item) => item.confidence < 0.8)) {
    return { decision: "blocked", reason: "low-confidence-evidence", confidence, contradictions, availableRoles, missingRequiredRoles }
  }
  return { decision: "approved", reason: "sufficient-consistent-evidence", confidence, contradictions, availableRoles, missingRequiredRoles }
}

function emitInvestigationGateDecision(
  state: IncidentState,
  participantId: string,
  sendEvent: (event: SemanticEvent, senderId: string) => void,
  trigger: "evidence-aggregation" | "late-evidence" | "degradation" | "evidence-deadline",
): void {
  const evaluation = evaluateSafetyGate(state.hypotheses, state.degradedRoles, "investigation")
  const changed = state.gateDecision !== evaluation.decision || state.gateReason !== evaluation.reason
  state.gateDecision = evaluation.decision
  state.gateReason = evaluation.reason
  if (!changed && evaluation.decision === "pending") return
  if (!changed && trigger === "late-evidence") return
  if (state.actionBoundarySnapshot !== null && evaluation.reason === "conflicting-evidence") {
    state.markActionableCanaryAvailable()
  }
  sendEvent(event(GATE_DECISION, participantId, {
    scope: "investigation",
    decision: evaluation.decision,
    gateReason: evaluation.reason,
    confidence: evaluation.confidence,
    contradictions: evaluation.contradictions,
    hypotheses: evaluation.availableRoles.length,
    missingRequiredRoles: evaluation.missingRequiredRoles,
    trigger,
    detail: `${evaluation.decision}: ${evaluation.reason}; ${evaluation.contradictions} contradictions across ${evaluation.availableRoles.length} hypotheses; confidence ${evaluation.confidence.toFixed(2)} (${trigger})`,
  }), participantId)
}

function emitActionBoundaryDecision(
  state: IncidentState,
  participantId: string,
  sendEvent: (event: SemanticEvent, senderId: string) => void,
): void {
  const evaluation = evaluateSafetyGate(state.hypotheses, state.degradedRoles, "action-boundary")
  sendEvent(event(GATE_DECISION, participantId, {
    scope: "action-boundary",
    decision: evaluation.decision,
    gateReason: evaluation.reason,
    confidence: evaluation.confidence,
    contradictions: evaluation.contradictions,
    hypotheses: evaluation.availableRoles.length,
    missingRequiredRoles: evaluation.missingRequiredRoles,
    investigationDecision: state.gateDecision,
    detail: `${evaluation.decision}: ${evaluation.reason}; boundary hypotheses=${evaluation.availableRoles.length}, missing=${evaluation.missingRequiredRoles.join(",") || "none"}`,
  }), participantId)
}

function gateHandlers(state: IncidentState, sendEvent: (event: SemanticEvent, senderId: string) => void): SituationHandler[] {
  const collectHypothesis: SituationHandler = {
    specification: isPeerType(HYPOTHESIS_EMITTED),
    processor: {
      apply({ participant, event: hypothesisEvent }) {
        const payload = hypothesisEvent.payload as EventPayload
        const accepted = state.acceptHypothesis(hypothesisEvent.producerId, payload)
        if (accepted.status === "accepted" || accepted.status === "late-accepted") {
          emitInvestigationGateDecision(
            state, participant.getId(), sendEvent, accepted.status === "late-accepted" ? "late-evidence" : "evidence-aggregation",
          )
          return
        }
        const detail = `rejected hypothesis: ${accepted.status}${accepted.role ? ` role=${accepted.role}` : ""}`
        sendEvent(event(HYPOTHESIS_REJECTED, participant.getId(), {
          role: accepted.role ?? "unknown", reason: accepted.status, detail,
        }), participant.getId())
        if (accepted.status === "malformed" && accepted.role !== undefined) {
          sendEvent(event(RESPONDER_DEGRADED, participant.getId(), {
            role: accepted.role, reason: "malformed-evidence", detail: `${accepted.role} has no valid evidence for this phase`,
          }), participant.getId())
          emitInvestigationGateDecision(state, participant.getId(), sendEvent, "degradation")
        }
      },
    },
  }

  const recordDegradation: SituationHandler = {
    specification: isPeerType(RESPONDER_DEGRADED),
    processor: {
      apply({ participant, event: degradedEvent }) {
        const payload = degradedEvent.payload as EventPayload
        const role = payload.role
        if (typeof role !== "string" || !ROLES.includes(role as Role)) return
        const typedRole = role as Role
        if (!state.isResponderProducer(typedRole, degradedEvent.producerId)) return
        if (state.markDegraded(typedRole)) emitInvestigationGateDecision(state, participant.getId(), sendEvent, "degradation")
      },
    },
  }

  const decideAtActionBoundary: SituationHandler = {
    specification: isPeerType(ACTION_EXECUTION_REQUESTED),
    processor: {
      apply({ participant, event: executionEvent }) {
        if (!state.isActionControllerProducer(executionEvent.producerId)) return
        const payload = executionEvent.payload as EventPayload
        if (payload.action !== "rollback_production") return
        emitActionBoundaryDecision(state, participant.getId(), sendEvent)
      },
    },
  }

  return [collectHypothesis, recordDegradation, decideAtActionBoundary]
}

function frameworkObserverHandlers(state: IncidentState): SituationHandler[] {
  const frameworkTypes = new Set(["interception.started", "interception.finished", "function_call.started", "function_call.completed", "inference.started", "inference.completed"])
  return [{
    specification: new (class extends SituationSpecification {
      isSatisfiedBy({ event }: SituationContext): boolean {
        return frameworkTypes.has(event.type)
      }
    })(),
    processor: {
      apply({ event: frameworkEvent }) {
        const payload = frameworkEvent.payload as EventPayload
        if (frameworkEvent.type === "inference.started" || frameworkEvent.type === "inference.completed") {
          const modelName = typeof payload.model === "string" ? payload.model : "provider model"
          state.record(`mozaik.${frameworkEvent.type}`, frameworkEvent.producerId, `${frameworkEvent.type} ${modelName}`)
          return
        }
        if (frameworkEvent.type === "interception.started") {
          const input = payload.input as { call?: { name?: string } } | undefined
          const callName = input?.call?.name
          if (callName === "rollback_production" || callName === "targeted_canary_probe") {
            state.actionProposed = true
            state.requestedActionTool = callName
            if (!state.actionAttemptStarted) {
              state.actionAttemptStarted = true
              state.actionAttemptedAtMs = Math.round(performance.now() - state.startedAt)
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
          if (call?.name === "rollback_production" || call?.name === "targeted_canary_probe") {
            state.actionProposed = true
            state.requestedActionTool = call.name
            if (!state.actionAttemptStarted) {
              state.actionAttemptStarted = true
              state.actionAttemptedAtMs = Math.round(performance.now() - state.startedAt)
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
        if (event.type === SPAN_STARTED && typeof payload.role === "string" && ROLES.includes(payload.role as Role)) {
          const role = payload.role as Role
          if (!state.spans.has(role)) state.spans.set(role, { role, startedAtMs: Math.round(performance.now() - state.startedAt) })
        }
        if (event.type === SPAN_COMPLETED && typeof payload.role === "string" && ROLES.includes(payload.role as Role)) {
          const span = state.spans.get(payload.role as Role)
          if (span && span.completedAtMs === undefined) span.completedAtMs = Math.round(performance.now() - state.startedAt)
        }
        // Update span state before notifying waiters through record(). This keeps
        // phase-settlement predicates from missing the final completion event.
        state.record(event.type, event.producerId, detail)
      },
    },
  }]
}

export type ScenarioOptions = {
  dryRun?: boolean
  phase1Only?: boolean
  model?: string
  maxOutputTokens?: number
  reasoningEffort?: string
  timeoutMs?: number
  scheduleMode?: ScheduleMode
  planningMode?: PlanningMode
  speculativePlanningMs?: number
  actionProposalMs?: number
  actionBoundaryMs?: number
  simulateDependencyTimeout?: boolean
  evidenceDeadlineMs?: number
  inferenceRunner?: InferenceRunner
  evidenceOverride?: Partial<Record<Role, Pick<Hypothesis, "claim" | "confidence" | "rootCause">>>
  trace?: (event: TimelineEvent) => void
}

export async function runIncidentScenario(options: ScenarioOptions = {}): Promise<IncidentReport> {
  const dryRun = options.dryRun ?? true
  const phase1Only = options.phase1Only ?? false
  const model = options.model ?? "gpt-5.5"
  const maxOutputTokens = options.maxOutputTokens ?? 350
  const reasoningEffort = options.reasoningEffort
  const scheduleMode = options.scheduleMode ?? "concurrent"
  const planningMode = options.planningMode ?? "post-aggregation"
  const speculativePlanningMs = options.speculativePlanningMs ?? 120
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
  const inferenceRunner = options.inferenceRunner ?? (dryRun ? new DeterministicActionInferenceRunner(
    planningMode === "speculative-bounded" ? speculativePlanningMs : 0,
  ) : undefined)
  const runtimeModels = model === "gemini-3.5-flash-lite"
    ? (() => {
      const base = supportedModels.find((candidate) => candidate.specification.name === "gemini-3.5-flash")
      return base === undefined
        ? undefined
        : [...supportedModels, { ...base, specification: { ...base.specification, name: model } }]
    })()
    : undefined
  initializeRuntime(inferenceRunner
    ? { state, inferenceRunnerConfig: { runner: inferenceRunner, ...(runtimeModels === undefined ? {} : { supportedModels: runtimeModels }) } }
    : runtimeModels === undefined ? { state } : { state, inferenceRunnerConfig: { supportedModels: runtimeModels } })

  const observer = createHuman({
    name: "Incident Console",
    capabilities: ["timeline"],
    handlers: [...observerHandlers(state), ...frameworkObserverHandlers(state)],
  })
  const gate = createHuman({ name: "Safety Gate", capabilities: ["risk-control", "interception"], handlers: gateHandlers(state, sendEvent) })
  state.registerSafetyGate(gate.getId())
  const responders = ROLES.map((role) => {
    const responder = createAgent({
      name: ROLE_CONFIG[role].name,
      capabilities: [ROLE_CONFIG[role].capability, "concurrent-response"],
      instruction: `You are the ${role} responder. Work independently, publish evidence, and react to peer events.`,
      tools: [],
      handlers: responderHandlers(role, state, dryRun, scheduleMode, simulateDependencyTimeout, model, maxOutputTokens, reasoningEffort, runLoop, sendEvent, options.evidenceOverride),
    })
    state.registerResponder(role, responder.getId())
    return responder
  })
  let actionController!: Agent
  const actionTools: Tool[] = [
    createRollbackTool(() => {
      state.actionExecutedTool = "rollback_production"
      sendEvent(event("incident.action.rollback-tool-executed", actionController.getId(), {
        action: "rollback_production",
        detail: "rollback_production tool crossed the action boundary without safety rewrite (proposal-only fixture)",
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
    createTargetedCanaryProbeTool((args) => {
      state.actionExecutedTool = "targeted_canary_probe"
      sendEvent(event("incident.action.bounded-probe-executed", actionController.getId(), {
        action: "targeted_canary_probe",
        targetCause: args.targetCause,
        scope: args.scope,
        detail: `proposal-only bounded canary probe recorded for ${args.targetCause}`,
      }), actionController.getId())
    }),
  ]
  actionController = createAgent({
    name: "Action Controller",
    capabilities: ["production-change", "action-boundary"],
    instruction: "Execute proposed incident mitigations only through the Safety Gate.",
    tools: actionTools,
    handlers: actionHandlers(state, dryRun, phase1Only, planningMode, actionProposalMs, actionBoundaryMs, model, maxOutputTokens, reasoningEffort, runLoop, sendEvent),
  })
  state.registerActionController(actionController.getId())
  const human = createHuman({ name: "Incident Commander", capabilities: ["incident-input"], handlers: [] })
  for (const participant of [observer, gate, ...responders, actionController, human]) join(participant)

  sendEvent(event(INCIDENT_OPENED, human.getId(), {
    incident: state.incident,
    summary: "Checkout failures are rising in us-east; investigate and choose a safe mitigation.",
  }), human.getId())

  const timeoutMs = options.timeoutMs ?? (dryRun ? 2_000 : 30_000)
  const evidenceDeadlineMs = options.evidenceDeadlineMs ?? (dryRun
    ? Math.max(800, actionBoundaryMs + 500)
    : Math.min(10_000, Math.max(500, Math.floor(timeoutMs * 0.6))))
  const evidenceDeadlineTimer = setTimeout(() => {
    const missing = ROLES.filter((role) => !state.hypotheses.some((item) => item.role === role))
    let changed = false
    for (const role of missing) {
      if (!state.markDegraded(role)) continue
      changed = true
      sendEvent(event(RESPONDER_DEGRADED, gate.getId(), {
        role, reason: "evidence-deadline", detail: `${ROLE_CONFIG[role].name} missed the evidence deadline and is degraded for this phase`,
      }), gate.getId())
      const span = state.spans.get(role)
      if (span !== undefined && span.completedAtMs === undefined) {
        sendEvent(event(SPAN_COMPLETED, gate.getId(), {
          role, reason: "evidence-deadline", detail: `${ROLE_CONFIG[role].name} phase closed without valid evidence at deadline`,
        }), gate.getId())
      }
    }
    if (changed) emitInvestigationGateDecision(state, gate.getId(), sendEvent, "evidence-deadline")
  }, evidenceDeadlineMs)

  const settled = await state.waitFor(() => {
    const respondersComplete = ROLES.every((role) => state.spans.get(role)?.completedAtMs !== undefined)
    if (!respondersComplete || state.gateDecision === "pending") return false
    if (dryRun && planningMode === "post-aggregation" && state.gateDecision === "blocked" && state.adaptations.length === 0) return false
    const expectedFollowupEvidence = simulateDependencyTimeout ? 1 : 2
    if (dryRun && planningMode === "post-aggregation" && state.gateDecision === "blocked" && state.evidence.length < expectedFollowupEvidence) return false
    if (dryRun && (!state.actionProposed || state.actionExecutedTool === null)) return false
    if (dryRun && planningMode === "speculative-bounded" && state.staleReplanRequired && state.actionAttempts.length < 2) return false
    if (!dryRun && !phase1Only && (!state.mitigationPhaseStarted || state.modelMitigationRecommendation === null)) return false
    if (!dryRun && phase1Only) {
      const phaseClosed = ROLES.every((role) =>
        state.spans.get(role)?.completedAtMs !== undefined
        && (state.hypotheses.some((item) => item.role === role) || state.degradedRoles.includes(role)))
      if (!phaseClosed) return false
    }
    return true
  }, timeoutMs)
  clearTimeout(evidenceDeadlineTimer)
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
