import assert from "node:assert/strict"
import test from "node:test"
import { IncidentState, runIncidentScenario, overlapCount, parseModelHypothesis, requestCorroborationTool, SafetyGateInterception } from "./app.js"
import { FunctionCallItem } from "@mozaik-ai/core"
import type { ExecutableTransition } from "@mozaik-ai/core"

test("three independent responders overlap and publish hypotheses", async () => {
  const report = await runIncidentScenario({ dryRun: true })
  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.spans.length, 3)
  assert.equal(overlapCount(report), 3)
  assert.ok(report.timeline.some((item) => item.type === "incident.hypothesis.emitted"))
})

test("shared state changes the plan and surviving responders add evidence", async () => {
  const report = await runIncidentScenario({ dryRun: true })
  assert.equal(report.gateDecision, "blocked")
  assert.ok(report.contradictions >= 1)
  assert.equal(report.adaptations.length, 1)
  assert.equal(report.evidence.length, 2)
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

  const result = await requestCorroborationTool.invoke({ originalAction: "rollback_production", reason: "conflicting causes" }) as { status: string }
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
