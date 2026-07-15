import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  addPersonalRule,
  initializeRulesFile,
  loadRulesFile,
  markRuleHit,
  setRuleStatus,
  type TamerPaths,
} from "../../src/store.ts"

function temporaryPaths(): TamerPaths {
  const directory = mkdtempSync(join(tmpdir(), "tamer-store-"))
  return {
    directory,
    rulesFile: join(directory, "rules.json"),
    hitsFile: join(directory, "hits.jsonl"),
  }
}

test("initializes a valid rules file from bundled seeds", () => {
  const paths = temporaryPaths()
  initializeRulesFile(paths)
  const data = loadRulesFile(paths)
  assert.equal(data.version, "0.1.0")
  assert.equal(data.rules.filter((rule) => rule.status === "active").length, 1)
  assert.equal(data.rules.find((rule) => rule.id === "seed_002")?.status, "active")
  assert.equal(statSync(paths.rulesFile).mode & 0o777, 0o600)
})

test("creates and deduplicates a confirmed personal rule", () => {
  const paths = temporaryPaths()
  const first = addPersonalRule({ name: "Verify first", instruction: "Run tests after changes." }, paths)
  const duplicate = addPersonalRule({ name: "Duplicate name", instruction: "  Run tests after changes.  " }, paths)
  assert.equal(first.created, true)
  assert.equal(duplicate.created, false)
  assert.equal(duplicate.rule.id, first.rule.id)
  assert.equal(loadRulesFile(paths).rules.filter((rule) => rule.source === "personal").length, 1)
})

test("updates rule status and hit statistics atomically", () => {
  const paths = temporaryPaths()
  const { rule } = addPersonalRule({ name: "Search first", instruction: "Search when uncertain." }, paths)
  assert.equal(setRuleStatus(rule.id, "disabled", paths)?.status, "disabled")
  markRuleHit(rule.id, paths)
  const updated = loadRulesFile(paths).rules.find((candidate) => candidate.id === rule.id)
  assert.equal(updated?.hit_count, 1)
  assert.ok(updated?.last_hit_at)
  assert.doesNotThrow(() => JSON.parse(readFileSync(paths.rulesFile, "utf-8")))
})
