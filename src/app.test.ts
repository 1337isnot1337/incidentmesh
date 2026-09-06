import assert from "node:assert/strict"
import test from "node:test"
import {
  IncidentState,
  ROLES,
  SafetyGateInterception,
  evaluateSafetyGate,
  overlapCount,
  parseModelHypothesis,
  requestCorroborationTool,
  runIncidentScenario,
  type Hypothesis,
  type Role,
} from "./app.js"
import { FunctionCallItem, ModelMessageItem, SemanticEvent } from "@mozaik-ai/core"
import type { ExecutableTransition, InferenceInput, InferenceOutput, InferenceRunner } from "@mozaik-ai/core"

function hypothesis(role: Role, confidence = 0.9, rootCause = "same-cause"): Hypothesis {
  return { role, claim: `${role} claim`, confidence, rootCause, atMs: 0 }
}

function rollbackTransition(callId: string): Extract<ExecutableTransition, { nextStateId: "function_call" }> {
  const call = FunctionCallItem.rehydrate({ callId, name: "rollback_production", args: "{}" })
  return { nextStateId: "function_call", input: { call, inferenceInput: {} as never } }
}

function normalizeHypotheses(report: Awaited<ReturnType<typeof runIncidentScenario>>) {
  return report.hypotheses
    .map(({ role, claim, confidence, rootCause }) => ({ role, claim, confidence, rootCause }))
    .sort((a, b) => a.role.localeCompare(b.role))
}

test("canonical concurrent path reaches real Mozaik interception with complete conflicting evidence", async () => {
  const report = await runIncidentScenario({ dryRun: true })
  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.spans.length, 3)
  assert.equal(overlapCount(report), 3)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "conflicting-evidence")
  assert.equal(report.contradictions, 2)
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.gateReasonAtBoundary, "conflicting-evidence")
  assert.equal(report.action.hypothesesAtBoundary, 3)
  assert.equal(report.action.contradictionsAtBoundary, 2)
  assert.deepEqual(report.action.boundarySnapshot?.missingRequiredRoles, [])
  assert.equal(report.action.boundarySafeAction, "canary-with-targeted-corroboration")
  assert.equal(report.action.actionableSafePlan, "canary-with-targeted-corroboration")
  assert.ok(report.action.actionableSafePlanAtMs !== null)
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.equal(report.adaptations.some((item) => item.includes("canary")), true)
  assert.equal(report.evidence.length, 2)
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.finished"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.function-call.started" && item.detail.includes("request_corroboration")))
  assert.ok(report.timeline.some((item) => item.type === "incident.action.safe-executed"))
  assert.equal(report.timeline.some((item) => item.type === "incident.action.rollback-tool-executed"), false)
})

test("pending investigation fails closed on the real sequential action path", async () => {
  const report = await runIncidentScenario({ dryRun: true, scheduleMode: "sequential", actionBoundaryMs: 205 })
  const snapshot = report.action.boundarySnapshot
  assert.ok(snapshot)
  assert.equal(snapshot.investigationDecision, "pending")
  assert.equal(snapshot.investigationReason, "pending-required-evidence")
  assert.equal(snapshot.decision, "blocked")
  assert.equal(snapshot.reason, "incomplete-required-evidence")
  assert.deepEqual(snapshot.availableRoles, ["trace"])
  assert.deepEqual(snapshot.missingRequiredRoles, ["dependency", "impact"])
  assert.equal(report.action.boundarySafeAction, "hold-for-missing-evidence")
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"))
  assert.equal(report.timeline.some((item) => item.type === "incident.action.rollback-tool-executed"), false)

  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "conflicting-evidence")
  assert.equal(report.contradictions, 2)
  assert.equal(report.action.boundarySnapshot?.reason, "incomplete-required-evidence")
})

