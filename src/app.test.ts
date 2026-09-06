import assert from "node:assert/strict"
import test from "node:test"
import { IncidentState, runIncidentScenario, overlapCount, parseModelHypothesis, requestCorroborationTool, SafetyGateInterception } from "./app.js"
import { FunctionCallItem, ModelMessageItem, SemanticEvent } from "@mozaik-ai/core"
import type { ExecutableTransition, InferenceInput, InferenceOutput, InferenceRunner } from "@mozaik-ai/core"

test("three independent responders overlap and publish hypotheses", async () => {
  const report = await runIncidentScenario({ dryRun: true })
  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.spans.length, 3)
  assert.equal(overlapCount(report), 3)
  assert.ok(report.timeline.some((item) => item.type === "incident.hypothesis.emitted"))
  const spanByName = new Map(report.spans.map((span) => [span.role === "trace" ? "Trace" : span.role === "dependency" ? "Dependency" : "Impact", span]))
  const peerObservations = report.timeline.filter((item) => item.type === "awareness.peer-observed")
  assert.ok(peerObservations.length >= 4)
  const activePeerObservations = peerObservations.filter((observation) => {
    const span = spanByName.get(observation.producer)
    return span !== undefined
      && observation.atMs >= span.startedAtMs
      && observation.atMs <= (span.completedAtMs ?? Number.POSITIVE_INFINITY)
  })
  assert.ok(activePeerObservations.length >= 3)
})

test("shared state changes the plan and surviving responders add evidence", async () => {
  const report = await runIncidentScenario({ dryRun: true })
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.contradictions, 2)
  assert.ok(report.confidence >= 0.8)
  assert.equal(report.adaptations.length, 1)
  assert.equal(report.evidence.length, 2)
  assert.equal(report.action.proposed, true)
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.hypothesesAtBoundary, 3)
  assert.equal(report.action.contradictionsAtBoundary, 2)
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.finished"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.function-call.started" && item.detail.includes("request_corroboration")))
  assert.ok(report.timeline.some((item) => item.type === "incident.action.safe-executed"))
})

test("safety interception rewrites a risky function call after the gate blocks", async () => {
  const report = await runIncidentScenario({ dryRun: true })
  const state = new IncidentState()
  state.gateDecision = report.gateDecision
  const gate = new SafetyGateInterception(state)
  const call = FunctionCallItem.rehydrate({ callId: "c1", name: "rollback_production", args: "{}" })
  const transition = { nextStateId: "function_call" as const, input: { call, inferenceInput: {} as never } }
  const rewritten = await gate.handle(transition as Extract<ExecutableTransition, { nextStateId: "function_call" }>)
  const rewrittenCall = (rewritten as Extract<ExecutableTransition, { nextStateId: "function_call" }>).input.call
  assert.equal(rewrittenCall.name, "request_corroboration")
})

test("blocked gate intercepts rollback only and the safe replacement is executable", async () => {
  const state = new IncidentState()
  state.gateDecision = "blocked"
  const gate = new SafetyGateInterception(state)
  const rollback = FunctionCallItem.rehydrate({ callId: "c2", name: "rollback_production", args: "{}" })
  const rollbackTransition = { nextStateId: "function_call" as const, input: { call: rollback, inferenceInput: {} as never } }
  assert.equal(gate.isSatisfiedBy(rollbackTransition as Extract<ExecutableTransition, { nextStateId: "function_call" }>), true)

  const alreadySafe = FunctionCallItem.rehydrate({ callId: "c3", name: "request_corroboration", args: "{}" })
  const safeTransition = { nextStateId: "function_call" as const, input: { call: alreadySafe, inferenceInput: {} as never } }
  assert.equal(gate.isSatisfiedBy(safeTransition as Extract<ExecutableTransition, { nextStateId: "function_call" }>), false)

  const result = await requestCorroborationTool.invoke({ originalAction: "rollback_production", reason: "root-cause hypotheses disagree" }) as { status: string }
  assert.equal(result.status, "blocked-pending-corroboration")
})

test("scenario returns when the event-driven incident settles instead of sleeping a fixed window", async () => {
  const report = await runIncidentScenario({ dryRun: true })
  const lastEventMs = Math.max(...report.timeline.map((item) => item.atMs))
  assert.ok(report.elapsedMs - lastEventMs < 100, `report lagged last event by ${report.elapsedMs - lastEventMs}ms`)
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), false)
})

test("model hypotheses preserve structured confidence and root cause", () => {
  const hypothesis = parseModelHypothesis({
    answer: { content: { text: JSON.stringify({ claim: "pool wait follows deploy", confidence: 0.83, rootCause: "deploy-pool-regression" }) } },
  }, "dependency")
  assert.deepEqual(hypothesis, {
    claim: "pool wait follows deploy",
    confidence: 0.83,
    rootCause: "deploy-pool-regression",
  })
})

