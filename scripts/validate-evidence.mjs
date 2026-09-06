#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const forbidden = [
  { name: "OpenAI-style secret", pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/i },
  { name: "Bearer credential", pattern: /\bBearer\s+\S+/i },
  { name: "api_key assignment", pattern: /\bapi[_-]?key\s*[:=]\s*\S+/i },
  { name: "authorization assignment", pattern: /\bauthorization\s*[:=]\s*\S+/i },
  { name: "OPENAI_API_KEY assignment", pattern: /\bOPENAI_API_KEY\s*=/i },
  { name: "ANTHROPIC_API_KEY assignment", pattern: /\bANTHROPIC_API_KEY\s*=/i },
  { name: "GOOGLE_API_KEY assignment", pattern: /\bGOOGLE_API_KEY\s*=/i },
  { name: "GEMINI_API_KEY assignment", pattern: /\bGEMINI_API_KEY\s*=/i },
  { name: "DEEPSEEK_API_KEY assignment", pattern: /\bDEEPSEEK_API_KEY\s*=/i },
  { name: "workspace path", pattern: /\/workspace\//i },
  { name: "home path", pattern: /\/home\/[A-Za-z0-9._-]+\//i },
  { name: "Windows user path", pattern: /[A-Za-z]:\\Users\\[^\\\s]+\\/i },
]

function usage() {
  console.log("usage: node scripts/validate-evidence.mjs <evidence.json|evidence.md> [...]")
}

const responderNames = new Map([
  ["trace", "Trace"],
  ["dependency", "Dependency"],
  ["impact", "Impact"],
])

function assertFiniteTime(value, label, displayPath) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${displayPath}: ${label} must be a finite non-negative number`)
  }
}

function assertEvidenceShape(file, displayPath, text) {
  if (!file.endsWith(".json")) return
  const value = JSON.parse(text)
  if (value?.schema !== "incidentmesh.provider-evidence/v1") {
    throw new Error(`${displayPath}: unexpected or missing evidence schema`)
  }
  for (const key of ["commit", "provider", "model", "startedAt", "completedAt", "participants", "events", "overlap", "gateDecision", "interceptionObserved", "action", "hypotheses", "inferenceEvents", "limitations"]) {
    if (!(key in value)) throw new Error(`${displayPath}: missing required field ${key}`)
  }
  if (!Array.isArray(value.participants) || !Array.isArray(value.events) || !Array.isArray(value.hypotheses)
    || !Array.isArray(value.inferenceEvents) || !Array.isArray(value.limitations)) {
    throw new Error(`${displayPath}: participants, events, hypotheses, inferenceEvents, and limitations must be arrays`)
  }

  for (const role of responderNames.keys()) {
    const hypotheses = value.hypotheses.filter((item) => item?.role === role)
    if (hypotheses.length !== 1) throw new Error(`${displayPath}: expected exactly one accepted ${role} hypothesis`)
    const hypothesis = hypotheses[0]
    if (typeof hypothesis.claim !== "string" || hypothesis.claim.trim().length === 0
      || typeof hypothesis.rootCause !== "string" || hypothesis.rootCause.trim().length === 0
      || typeof hypothesis.confidence !== "number" || !Number.isFinite(hypothesis.confidence)
      || hypothesis.confidence < 0 || hypothesis.confidence > 1) {
      throw new Error(`${displayPath}: invalid accepted ${role} hypothesis`)
    }
  }

  const timelineInferenceEvents = value.events.filter((item) =>
    item?.type === "mozaik.inference.started" || item?.type === "mozaik.inference.completed")
  if (JSON.stringify(timelineInferenceEvents) !== JSON.stringify(value.inferenceEvents)) {
    throw new Error(`${displayPath}: inferenceEvents must exactly match inference lifecycle events in the primary timeline`)
  }

  const intervals = []
  for (const [role, producer] of responderNames) {
    const starts = timelineInferenceEvents.filter((item) => item?.type === "mozaik.inference.started" && item?.producer === producer)
    const completions = timelineInferenceEvents.filter((item) => item?.type === "mozaik.inference.completed" && item?.producer === producer)
    if (starts.length !== 1 || completions.length !== 1) {
      throw new Error(`${displayPath}: expected exactly one inference start/completion pair for ${role}`)
    }
    const startedAtMs = starts[0].atMs
    const completedAtMs = completions[0].atMs
    assertFiniteTime(startedAtMs, `${role} inference start`, displayPath)
    assertFiniteTime(completedAtMs, `${role} inference completion`, displayPath)
    if (completedAtMs <= startedAtMs) throw new Error(`${displayPath}: ${role} inference completion must follow its start`)
    intervals.push({ role, startedAtMs, completedAtMs })
  }

  const commonStartMs = Math.max(...intervals.map((item) => item.startedAtMs))
  const commonEndMs = Math.min(...intervals.map((item) => item.completedAtMs))
  if (commonEndMs <= commonStartMs) {
    throw new Error(`${displayPath}: responder inference windows do not have positive three-way overlap`)
  }
}

const files = process.argv.slice(2)
if (files.length === 0 || files.includes("--help") || files.includes("-h")) {
  usage()
  process.exit(files.length === 0 ? 2 : 0)
}

let failures = 0
for (const input of files) {
  const file = resolve(input)
  const displayPath = input
  let text
  try {
    text = readFileSync(file, "utf8")
    assertEvidenceShape(file, displayPath, text)
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error))
    failures += 1
    continue
  }

  const matches = forbidden.filter(({ pattern }) => pattern.test(text))
  if (matches.length > 0) {
    console.error(`${displayPath}: rejected: ${matches.map(({ name }) => name).join(", ")}`)
    failures += 1
  } else {
    const proof = file.endsWith(".json") ? "structure, three-role inference proof, and " : ""
    console.log(`${displayPath}: evidence ${proof}secret-pattern scan passed`)
  }
}

process.exit(failures === 0 ? 0 : 1)
