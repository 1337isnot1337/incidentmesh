import assert from "node:assert/strict"
import test from "node:test"
import { providerPreflight } from "./provider-safety.js"

test("provider preflight rejects missing credentials before model loops start", () => {
  const result = providerPreflight("gpt-5.5", {})
  assert.deepEqual(result, {
    ok: false,
    model: "gpt-5.5",
    provider: "openai",
    acceptedCredentialNames: ["OPENAI_API_KEY"],
    error: "missing_provider_credential",
  })
})

test("provider preflight accepts the credential required by the selected model provider", () => {
  const result = providerPreflight("gpt-5.5", { OPENAI_API_KEY: "test-placeholder-not-a-real-key" })
  assert.equal(result.ok, true)
  assert.equal(result.provider, "openai")
})
