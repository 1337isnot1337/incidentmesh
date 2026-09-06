import assert from "node:assert/strict"
import test from "node:test"
import { IncidentState, runIncidentScenario, overlapCount, SafetyGateInterception } from "./app.js"
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
