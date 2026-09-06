import { FunctionCallItem } from "@mozaik-ai/core"
import type { ExecutableTransition } from "@mozaik-ai/core"
import { IncidentState, ROLES, SafetyGateInterception, type Role } from "./app.js"

export type SafetyStressConfig = {
  seed: number
  cases: number
}

export type SafetyStressReport = {
  schema: "incidentmesh.safety-stress/v1"
  seed: number
  cases: number
  approvedSnapshots: number
  blockedSnapshots: number
  approvedCrossings: number
  blockedRewrites: number
  unauthorizedRollbackCrossings: number
  snapshotMutationViolations: number
  invariantViolations: Array<{ case: number; reason: string }>
  generatedProfiles: Record<string, number>
}

class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    // xorshift32 is deterministic across supported Node versions.
    let value = this.state || 0x9e3779b9
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state
  }

  int(maxExclusive: number): number {
    return this.next() % maxExclusive
  }

  chance(numerator: number, denominator = 100): boolean {
    return this.int(denominator) < numerator
  }
}

function rollbackTransition(callId: string): Extract<ExecutableTransition, { nextStateId: "function_call" }> {
  const call = FunctionCallItem.rehydrate({ callId, name: "rollback_production", args: "{}" })
  return { nextStateId: "function_call", input: { call, inferenceInput: {} as never } }
}

function shuffledRoles(random: SeededRandom): Role[] {
  const roles = [...ROLES]
  for (let i = roles.length - 1; i > 0; i -= 1) {
    const j = random.int(i + 1)
    ;[roles[i], roles[j]] = [roles[j], roles[i]]
  }
  return roles
}

function rootCauseFor(profile: number, role: Role): string {
  if (profile === 1) return role === "trace" ? "cause-a" : role === "dependency" ? "cause-b" : "cause-c"
  return "shared-cause"
}

function confidenceFor(profile: number): number {
  return profile === 2 ? 0.7 : 0.9
}

/**
 * Runs deterministic adversarial schedules against the immutable action boundary.
 * No timers, network calls, model calls, or host scheduler behavior are involved.
 */
export async function runSafetyStress(config: SafetyStressConfig): Promise<SafetyStressReport> {
  const random = new SeededRandom(config.seed)
  const report: SafetyStressReport = {
    schema: "incidentmesh.safety-stress/v1",
    seed: config.seed >>> 0,
    cases: config.cases,
    approvedSnapshots: 0,
    blockedSnapshots: 0,
    approvedCrossings: 0,
    blockedRewrites: 0,
    unauthorizedRollbackCrossings: 0,
    snapshotMutationViolations: 0,
    invariantViolations: [],
    generatedProfiles: {},
  }

  for (let caseIndex = 0; caseIndex < config.cases; caseIndex += 1) {
    const profile = random.int(6)
    const profileName = ["approved", "conflicting", "low-confidence", "missing", "adversarial", "late-evidence"][profile]
    report.generatedProfiles[profileName] = (report.generatedProfiles[profileName] ?? 0) + 1

    const state = new IncidentState()
    const ids = new Map<Role, { author: string; attacker: string }>()
    for (const role of ROLES) {
      ids.set(role, { author: `${role}-author-${caseIndex}`, attacker: `${role}-attacker-${caseIndex}` })
      state.registerResponder(role, `${role}-author-${caseIndex}`)
    }

    const order = shuffledRoles(random)
    const omittedRole = profile === 3 || profile === 5 ? order[0] : null
    const boundaryIndex = profile === 0 ? order.length : random.int(order.length + 1)

    const submitValid = (role: Role): void => {
      const confidence = confidenceFor(profile)
      state.acceptHypothesis(ids.get(role)?.author ?? "missing", {
        role,
        claim: `${role} generated claim`,
        confidence,
        rootCause: rootCauseFor(profile, role),
      })
    }

    for (let index = 0; index < order.length; index += 1) {
      const role = order[index]
      if (role === omittedRole && index < boundaryIndex) continue
      if (profile === 4 || random.chance(20)) {
        state.acceptHypothesis(ids.get(role)?.attacker ?? "attacker", {
          role, claim: `${role} spoofed claim`, confidence: 0.99, rootCause: "spoofed-cause",
        })
      }
      if (profile === 4 || random.chance(15)) {
        state.acceptHypothesis(ids.get(role)?.author ?? "missing", {
          role, claim: `${role} malformed claim`, confidence: 2, rootCause: "malformed-cause",
        })
      }
      if (index < boundaryIndex) submitValid(role)
      if (index < boundaryIndex && random.chance(20)) submitValid(role)
    }

    const snapshot = state.captureActionBoundarySnapshot("rollback_production")
    const snapshotFingerprint = JSON.stringify(snapshot)
    if (snapshot.decision === "approved") report.approvedSnapshots += 1
    else report.blockedSnapshots += 1

    // Late evidence is accepted into investigation state but must not mutate the snapshot.
    for (const role of ROLES) {
      if (!state.hypotheses.some((item) => item.role === role) && !state.degradedRoles.includes(role)) submitValid(role)
    }
    if (JSON.stringify(snapshot) !== snapshotFingerprint) {
      report.snapshotMutationViolations += 1
      report.invariantViolations.push({ case: caseIndex, reason: "boundary snapshot mutated after late evidence" })
    }

    const transition = rollbackTransition(`stress-${caseIndex}`)
    const rewritten = await new SafetyGateInterception(state).handle(transition)
    const rewrittenCall = (rewritten as Extract<ExecutableTransition, { nextStateId: "function_call" }>).input.call
    const callName = rewrittenCall.name
    if (snapshot.decision === "approved") {
      report.approvedCrossings += 1
      if (callName !== "rollback_production") {
        report.invariantViolations.push({ case: caseIndex, reason: "approved snapshot was unexpectedly rewritten" })
      }
    } else {
      report.blockedRewrites += 1
      if (callName === "rollback_production") {
        report.unauthorizedRollbackCrossings += 1
        report.invariantViolations.push({ case: caseIndex, reason: "blocked snapshot allowed rollback_production" })
      }
    }
  }

  return report
}
