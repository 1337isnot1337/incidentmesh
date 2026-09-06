# Gemini Phase-2 compatibility investigation

Status: **default adapter limitation reproduced; opt-in compatibility runner verified with an authenticated Gemini Flash-Lite Phase-2 receipt.**

The original authenticated Phase-1 capture succeeded with `gemini-3.5-flash`. A full Phase-2 attempt using the default adapter reached the Action Controller's tool-call continuation, then Gemini returned HTTP 400 because the follow-up function-call parts did not contain the required `thought_signature`.

The installed adapter explains the failure:

- `FunctionCallItem` stores only `callId`, `name`, and serialized `args`; it has no thought-signature field.
- `GeminiGenerateContentMapper.mapContextItems()` reconstructs a prior call as `{ functionCall: { id, name, args } }`.
- The mapper does not preserve or emit Gemini's `thought_signature` metadata on the model function-call part.

This is a provider-context serialization incompatibility, not a credential failure or an IncidentMesh safety decision. The repository's scripted two-phase test proved the lifecycle while the compatibility path was being developed; the authenticated [Gemini Flash-Lite receipt](real-provider-run.md) now proves the same Mozaik interception → rewritten safe tool → follow-up model-answer lifecycle with a real provider.

No repeated provider calls were made during this investigation. `npm view @mozaik-ai/core version` reports `4.0.5`, the version already installed; no compatible upstream upgrade was available to test.

The default adapter still has this limitation. IncidentMesh uses an opt-in runner that retains the provider signature privately and emits it on the continuation; this does not alter IncidentState or Safety Gate policy.

The capture CLI now exposes `--reasoning-effort none` for a controlled compatibility experiment. This is intentionally opt-in and unverified without a credential; it does not change the default model configuration or bypass the interceptor.

An opt-in `GEMINI_SIGNATURE_COMPAT=1` mode now uses a custom Mozaik `InferenceRunner` that retains returned signatures privately and includes them on the next function-call continuation. Local mocked tests verify both the wire round trip and the complete Mozaik Phase-2 interception → safe tool → follow-up recommendation lifecycle. The bounded authenticated Flash-Lite receipt validates this path once; it remains an opt-in compatibility measure rather than a claim that the upstream adapter has changed.
