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

function assertEvidenceShape(file, displayPath, text) {
  if (!file.endsWith(".json")) return
  const value = JSON.parse(text)
  if (value?.schema !== "incidentmesh.provider-evidence/v1") {
    throw new Error(`${displayPath}: unexpected or missing evidence schema`)
  }
  for (const key of ["commit", "provider", "model", "startedAt", "completedAt", "participants", "events", "overlap", "gateDecision", "interceptionObserved", "action", "limitations"]) {
    if (!(key in value)) throw new Error(`${displayPath}: missing required field ${key}`)
  }
  if (!Array.isArray(value.participants) || !Array.isArray(value.events) || !Array.isArray(value.limitations)) {
    throw new Error(`${displayPath}: participants, events, and limitations must be arrays`)
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
    console.log(`${displayPath}: evidence structure and secret-pattern scan passed`)
  }
}

process.exit(failures === 0 ? 0 : 1)