test("timeout returns a stable partial snapshot and keeps the gate conservative", async () => {
  const report = await runIncidentScenario({ dryRun: true, timeoutMs: 150 })
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), true)
  assert.equal(report.gateDecision, "pending")
  assert.equal(report.hypotheses.length, 2)
  assert.equal(report.adaptations.length, 0)
  assert.equal(report.action.proposed, true)
  assert.equal(report.action.attemptedAtMs, null)
  assert.equal(report.action.gateAtBoundary, null)
  assert.equal(report.action.intercepted, false)
  assert.equal(report.action.executedTool, null)
  const snapshot = JSON.stringify(report)
  await new Promise((resolve) => setTimeout(resolve, 160))
  assert.equal(JSON.stringify(report), snapshot)
})


test("fixed action-boundary ablation changes only evidence scheduling and changes the intercepted tool", async () => {
  const shared = { dryRun: true, actionProposalMs: 45, actionBoundaryMs: 205 } as const
  const concurrent = await runIncidentScenario({ ...shared, scheduleMode: "concurrent" })
  const sequential = await runIncidentScenario({ ...shared, scheduleMode: "sequential" })
  const normalize = (report: typeof concurrent) => report.hypotheses
    .map(({ role, claim, confidence, rootCause }) => ({ role, claim, confidence, rootCause }))
    .sort((a, b) => a.role.localeCompare(b.role))
  assert.deepEqual(normalize(concurrent), normalize(sequential))
  assert.equal(concurrent.action.boundaryMs, sequential.action.boundaryMs)
  assert.equal(concurrent.action.gateAtBoundary, "blocked")
  assert.equal(concurrent.action.executedTool, "request_corroboration")
  assert.equal(sequential.action.gateAtBoundary, "approved")
  assert.equal(sequential.action.executedTool, "rollback_production")
  assert.equal(sequential.gateDecision, "blocked")
  assert.equal(sequential.contradictions, 2)
})

test("dependency timeout is explicit shared state and the action boundary fails closed", async () => {
  const report = await runIncidentScenario({ dryRun: true, simulateDependencyTimeout: true })
  assert.deepEqual(report.degradedRoles, ["dependency"])
  assert.equal(report.hypotheses.length, 2)
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.evidence.length, 1)
  assert.ok(report.timeline.some((item) => item.type === "incident.responder.degraded" && item.producer === "Dependency"))
})


class ScriptedTwoPhaseInferenceRunner implements InferenceRunner {
  readonly mitigationPrompts: string[] = []

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
        items: [ModelMessageItem.rehydrate({ text: "Use a 5% canary and collect corroboration before any broader production change." })],
        tokenUsage: undefined,
        rowResponse: { fixture: "provider-phase-2-recommendation" },
      }
    }

    const role = prompt.includes("trace responder") ? "trace"
      : prompt.includes("dependency responder") ? "dependency"
        : prompt.includes("impact responder") ? "impact"
          : null
    assert.ok(role, `unexpected scripted inference prompt: ${prompt}`)
    const fixture = role === "trace"
      ? { claim: "trace sees cache churn", confidence: 0.85, rootCause: "cache-stampede" }
      : role === "dependency"
        ? { claim: "dependency sees deploy-linked pool wait", confidence: 0.82, rootCause: "deploy-8f3" }
        : { claim: "impact sees regional checkout failures", confidence: 0.88, rootCause: "regional-impact" }
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

test("model-mode lifecycle has a reachable post-aggregation interception phase", async () => {
  const runner = new ScriptedTwoPhaseInferenceRunner()
  const report = await runIncidentScenario({ dryRun: false, inferenceRunner: runner, timeoutMs: 2_000 })

  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.action.mitigationPhaseStarted, true)
  assert.equal(report.action.proposed, true)
  assert.equal(report.action.requestedTool, "rollback_production")
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.equal(report.action.boundaryMs, null)
  assert.match(report.action.modelRecommendation ?? "", /5% canary/)
  assert.ok(report.timeline.some((item) => item.type === "incident.mitigation.phase-started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"))
  assert.ok(report.timeline.some((item) => item.type === "incident.action.safe-executed"))
  assert.ok(report.timeline.some((item) => item.type === "incident.mitigation.replanned" && item.detail.includes("5% canary")))

  assert.equal(runner.mitigationPrompts.length, 1)
  const mitigationPrompt = runner.mitigationPrompts[0]
  assert.match(mitigationPrompt, /cache-stampede/)
  assert.match(mitigationPrompt, /deploy-8f3/)
  assert.match(mitigationPrompt, /regional-impact/)
  assert.match(mitigationPrompt, /Safety Gate: blocked/)
})
