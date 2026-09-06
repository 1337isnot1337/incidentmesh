#!/usr/bin/env node

import { existsSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const scriptPath = fileURLToPath(import.meta.url)
const projectRoot = resolve(dirname(scriptPath), "..")
const outputDirectory = resolve(projectRoot, "dist")
if (dirname(outputDirectory) !== projectRoot || outputDirectory === projectRoot) {
  throw new Error("refusing to clean an unsafe build output path")
}

rmSync(outputDirectory, { recursive: true, force: true })
const tscPath = join(projectRoot, "node_modules", "typescript", "bin", "tsc")
const result = spawnSync(
  process.execPath,
  [tscPath, "-p", join(projectRoot, "tsconfig.build.json")],
  { cwd: projectRoot, stdio: "inherit" },
)
if (result.status !== 0) {
  throw new Error("TypeScript production build failed")
}

for (const entrypoint of ["index.js", "replay.js", "demo.js", "benchmark.js", "verify.js"]) {
  if (!existsSync(join(outputDirectory, entrypoint))) {
    throw new Error(`production build missing entrypoint: ${entrypoint}`)
  }
}