test("fixed-boundary ablation changes only scheduling while both arms fail closed", async () => {
  const shared = { dryRun: true, actionProposalMs: 45, actionBoundaryMs: 205 } as const
  const concurrent = await runIncidentScenario({ ...shared, scheduleMode: "concurrent" })
  const sequential = await runIncidentScenario({ ...shared, scheduleMode: "sequential" })

  assert.deepEqual(normalizeHypotheses(concurrent), normalizeHypotheses(sequential))
  assert.equal(concurrent.action.boundaryMs, sequential.action.boundaryMs)
  assert.equal(concurrent.action.requestedTool, sequential.action.requestedTool)
  assert.equal(concurrent.action.gateAtBoundary, "blocked")
  assert.equal(sequential.action.gateAtBoundary, "blocked")
  assert.equal(concurrent.action.executedTool, "request_corroboration")
  assert.equal(sequential.action.executedTool, "request_corroboration")

  assert.equal(concurrent.action.gateReasonAtBoundary, "conflicting-evidence")
  assert.equal(concurrent.action.boundarySafeAction, "canary-with-targeted-corroboration")
  assert.equal(sequential.action.gateReasonAtBoundary, "incomplete-required-evidence")
  assert.equal(sequential.action.boundarySafeAction, "hold-for-missing-evidence")

  assert.equal(concurrent.action.hypothesesAtBoundary, 3)
  assert.equal(concurrent.action.contradictionsAtBoundary, 2)
  assert.equal(sequential.action.hypothesesAtBoundary, 1)
  assert.equal(sequential.action.contradictionsAtBoundary, 0)

  assert.ok(concurrent.action.actionableSafePlanAtMs !== null)
  assert.ok(sequential.action.actionableSafePlanAtMs !== null)
  assert.ok(
    concurrent.action.actionableSafePlanAtMs < sequential.action.actionableSafePlanAtMs,
    `expected concurrency to expose the actionable canary earlier: concurrent=${concurrent.action.actionableSafePlanAtMs}, sequential=${sequential.action.actionableSafePlanAtMs}`,
  )
})

test("gate policy distinguishes investigation waiting from fail-closed action decisions", () => {
  const unanimous = ROLES.map((role) => hypothesis(role, 0.9, "same-cause"))
  assert.deepEqual(evaluateSafetyGate(unanimous), {
    decision: "approved",
    reason: "sufficient-consistent-evidence",
    confidence: 0.9,
    contradictions: 0,
    availableRoles: ["trace", "dependency", "impact"],
    missingRequiredRoles: [],
  })

  const conflicting = [
    hypothesis("trace", 0.9, "cause-a"),
    hypothesis("dependency", 0.9, "cause-b"),
    hypothesis("impact", 0.9, "cause-a"),
  ]
  assert.equal(evaluateSafetyGate(conflicting).decision, "blocked")
  assert.equal(evaluateSafetyGate(conflicting).reason, "conflicting-evidence")

  const partial = [hypothesis("trace", 0.9, "cause-a")]
  assert.equal(evaluateSafetyGate(partial, [], "investigation").decision, "pending")
  assert.equal(evaluateSafetyGate(partial, [], "investigation").reason, "pending-required-evidence")
  assert.equal(evaluateSafetyGate(partial, [], "action-boundary").decision, "blocked")
  assert.equal(evaluateSafetyGate(partial, [], "action-boundary").reason, "incomplete-required-evidence")

  const weak = ROLES.map((role) => hypothesis(role, 0.7, "same-cause"))
  assert.equal(evaluateSafetyGate(weak).decision, "blocked")
  assert.equal(evaluateSafetyGate(weak).reason, "low-confidence-evidence")
})

test("rollback interception requires affirmative approval, not mere absence of a block", async () => {
  const pendingState = new IncidentState()
  const pendingGate = new SafetyGateInterception(pendingState)
  const pending = rollbackTransition("pending-rollback")
  assert.equal(pendingGate.isSatisfiedBy(pending), true)
  const rewrittenPending = await pendingGate.handle(pending)
  assert.equal((rewrittenPending as typeof pending).input.call.name, "request_corroboration")

  const blockedState = new IncidentState()
  blockedState.gateDecision = "blocked"
  blockedState.gateReason = "conflicting-evidence"
  assert.equal(new SafetyGateInterception(blockedState).isSatisfiedBy(rollbackTransition("blocked-rollback")), true)

  const approvedState = new IncidentState()
  approvedState.gateDecision = "approved"
  approvedState.gateReason = "sufficient-consistent-evidence"
  assert.equal(new SafetyGateInterception(approvedState).isSatisfiedBy(rollbackTransition("approved-rollback")), false)

  const safeCall = FunctionCallItem.rehydrate({ callId: "safe", name: "request_corroboration", args: "{}" })
  const safeTransition = { nextStateId: "function_call" as const, input: { call: safeCall, inferenceInput: {} as never } }
  assert.equal(pendingGate.isSatisfiedBy(safeTransition as Extract<ExecutableTransition, { nextStateId: "function_call" }>), false)

  const result = await requestCorroborationTool.invoke({ originalAction: "rollback_production", reason: "incomplete-required-evidence" }) as { status: string }
  assert.equal(result.status, "blocked-pending-corroboration")
})

