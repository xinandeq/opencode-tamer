import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import { parseRulesFile } from "./acmf.ts"
import type { InterceptLevel, RuleStatus, TamerRule, TamerRulesFile } from "./types.ts"

const BUNDLED_SEEDS_FILE = fileURLToPath(new URL("../seeds/rules.json", import.meta.url))

export interface TamerPaths {
  directory: string
  rulesFile: string
  hitsFile: string
}

export function getTamerPaths(): TamerPaths {
  const directory = process.env.TAMER_DIR || join(process.env.HOME || "/tmp", ".tamer")
  return {
    directory,
    rulesFile: join(directory, "rules.json"),
    hitsFile: join(directory, "hits.jsonl"),
  }
}

export function initializeRulesFile(paths = getTamerPaths()): void {
  mkdirSync(paths.directory, { recursive: true, mode: 0o700 })
  try {
    chmodSync(paths.directory, 0o700)
  } catch {
    // Some platforms do not implement POSIX modes; file writes still use 0600.
  }
  if (!existsSync(paths.rulesFile)) {
    copyFileSync(BUNDLED_SEEDS_FILE, paths.rulesFile)
  }
  try {
    chmodSync(paths.rulesFile, 0o600)
  } catch {
    // Some platforms do not implement POSIX modes.
  }
}

export function loadRulesFile(paths = getTamerPaths()): TamerRulesFile {
  initializeRulesFile(paths)
  const content = readFileSync(paths.rulesFile, "utf-8")
  const { data, errors } = parseRulesFile(content)
  if (!data) {
    throw new Error(`Invalid rules file: ${errors.join("; ")}`)
  }
  return data
}

export function saveRulesFile(data: TamerRulesFile, paths = getTamerPaths()): void {
  mkdirSync(dirname(paths.rulesFile), { recursive: true })
  const temporary = `${paths.rulesFile}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, paths.rulesFile)
}

function normalizeInstruction(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase()
}

export function addPersonalRule(input: {
  name: string
  instruction: string
  interceptLevel?: InterceptLevel
}, paths = getTamerPaths()): { rule: TamerRule; created: boolean } {
  const data = loadRulesFile(paths)
  const instruction = input.instruction.trim()
  const duplicate = data.rules.find(
    (rule) => rule.status !== "archived" && normalizeInstruction(rule.instruction) === normalizeInstruction(instruction),
  )
  if (duplicate) return { rule: duplicate, created: false }

  const now = new Date().toISOString()
  const rule: TamerRule = {
    id: `personal_${randomUUID()}`,
    name: input.name.trim(),
    trigger: { tool: ["*"], condition: "always" },
    instruction,
    intercept_level: input.interceptLevel || "L3",
    status: "active",
    hit_count: 0,
    pass_count: 0,
    false_positive_count: 0,
    created_at: now,
    last_hit_at: null,
    salience: 0.7,
    source: "personal",
  }
  data.rules.push(rule)
  data.version = "0.1.0"
  saveRulesFile(data, paths)
  return { rule, created: true }
}

export function setRuleStatus(
  ruleId: string,
  status: RuleStatus,
  paths = getTamerPaths(),
): TamerRule | null {
  const data = loadRulesFile(paths)
  const rule = data.rules.find((candidate) => candidate.id === ruleId)
  if (!rule) return null
  rule.status = status
  saveRulesFile(data, paths)
  return rule
}

export function markRuleHit(ruleId: string, paths = getTamerPaths()): void {
  const data = loadRulesFile(paths)
  const rule = data.rules.find((candidate) => candidate.id === ruleId)
  if (!rule) return
  rule.hit_count += 1
  rule.last_hit_at = new Date().toISOString()
  saveRulesFile(data, paths)
}
