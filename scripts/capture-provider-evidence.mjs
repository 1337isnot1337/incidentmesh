#!/usr/bin/env node

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn, spawnSync } from "node:child_process"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, "..")
const evidenceDir = join(projectRoot, "docs", "evidence")
const defaultModel = "gpt-5.5"
const timeoutMs = 45_000

function usage() {
  console.log([
    "usage:",
    "  node scripts/capture-provider-evidence.mjs --check [--model <model>]",
    "  node scripts/capture-provider-evidence.mjs --execute [--model <model>] [--phase1-only]",
    "",
    "--check inspects only model/provider selection and credential variable names.",
    "--execute performs one bounded real-model IncidentMesh run and writes evidence only on success.",
  ].join("\n"))
}

function parseArgs(argv) {
  let mode = "check"
  let model = defaultModel
  let phase1Only = false
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") return { help: true, mode, model }
    if (arg === "--check") mode = "check"
    else if (arg === "--execute") mode = "execute"
    else if (arg === "--model") {
      model = argv[++i]
      if (!model) throw new Error("--model requires a value")
    } else if (arg === "--phase1-only") phase1Only = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return { help: false, mode, model, phase1Only }
}

function providerForModel(model) {
  if (/^gpt-/i.test(model)) return "openai"
  if (/^claude-/i.test(model)) return "anthropic"
  if (/^gemini-/i.test(model)) return "google"
  if (/^deepseek-/i.test(model)) return "deepseek"
  return "unknown"
}

function credentialNamesForProvider(provider) {
  const candidates = {
    openai: ["OPENAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY"],
    google: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
    deepseek: ["DEEPSEEK_API_KEY"],
    unknown: [],
  }[provider] ?? []
  return candidates.filter((name) => typeof process.env[name] === "string" && process.env[name].length > 0)
}