test("action-boundary snapshot is immutable while late evidence updates investigation state", () => {
  const state = new IncidentState()
  state.registerResponder("trace", "trace-id")
  state.registerResponder("dependency", "dependency-id")
  state.registerResponder("impact", "impact-id")
  assert.equal(state.acceptHypothesis("trace-id", {
    role: "trace", claim: "trace claim", confidence: 0.9, rootCause: "cause-a",
  }).status, "accepted")

  const snapshot = state.captureActionBoundarySnapshot("rollback_production")
  const serialized = JSON.stringify(snapshot)
  assert.equal(Object.isFrozen(snapshot), true)
  assert.equal(Object.isFrozen(snapshot.availableRoles), true)
  assert.equal(Object.isFrozen(snapshot.missingRequiredRoles), true)
  assert.equal(snapshot.decision, "blocked")
  assert.equal(snapshot.reason, "incomplete-required-evidence")

  assert.equal(state.acceptHypothesis("dependency-id", {
    role: "dependency", claim: "dependency claim", confidence: 0.9, rootCause: "cause-b",
  }).status, "late-accepted")
  assert.equal(state.acceptHypothesis("impact-id", {
    role: "impact", claim: "impact claim", confidence: 0.9, rootCause: "cause-c",
  }).status, "late-accepted")

  assert.equal(state.hypotheses.length, 3)
  assert.equal(state.contradictions, 2)
  assert.equal(JSON.stringify(snapshot), serialized)
  assert.deepEqual(snapshot.availableRoles, ["trace"])
  assert.deepEqual(snapshot.missingRequiredRoles, ["dependency", "impact"])
  assert.equal(evaluateSafetyGate(state.hypotheses).reason, "conflicting-evidence")
})

test("producer identity, unknown roles, and duplicate policy cannot alter safety aggregates", () => {
  const state = new IncidentState()
  state.registerResponder("trace", "trace-id")
  state.registerResponder("dependency", "dependency-id")
  state.registerResponder("impact", "impact-id")

  const trace = { role: "trace", claim: "trace claim", confidence: 0.9, rootCause: "cause-a" }
  assert.equal(state.acceptHypothesis("trace-id", trace).status, "accepted")
  assert.equal(state.acceptHypothesis("trace-id", { ...trace, confidence: 1, rootCause: "cause-b" }).status, "duplicate")
  assert.equal(state.acceptHypothesis("impact-id", { ...trace, confidence: 0.99 }).status, "spoofed-role")
  assert.equal(state.acceptHypothesis("attacker-id", {
    role: "unknown", claim: "spoof", confidence: 0.99, rootCause: "cause-z",
  }).status, "unknown-role")

  assert.equal(state.hypotheses.length, 1)
  assert.equal(state.confidence, 0.9)
  assert.equal(state.contradictions, 0)
  assert.equal(state.hypotheses[0].rootCause, "cause-a")
})

test("invalid confidence is rejected and can never improve the gate posture", () => {
  const badValues: unknown[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.2, 1.4, "0.9", undefined]
  for (const confidence of badValues) {
    const state = new IncidentState()
    state.registerResponder("dependency", "dependency-id")
    const result = state.acceptHypothesis("dependency-id", {
      role: "dependency", claim: "dependency claim", confidence, rootCause: "same-cause",
    })
    assert.equal(result.status, "malformed", `confidence=${String(confidence)}`)
    assert.equal(state.hypotheses.length, 0)
    assert.deepEqual(state.degradedRoles, ["dependency"])
    const boundary = evaluateSafetyGate(state.hypotheses, state.degradedRoles, "action-boundary")
    assert.equal(boundary.decision, "blocked")
    assert.equal(boundary.reason, "incomplete-required-evidence")
  }

  assert.equal(parseModelHypothesis({ answer: { content: { text: "not-json" } } }, "dependency"), null)
  assert.equal(parseModelHypothesis({
    answer: { content: { text: JSON.stringify({ claim: "bad", confidence: 2, rootCause: "cause" }) } },
  }, "dependency"), null)
})

