import { RuntimeState } from "@mozaik-ai/core";
import type { ExecutableTransition, InterceptionHandler, Tool } from "@mozaik-ai/core";
export declare const INCIDENT_OPENED = "incident.opened";
export declare const SPAN_STARTED = "incident.span.started";
export declare const HYPOTHESIS_EMITTED = "incident.hypothesis.emitted";
export declare const SPAN_COMPLETED = "incident.span.completed";
export declare const GATE_DECISION = "incident.gate.decision";
export declare const MITIGATION_REPLANNED = "incident.mitigation.replanned";
export declare const EVIDENCE_ADDED = "incident.evidence.added";
export declare const ROLES: readonly ["trace", "dependency", "impact"];
export type Role = (typeof ROLES)[number];
export type Hypothesis = {
    role: Role;
    claim: string;
    confidence: number;
    rootCause: string;
    atMs: number;
};
export type TimelineEvent = {
    atMs: number;
    type: string;
    producer: string;
    detail: string;
};
export type Span = {
    role: Role;
    startedAtMs: number;
    completedAtMs?: number;
};
export type IncidentReport = {
    schema: "incidentmesh.report/v1";
    incident: string;
    phase: "contained" | "investigating";
    gateDecision: "blocked" | "approved" | "pending";
    confidence: number;
    contradictions: number;
    hypotheses: Hypothesis[];
    evidence: string[];
    adaptations: string[];
    spans: Span[];
    timeline: TimelineEvent[];
    elapsedMs: number;
};
export declare class IncidentState extends RuntimeState {
    readonly incident = "checkout-api-us-east";
    readonly startedAt: number;
    readonly hypotheses: Hypothesis[];
    readonly evidence: string[];
    readonly adaptations: string[];
    readonly spans: Map<"trace" | "dependency" | "impact", Span>;
    readonly timeline: TimelineEvent[];
    gateDecision: IncidentReport["gateDecision"];
    confidence: number;
    contradictions: number;
    followupRequested: boolean;
    onTrace?: (event: TimelineEvent) => void;
    private readonly changeListeners;
    private notifyChange;
    waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean>;
    record(type: string, producer: string, detail: string): void;
    toReport(): IncidentReport;
}
export declare const requestCorroborationTool: Tool;
export declare class SafetyGateInterception implements InterceptionHandler {
    private readonly state;
    constructor(state: IncidentState);
    isSatisfiedBy(transition: ExecutableTransition): boolean;
    handle(transition: ExecutableTransition): Promise<ExecutableTransition>;
}
type ModelHypothesis = Pick<Hypothesis, "claim" | "confidence" | "rootCause">;
export declare function parseModelHypothesis(payload: unknown, role: Role): ModelHypothesis;
export type ScenarioOptions = {
    dryRun?: boolean;
    model?: string;
    maxOutputTokens?: number;
    timeoutMs?: number;
    trace?: (event: TimelineEvent) => void;
};
export declare function runIncidentScenario(options?: ScenarioOptions): Promise<IncidentReport>;
export declare function concurrencySpeedup(report: IncidentReport): number;
export declare function overlapCount(report: IncidentReport): number;
export {};
