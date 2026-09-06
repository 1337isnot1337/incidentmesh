export type SafetyStressConfig = {
    seed: number;
    cases: number;
};
export type SafetyStressReport = {
    schema: "incidentmesh.safety-stress/v1";
    seed: number;
    cases: number;
    approvedSnapshots: number;
    blockedSnapshots: number;
    approvedCrossings: number;
    blockedRewrites: number;
    unauthorizedRollbackCrossings: number;
    snapshotMutationViolations: number;
    invariantViolations: Array<{
        case: number;
        reason: string;
    }>;
    generatedProfiles: Record<string, number>;
};
/**
 * Runs deterministic adversarial schedules against the immutable action boundary.
 * No timers, network calls, model calls, or host scheduler behavior are involved.
 */
export declare function runSafetyStress(config: SafetyStressConfig): Promise<SafetyStressReport>;