test("valid structured model evidence preserves provider confidence and root cause", () => {
  const parsed = parseModelHypothesis({
    answer: { content: { text: JSON.stringify({ claim: "pool wait follows deploy", confidence: 0.83, rootCause: "deploy-pool-regression" }) } },
  }, "dependency")
  assert.deepEqual(parsed, {
    claim: "pool wait follows deploy",
    confidence: 0.83,
    rootCause: "deploy-pool-regression",
  })
})

test("explicit Dependency timeout degrades the role and terminates through the safe tool", async () => {
  const report = await runIncidentScenario({ dryRun: true, simulateDependencyTimeout: true })
  assert.deepEqual(report.degradedRoles, ["dependency"])
  assert.equal(report.hypotheses.length, 2)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "incomplete-required-evidence")
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.gateReasonAtBoundary, "incomplete-required-evidence")
  assert.deepEqual(report.action.boundarySnapshot?.missingRequiredRoles, ["dependency"])
  assert.equal(report.action.boundarySafeAction, "hold-for-missing-evidence")
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.equal(report.evidence.length, 1)
  assert.ok(report.timeline.some((item) => item.type === "incident.responder.degraded" && item.producer === "Dependency"))
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), false)
})

class ScriptedTwoPhaseInferenceRunner implements InferenceRunner {
  readonly mitigationPrompts: string[] = []

  constructor(
    private readonly hangDependency = false,
    private readonly consistentEvidence = false,
  ) {}

  async run(request: InferenceInput): Promise<InferenceOutput> {
    const items = request.context.getItems()
    const userMessages = items.flatMap((item) => {
      const candidate = item as unknown as { role?: string; content?: { text?: unknown } }
      return candidate.role === "user" && typeof candidate.content?.text === "string" ? [candidate.content.text] : []
    })
    const prompt = userMessages.at(-1) ?? ""
    const hasToolOutput = items.some((item) => item.type === "function_call_output")

    if (prompt.includes("mitigation owner in IncidentMesh")) {
      if (!this.mitigationPrompts.includes(prompt)) this.mitigationPrompts.push(prompt)
      if (!hasToolOutput) {
        return {
          items: [FunctionCallItem.rehydrate({
            callId: "scripted-provider-rollback",
            name: "rollback_production",
            args: JSON.stringify({ service: "checkout-api", reason: "restore checkout quickly" }),
          })],
          tokenUsage: undefined,
          rowResponse: { fixture: "provider-phase-2-rollback" },
        }
      }
      return {
        items: [ModelMessageItem.rehydrate({ text: "Use a 5% canary only after the required corroboration is available." })],
        tokenUsage: undefined,
        rowResponse: { fixture: "provider-phase-2-recommendation" },
      }
    }

    const role = prompt.includes("trace responder") ? "trace"
      : prompt.includes("dependency responder") ? "dependency"
        : prompt.includes("impact responder") ? "impact"
          : null
    assert.ok(role, `unexpected scripted inference prompt: ${prompt}`)

    if (role === "dependency" && this.hangDependency) {
      return await new Promise<InferenceOutput>(() => {})
    }

    const fixture = role === "trace"
      ? { claim: "trace sees cache churn", confidence: 0.85, rootCause: this.consistentEvidence ? "shared-cause" : "cache-stampede" }
      : role === "dependency"
        ? { claim: "dependency sees deploy-linked pool wait", confidence: 0.82, rootCause: this.consistentEvidence ? "shared-cause" : "deploy-8f3" }
        : { claim: "impact sees regional checkout failures", confidence: 0.88, rootCause: this.consistentEvidence ? "shared-cause" : "regional-impact" }
    return {
      items: [ModelMessageItem.rehydrate({ text: JSON.stringify(fixture) })],
      tokenUsage: undefined,
      rowResponse: { fixture: `provider-phase-1-${role}` },
    }
  }

  async *stream(request: InferenceInput): AsyncGenerator<SemanticEvent> {
    yield SemanticEvent.create("inference.output", "scripted-two-phase-runner", await this.run(request))
  }
}

