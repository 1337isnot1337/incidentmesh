import { FunctionCallItem } from "@mozaik-ai/core";
import { IncidentState, ROLES, SafetyGateInterception } from "./app.js";
class SeededRandom {
    state;
    constructor(seed) {
        this.state = seed >>> 0;
    }
    next() {
        // xorshift32 is deterministic across supported Node versions.
        let value = this.state || 0x9e3779b9;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        this.state = value >>> 0;
        return this.state;
    }
    int(maxExclusive) {
        return this.next() % maxExclusive;
    }
    chance(numerator, denominator = 100) {
        return this.int(denominator) < numerator;
    }
}
function rollbackTransition(callId) {
    const call = FunctionCallItem.rehydrate({ callId, name: "rollback_production", args: "{}" });
    return { nextStateId: "function_call", input: { call, inferenceInput: {} } };
}
function canaryTransition(callId, targetCause) {
    const call = FunctionCallItem.rehydrate({
        callId,
        name: "targeted_canary_probe",
        args: JSON.stringify({ service: "checkout-api", targetCause, scope: "five-percent-diagnostic-canary" }),
    });
    return { nextStateId: "function_call", input: { call, inferenceInput: {} } };
}
function shuffledRoles(random) {
    const roles = [...ROLES];
    for (let i = roles.length - 1; i > 0; i -= 1) {
        const j = random.int(i + 1);
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    return roles;
}
function rootCauseFor(profile, role) {
    if (profile === 1)
        return role === "trace" ? "cause-a" : role === "dependency" ? "cause-b" : "cause-c";
    return "shared-cause";
}
function confidenceFor(profile) {
    return profile === 2 ? 0.7 : 0.9;
}
/**
 * Runs deterministic adversarial schedules against the immutable action boundary.
 * No timers, network calls, model calls, or host scheduler behavior are involved.
 */
export async function runSafetyStress(config) {
    const random = new SeededRandom(config.seed);
    const report = {
        schema: "incidentmesh.safety-stress/v1",
        seed: config.seed >>> 0,
        cases: config.cases,
        approvedSnapshots: 0,
        blockedSnapshots: 0,
        approvedCrossings: 0,
        blockedRewrites: 0,
        unauthorizedRollbackCrossings: 0,
        staleNonSafeCrossings: 0,
        unauthorizedBoundedCrossings: 0,
        actionPolicyInvariantViolations: 0,
        attemptIsolationViolations: 0,
        stalePlanAttempts: 0,
        totalActionAttempts: 0,
        snapshotMutationViolations: 0,
        invariantViolations: [],
        generatedProfiles: {},
    };
    for (let caseIndex = 0; caseIndex < config.cases; caseIndex += 1) {
        const profile = random.int(6);
        const profileName = ["approved", "conflicting", "low-confidence", "missing", "adversarial", "late-evidence"][profile];
        report.generatedProfiles[profileName] = (report.generatedProfiles[profileName] ?? 0) + 1;
        const state = new IncidentState();
        const actionControllerId = `action-controller-${caseIndex}`;
        state.registerActionController(actionControllerId);
        const ids = new Map();
        for (const role of ROLES) {
            ids.set(role, { author: `${role}-author-${caseIndex}`, attacker: `${role}-attacker-${caseIndex}` });
            state.registerResponder(role, `${role}-author-${caseIndex}`);
        }
        const order = shuffledRoles(random);
        const omittedRole = profile === 3 || profile === 5 ? order[0] : null;
        const boundaryIndex = profile === 0 ? order.length : random.int(order.length + 1);
        const submitValid = (role) => {
            const confidence = confidenceFor(profile);
            state.acceptHypothesis(ids.get(role)?.author ?? "missing", {
                role,
                claim: `${role} generated claim`,
                confidence,
                rootCause: rootCauseFor(profile, role),
            });
        };
        for (let index = 0; index < order.length; index += 1) {
            const role = order[index];
            if (role === omittedRole && index < boundaryIndex)
                continue;
            if (profile === 4 || random.chance(20)) {
                state.acceptHypothesis(ids.get(role)?.attacker ?? "attacker", {
                    role, claim: `${role} spoofed claim`, confidence: 0.99, rootCause: "spoofed-cause",
                });
            }
            if (profile === 4 || random.chance(15)) {
                state.acceptHypothesis(ids.get(role)?.author ?? "missing", {
                    role, claim: `${role} malformed claim`, confidence: 2, rootCause: "malformed-cause",
                });
            }
            if (index < boundaryIndex)
                submitValid(role);
            if (index < boundaryIndex && random.chance(20))
                submitValid(role);
        }
        const plan = state.startPlan(actionControllerId);
        if (plan === null)
            throw new Error(`could not start stress plan for case ${caseIndex}`);
        const snapshot = state.captureActionBoundarySnapshot("rollback_production");
        const snapshotFingerprint = JSON.stringify(snapshot);
        // Late evidence is accepted into investigation state but must not mutate the snapshot.
        for (const role of ROLES) {
            if (!state.hypotheses.some((item) => item.role === role) && !state.degradedRoles.includes(role))
                submitValid(role);
        }
        if (JSON.stringify(snapshot) !== snapshotFingerprint) {
            report.snapshotMutationViolations += 1;
            report.invariantViolations.push({ case: caseIndex, reason: "boundary snapshot mutated after late evidence" });
        }
        const transition = rollbackTransition(`stress-${caseIndex}`);
        const rewritten = await new SafetyGateInterception(state, {
            producerId: actionControllerId,
            planId: plan.planId,
        }).handle(transition);
        const rewrittenCall = rewritten.input.call;
        const callName = rewrittenCall.name;
        const rollbackAttempt = state.actionAttempts.at(-1);
        if (rollbackAttempt === undefined)
            throw new Error(`missing rollback attempt for case ${caseIndex}`);
        if (rollbackAttempt.policyDecision === "approved") {
            report.approvedSnapshots += 1;
            report.approvedCrossings += 1;
            if (callName !== "rollback_production") {
                report.invariantViolations.push({ case: caseIndex, reason: "approved snapshot was unexpectedly rewritten" });
            }
        }
        else {
            report.blockedSnapshots += 1;
            report.blockedRewrites += 1;
            if (callName === "rollback_production") {
                report.unauthorizedRollbackCrossings += 1;
                report.invariantViolations.push({ case: caseIndex, reason: "blocked snapshot allowed rollback_production" });
            }
        }
        if (rollbackAttempt.fresh === false)
            report.stalePlanAttempts += 1;
        if (callName === "rollback_production" && rollbackAttempt.fresh === false)
            report.staleNonSafeCrossings += 1;
        const rollbackShouldCross = rollbackAttempt.fresh && rollbackAttempt.policyDecision === "approved";
        if ((callName === "rollback_production") !== rollbackShouldCross) {
            report.actionPolicyInvariantViolations += 1;
            report.invariantViolations.push({ case: caseIndex, reason: "rollback result disagreed with its own immutable attempt policy" });
        }
        const targetCause = state.hypotheses[0]?.rootCause ?? "no-authoritative-cause";
        const originalPlanCanary = canaryTransition(`stress-stale-canary-${caseIndex}`, targetCause);
        const originalPlanCanaryResult = await new SafetyGateInterception(state, {
            producerId: actionControllerId,
            planId: plan.planId,
        }).handle(originalPlanCanary);
        const originalPlanCanaryAttempt = state.actionAttempts.at(-1);
        if (originalPlanCanaryAttempt === undefined)
            throw new Error(`missing bounded attempt for case ${caseIndex}`);
        const originalPlanCanaryName = originalPlanCanaryResult.input.call.name;
        if (!originalPlanCanaryAttempt.fresh)
            report.stalePlanAttempts += 1;
        if (!originalPlanCanaryAttempt.fresh && originalPlanCanaryName === "targeted_canary_probe")
            report.staleNonSafeCrossings += 1;
        if (originalPlanCanaryName === "targeted_canary_probe" && originalPlanCanaryAttempt.policyDecision !== "approved") {
            report.unauthorizedBoundedCrossings += 1;
        }
        if ((originalPlanCanaryName === "targeted_canary_probe") !== (originalPlanCanaryAttempt.fresh && originalPlanCanaryAttempt.policyDecision === "approved")) {
            report.actionPolicyInvariantViolations += 1;
            report.invariantViolations.push({ case: caseIndex, reason: "bounded result disagreed with its own immutable attempt policy" });
        }
        const freshPlan = state.startPlan(actionControllerId);
        if (freshPlan === null)
            throw new Error(`could not start fresh stress plan for case ${caseIndex}`);
        const freshCanary = canaryTransition(`stress-fresh-canary-${caseIndex}`, targetCause);
        const freshCanaryResult = await new SafetyGateInterception(state, {
            producerId: actionControllerId,
            planId: freshPlan.planId,
        }).handle(freshCanary);
        const freshCanaryAttempt = state.actionAttempts.at(-1);
        if (freshCanaryAttempt === undefined)
            throw new Error(`missing fresh bounded attempt for case ${caseIndex}`);
        const freshCanaryName = freshCanaryResult.input.call.name;
        if (freshCanaryName === "targeted_canary_probe" && freshCanaryAttempt.policyDecision !== "approved") {
            report.unauthorizedBoundedCrossings += 1;
        }
        if ((freshCanaryName === "targeted_canary_probe") !== (freshCanaryAttempt.fresh && freshCanaryAttempt.policyDecision === "approved")) {
            report.actionPolicyInvariantViolations += 1;
            report.invariantViolations.push({ case: caseIndex, reason: "fresh bounded result disagreed with its own immutable attempt policy" });
        }
        const attemptIds = state.actionAttempts.map((attempt) => attempt.attemptId);
        report.totalActionAttempts += attemptIds.length;
        if (new Set(attemptIds).size !== attemptIds.length || state.actionAttempts.some((attempt) => !Object.isFrozen(attempt))) {
            report.attemptIsolationViolations += 1;
            report.invariantViolations.push({ case: caseIndex, reason: "action attempts were reused or mutable" });
        }
    }
    return report;
}
