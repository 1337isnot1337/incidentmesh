import { PLAN_REPLANNED, PLAN_STALE, ROLES, runIncidentScenario, } from "./app.js";
const SPECULATIVE_PLANNING_MS = 135;
function normalize(hypotheses) {
    return hypotheses
        .map(({ role, claim, confidence, rootCause }) => ({ role, claim, confidence, rootCause }))
        .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
}
function armFromReport(schedule, report) {
    const plan = report.action.plans[0];
    const attempt = report.action.attempts[0];
    if (plan === undefined || attempt === undefined)
        throw new Error(`${schedule} runtime did not produce a plan and action attempt`);
    const replanAttempt = report.action.attempts[1];
    const targetCause = plan.hypotheses.find((item) => item.role === "trace")?.rootCause;
    if (targetCause === undefined)
        throw new Error(`${schedule} plan did not freeze trace evidence`);
    const peerEvidenceDuringPlanning = report.hypotheses.some((item) => item.role !== "trace" && item.atMs >= plan.startedAtMs && item.atMs <= attempt.atMs);
    return {
        schedule,
        firstPlanningRevision: plan.basedOnRevision,
        candidateAction: "targeted_canary_probe",
        targetCause,
        peerEvidenceDuringPlanning,
        boundaryRevision: attempt.boundaryRevision,
        proposalFresh: attempt.fresh,
        policyDecision: attempt.policyDecision,
        policyReason: attempt.policyReason,
        boundedActionCrossed: attempt.policyDecision === "approved" && report.action.executedTool === "targeted_canary_probe",
        executedAction: report.action.executedTool,
        mozaikInterceptionObserved: report.timeline.some((item) => item.type === "mozaik.interception.started"),
        proposalRewritten: report.timeline.some((item) => item.type === "mozaik.interception.rewritten"),
        safeToolExecuted: report.timeline.some((item) => item.type === "incident.action.safe-executed"),
        finalDecisionRevision: report.action.decisionRevision,
        finalHypotheses: normalize(report.hypotheses),
        finalGateDecision: report.gateDecision,
        finalGateReason: report.gateReason,
        staleEventObserved: report.timeline.some((item) => item.type === PLAN_STALE && item.detail.includes(plan.planId)),
        freshReplan: replanAttempt === undefined ? null : {
            basedOnRevision: replanAttempt.basedOnRevision,
            boundaryRevision: replanAttempt.boundaryRevision,
            policyDecision: replanAttempt.policyDecision,
            policyReason: replanAttempt.policyReason,
            executedAction: report.action.executedTool,
        },
        rollbackAuthorizedByFinalStrictGate: report.gateDecision === "approved",
        attempts: report.action.attempts.map((item) => ({
            attemptId: item.attemptId,
            planId: item.planId,
            basedOnRevision: item.basedOnRevision,
            boundaryRevision: item.boundaryRevision,
            fresh: item.fresh,
            proposedAction: item.proposedAction,
            actionRisk: item.actionRisk,
            gateDecision: item.gateDecision,
            gateReason: item.gateReason,
            policyDecision: item.policyDecision,
            policyReason: item.policyReason,
            availableRoles: item.availableRoles,
            missingRequiredRoles: item.missingRequiredRoles,
            degradedRoles: item.degradedRoles,
            perRoleConfidence: item.perRoleConfidence,
            contradictions: item.contradictions,
            targetCause: item.targetCause,
        })),
    };
}
export async function runStalePlanAblation(input) {
    if (input.evidence.length !== ROLES.length || !ROLES.every((role) => input.evidence.filter((item) => item.role === role).length === 1)) {
        throw new Error("stale-plan ablation requires exactly one hypothesis for each required responder");
    }
    const eventualEvidence = input.evidence
        .map(({ role, claim, confidence, rootCause }) => ({ role, claim, confidence, rootCause }))
        .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
    const evidenceOverride = Object.fromEntries(eventualEvidence.map((item) => [item.role, {
            claim: item.claim,
            confidence: item.confidence,
            rootCause: item.rootCause,
        }]));
    const run = (scheduleMode) => runIncidentScenario({
        dryRun: true,
        planningMode: "speculative-bounded",
        scheduleMode,
        speculativePlanningMs: SPECULATIVE_PLANNING_MS,
        evidenceOverride,
    });
    const concurrentReport = await run("concurrent");
    const sequentialReport = await run("sequential");
    const concurrent = armFromReport("concurrent", concurrentReport);
    const sequential = armFromReport("sequential", sequentialReport);
    const invariants = {
        sameEventualEvidence: JSON.stringify(concurrent.finalHypotheses) === JSON.stringify(sequential.finalHypotheses),
        sameFirstPlanningRevision: concurrent.firstPlanningRevision === sequential.firstPlanningRevision,
        sameCandidateAction: concurrent.candidateAction === sequential.candidateAction && concurrent.targetCause === sequential.targetCause,
        concurrentProposalInvalidatedAsStale: concurrent.peerEvidenceDuringPlanning && !concurrent.proposalFresh
            && !concurrent.boundedActionCrossed && concurrent.staleEventObserved,
        concurrentFreshReplanSeesConflict: concurrent.freshReplan?.basedOnRevision === concurrent.finalDecisionRevision
            && concurrent.freshReplan.boundaryRevision === concurrent.finalDecisionRevision
            && concurrent.freshReplan.policyDecision === "blocked"
            && concurrent.freshReplan.policyReason === "conflicting-evidence"
            && concurrentReport.timeline.some((item) => item.type === PLAN_REPLANNED),
        sequentialProposalCrossedWhileFresh: !sequential.peerEvidenceDuringPlanning
            && sequential.proposalFresh && sequential.boundedActionCrossed,
        unauthorizedRollbackCrossings: Number(concurrent.executedAction === "rollback_production")
            + Number(sequential.executedAction === "rollback_production"),
        staleNonSafeCrossings: Number(!concurrent.proposalFresh && concurrent.boundedActionCrossed)
            + Number(!sequential.proposalFresh && sequential.boundedActionCrossed),
    };
    return {
        schema: "incidentmesh.stale-plan-ablation/v1",
        source: input.source,
        fixedInputs: {
            incident: concurrentReport.incident,
            eventualEvidence,
            planner: "same deterministic revision-stamped Action Controller running through Mozaik",
            candidateAction: "targeted_canary_probe",
            candidateTargetCause: eventualEvidence.find((item) => item.role === "trace")?.rootCause ?? "missing",
            actionPolicy: "fresh bounded probes require strong, non-degraded, non-contradictory authoritative evidence matching the target cause",
            proposalBoundary: `${SPECULATIVE_PLANNING_MS} ms configured deterministic planner-fixture duration after the same revision-1 start`,
        },
        changedVariable: "peer-evidence scheduling relative to the same in-flight plan",
        concurrent,
        sequential,
        invariants,
        causalFinding: "Concurrent responder progress advanced authoritative evidence while the planner was in flight, so the revision-1 bounded proposal was stale and could not execute. Serialization left that same proposal fresh at its boundary, so the bounded proposal crossed before the same later evidence exposed the wrong causal picture.",
        limitation: "The provider-generated hypotheses are frozen from one authenticated historical receipt. This deterministic Mozaik replay changes scheduling, not live provider timing. The canary is a bounded proposal-only fixture and performs no production mutation; configured fixture timing is not a production-latency claim.",
    };
}