test("phase-1-only model runs settle as soon as all provider hypotheses complete", async () => {
  const report = await runIncidentScenario({
    dryRun: false,
    phase1Only: true,
    inferenceRunner: new ScriptedTwoPhaseInferenceRunner(),
    timeoutMs: 2_000,
  })

  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "conflicting-evidence")
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), false)
  assert.ok(report.elapsedMs < 2_000)
})

test("two-phase scripted model integration traverses the real post-aggregation interceptor", async () => {
  const runner = new ScriptedTwoPhaseInferenceRunner()
  const report = await runIncidentScenario({ dryRun: false, inferenceRunner: runner, timeoutMs: 2_000 })

  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "conflicting-evidence")
  assert.equal(report.action.mitigationPhaseStarted, true)
  assert.equal(report.action.proposed, true)
  assert.equal(report.action.requestedTool, "rollback_production")
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.gateReasonAtBoundary, "conflicting-evidence")
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.equal(report.action.boundaryMs, null)
  assert.match(report.action.modelRecommendation ?? "", /5% canary/)
  assert.ok(report.timeline.some((item) => item.type === "incident.mitigation.phase-started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"))
  assert.ok(report.timeline.some((item) => item.type === "incident.action.safe-executed"))
  assert.equal(report.timeline.some((item) => item.type === "incident.action.rollback-tool-executed"), false)

  assert.equal(runner.mitigationPrompts.length, 1)
  const mitigationPrompt = runner.mitigationPrompts[0]
  assert.match(mitigationPrompt, /cache-stampede/)
  assert.match(mitigationPrompt, /deploy-8f3/)
  assert.match(mitigationPrompt, /regional-impact/)
  assert.match(mitigationPrompt, /Safety Gate: blocked \(conflicting-evidence\)/)
})

test("approved evidence allows the proposal-only rollback path without interception", async () => {
  const report = await runIncidentScenario({
    dryRun: false,
    inferenceRunner: new ScriptedTwoPhaseInferenceRunner(false, true),
    timeoutMs: 2_000,
  })

  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.gateDecision, "approved")
  assert.equal(report.gateReason, "sufficient-consistent-evidence")
  assert.equal(report.action.gateAtBoundary, "approved")
  assert.equal(report.action.intercepted, false)
  assert.equal(report.action.executedTool, "rollback_production")
  assert.equal(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"), false)
  assert.ok(report.timeline.some((item) => item.type === "incident.action.rollback-tool-executed"))
  assert.match(report.action.modelRecommendation ?? "", /5% canary/)
})

test("a generally hanging required model responder degrades at the evidence deadline", async () => {
  const runner = new ScriptedTwoPhaseInferenceRunner(true)
  const report = await runIncidentScenario({
    dryRun: false,
    inferenceRunner: runner,
    timeoutMs: 1_500,
    evidenceDeadlineMs: 150,
  })

  assert.deepEqual(report.degradedRoles, ["dependency"])
  assert.deepEqual(report.hypotheses.map((item) => item.role).sort(), ["impact", "trace"])
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "incomplete-required-evidence")
  assert.equal(report.action.mitigationPhaseStarted, true)
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.gateReasonAtBoundary, "incomplete-required-evidence")
  assert.deepEqual(report.action.boundarySnapshot?.missingRequiredRoles, ["dependency"])
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.ok(report.action.modelRecommendation)
  assert.ok(report.timeline.some((item) => item.type === "incident.responder.degraded" && item.detail.includes("evidence deadline")))
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), false)
})

test("an early scenario timeout returns a stable pending investigation snapshot", async () => {
  const report = await runIncidentScenario({ dryRun: true, timeoutMs: 150 })
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), true)
  assert.equal(report.gateDecision, "pending")
  assert.equal(report.gateReason, "pending-required-evidence")
  assert.equal(report.hypotheses.length, 2)
  assert.equal(report.action.proposed, true)
  assert.equal(report.action.attemptedAtMs, null)
  assert.equal(report.action.boundarySnapshot, null)
  assert.equal(report.action.intercepted, false)
  assert.equal(report.action.executedTool, null)
  const snapshot = JSON.stringify(report)
  await new Promise((resolve) => setTimeout(resolve, 160))
  assert.equal(JSON.stringify(report), snapshot)
})