function sanitizeText(input) {
  return input
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gi, "<redacted-secret>")
    .replace(/\bBearer\s+\S+/gi, "Bearer <redacted>")
    .replace(/\b(?:OPENAI|ANTHROPIC|GOOGLE|GEMINI|DEEPSEEK)_API_KEY\s*=\s*\S+/gi, "<redacted-api-key-assignment>")
    .replace(/\/workspace\/[^\s:]+/g, "<workspace-path>")
    .replace(/\/home\/[A-Za-z0-9._-]+\/[^\s:]+/g, "<home-path>")
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+\\[^\s:]*/g, "<user-path>")
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: projectRoot, encoding: "utf8" })
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${sanitizeText(result.stderr || result.stdout)}`)
  return result.stdout.trim()
}

function packageVersion(name) {
  const file = join(projectRoot, "node_modules", ...name.split("/"), "package.json")
  return JSON.parse(readFileSync(file, "utf8")).version
}

function runChild(command, args, env, timeout) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
      setTimeout(() => child.kill("SIGKILL"), 1_000).unref()
    }, timeout)
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("close", (code, signal) => {
      clearTimeout(timer)
      resolvePromise({ code, signal, timedOut, stdout, stderr })
    })
  })
}

function parseReport(stdout) {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const value = JSON.parse(lines[i])
      if (value?.schema === "incidentmesh.report/v1") return value
    } catch {}
  }
  throw new Error("successful process did not emit an incidentmesh.report/v1 JSON report")
}

function overlapDetails(spans) {
  const pairs = []
  for (let i = 0; i < spans.length; i += 1) {
    for (let j = i + 1; j < spans.length; j += 1) {
      const a = spans[i]
      const b = spans[j]
      if (a.completedAtMs == null || b.completedAtMs == null) continue
      const overlapStartMs = Math.max(a.startedAtMs, b.startedAtMs)
      const overlapEndMs = Math.min(a.completedAtMs, b.completedAtMs)
      if (overlapEndMs > overlapStartMs) {
        pairs.push({ roles: [a.role, b.role], overlapMs: overlapEndMs - overlapStartMs })
      }
    }
  }
  return { pairCount: pairs.length, pairs }
}

function peerAwarenessDetails(events, spans) {
  const spanByRole = new Map(spans.map((span) => [span.role, span]))
  return events
    .filter((event) => event.type === "awareness.peer-observed")
    .map((event) => {
      const match = event.detail.match(/^(Trace|Dependency|Impact) observed (trace|dependency|impact) hypothesis$/i)
      const observer = match?.[1]?.toLowerCase() ?? null
      const sourceRole = match?.[2]?.toLowerCase() ?? null
      const span = observer === null ? undefined : spanByRole.get(observer)
      const activeDuringOwnInference = span !== undefined
        && event.atMs >= span.startedAtMs
        && (span.completedAtMs == null || event.atMs < span.completedAtMs)
      return {
        atMs: event.atMs,
        observer,
        sourceRole,
        activeDuringOwnInference,
      }
    })
}

function markdownEvidence(evidence, nodeVersion, mozaikVersion, command) {
  const participantLines = evidence.participants.map((p) => `- ${p.role}: ${p.startedAtMs}ms -> ${p.completedAtMs ?? "not completed"}ms`).join("\n")
  const limitations = evidence.limitations.map((item) => `- ${item}`).join("\n")
  return `# IncidentMesh real-provider run evidence\n\n` +
    `This file records one provider-backed execution. It is execution evidence, not a production-readiness claim.\n\n` +
    `- Started: ${evidence.startedAt}\n` +
    `- Completed: ${evidence.completedAt}\n` +
    `- Commit: ${evidence.commit}\n` +
    `- Node: ${nodeVersion}\n` +
    `- Mozaik: ${mozaikVersion}\n` +
    `- Provider: ${evidence.provider}\n` +
    `- Model: ${evidence.model}\n` +
    `- Command: \`${command}\`\n` +
    `- Provider credential required: yes\n` +
    `- Run completed: yes\n` +
    `- Gate decision: ${evidence.gateDecision}\n` +
    `- Interception observed: ${evidence.interceptionObserved ? "yes" : "no"}\n` +
    `- Requested action: ${evidence.action?.requestedTool ?? "none"}\n` +
    `- Executed tool: ${evidence.action?.executedTool ?? "none"}\n` +
    `- Model recommendation recorded: ${evidence.action?.modelRecommendation ? "yes" : "no"}\n\n` +
    `## Participants\n\n${participantLines}\n\n` +
    `## Concurrency\n\n` +
    `Overlapping participant pairs: ${evidence.overlap.pairCount}.\n\n` +
    `Peer-awareness observations recorded by runtime participants: ${evidence.peerAwareness.length}; ` +
    `${evidence.peerAwareness.filter((item) => item.activeDuringOwnInference).length} occurred while the observer's own inference span was still active.\n\n` +
    `## Runtime facts\n\n` +
    `- Hypotheses received by shared state: ${evidence.hypotheses.length}\n` +
    `- Adaptations recorded: ${evidence.adaptations.length}\n` +
    `- Evidence notes recorded: ${evidence.evidence.length}\n\n` +
    `## Limitations\n\n${limitations}\n`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }

  const provider = providerForModel(args.model)
  const credentialVariableNames = credentialNamesForProvider(provider)
  const checkResult = {
    mode: args.mode,
    model: args.model,
    provider,
    credentialVariableNames,
    providerCredentialAvailable: credentialVariableNames.length > 0,
  }
  console.log(JSON.stringify(checkResult, null, 2))
  if (args.mode === "check") return

  if (provider === "unknown") throw new Error(`cannot determine provider for model ${args.model}`)
  if (credentialVariableNames.length === 0) {
    throw new Error(`no ${provider} provider credential variable is available; refusing to fabricate a live run`)
  }

  const build = spawnSync(process.execPath, [join(projectRoot, "scripts", "build.mjs")], {
    cwd: projectRoot,
    stdio: "inherit",
  })
  if (build.status !== 0) throw new Error("build failed; provider run not started")

  const commit = git("rev-parse", "HEAD")
  const startedAt = new Date().toISOString()
  const command = `RUN_MODEL=1 DRY_RUN=0 PHASE1_ONLY=${args.phase1Only ? 1 : 0} MODEL=${args.model} node dist/index.js`
  const result = await runChild(process.execPath, [join(projectRoot, "dist", "index.js")], {
    ...process.env,
    RUN_MODEL: "1",
    DRY_RUN: "0",
    PHASE1_ONLY: args.phase1Only ? "1" : "0",
    MODEL: args.model,
  }, timeoutMs)
  const completedAt = new Date().toISOString()

  if (result.timedOut || result.code !== 0) {
    console.error(`provider run failed: code=${result.code ?? "null"} signal=${result.signal ?? "none"} timedOut=${result.timedOut}`)
    const safeStderr = sanitizeText(result.stderr).trim()
    if (safeStderr) console.error(safeStderr.slice(0, 8_000))
    throw new Error("provider run did not complete; no evidence files were written")
  }

  const report = parseReport(result.stdout)
  const mozaikVersion = packageVersion("@mozaik-ai/core")
  const limitations = [
    "The report exposes IncidentMesh incident events, not raw provider request/response bodies or authorization metadata.",
    "Raw provider request/response bodies are not preserved; IncidentMesh records normalized hypotheses, Mozaik interception/function-call events, and the Phase-2 model recommendation.",
    "A single successful execution does not establish production reliability or MTTR improvement.",
  ]
  const evidence = {
    schema: "incidentmesh.provider-evidence/v1",
    phase1Only: args.phase1Only,
    commit,
    provider,
    model: args.model,
    startedAt,
    completedAt,
    participants: report.spans,
    events: report.timeline,
    overlap: overlapDetails(report.spans),
    peerAwareness: peerAwarenessDetails(report.timeline, report.spans),
    gateDecision: report.gateDecision,
    interceptionObserved: report.action?.intercepted === true && report.timeline.some((event) => event.type === "mozaik.interception.rewritten"),
    action: report.action,
    hypotheses: report.hypotheses,
    adaptations: report.adaptations,
    evidence: report.evidence,
    reportElapsedMs: report.elapsedMs,
    inferenceEvents: report.timeline.filter((event) => event.type === "mozaik.inference.started" || event.type === "mozaik.inference.completed"),
    limitations,
  }

  const jsonText = `${JSON.stringify(evidence, null, 2)}\n`
  const mdText = markdownEvidence(evidence, process.version, mozaikVersion, command)
  const stagingDir = mkdtempSync(join(tmpdir(), "incidentmesh-evidence-"))
  const stagedJson = join(stagingDir, "real-provider-run.json")
  const stagedMd = join(stagingDir, "real-provider-run.md")
  try {
    writeFileSync(stagedJson, jsonText, { mode: 0o600 })
    writeFileSync(stagedMd, mdText, { mode: 0o600 })
    const validate = spawnSync(process.execPath, [join(projectRoot, "scripts", "validate-evidence.mjs"), "real-provider-run.json", "real-provider-run.md"], {
      cwd: stagingDir,
      encoding: "utf8",
    })
    if (validate.status !== 0) {
      const detail = sanitizeText(validate.stderr || validate.stdout).trim()
      if (detail) console.error(detail.slice(0, 8_000))
      throw new Error("evidence validator rejected captured artifacts")
    }
    if (validate.stdout) process.stdout.write(validate.stdout)

    mkdirSync(evidenceDir, { recursive: true })
    copyFileSync(stagedJson, join(evidenceDir, "real-provider-run.json"))
    copyFileSync(stagedMd, join(evidenceDir, "real-provider-run.md"))
  } finally {
    rmSync(stagingDir, { recursive: true, force: true })
  }

  console.log("wrote docs/evidence/real-provider-run.json")
  console.log("wrote docs/evidence/real-provider-run.md")
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`capture failed: ${sanitizeText(message)}`)
  process.exitCode = 1
})
