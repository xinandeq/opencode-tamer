import { test } from "node:test"
import assert from "node:assert/strict"
import { checkAndBlock, wouldBlock, TamerBlockError } from "../../src/block.ts"
import { formatRulesForInjection, formatRulesForCompaction, countByLevel } from "../../src/inject.ts"
import { detectTriggers, countCorrections, hasExplicitMemoryConfirmation } from "../../src/triggers.ts"
import type { TamerRule } from "../../src/types.ts"

const testRules: TamerRule[] = [
  {
    id: "block_001",
    name: "Block destructive commands",
    trigger: { tool: ["bash", "run_terminal_cmd"], condition: "dangerous_command" },
    instruction: "Block rm -rf",
    intercept_level: "L1",
    status: "active",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 1.0, source: "seed",
  },
  {
    id: "block_002",
    name: "Avoid sudo",
    trigger: { tool: ["bash"], condition: "sudo" },
    instruction: "Do not use sudo",
    intercept_level: "L1",
    status: "active",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 0.6, source: "seed",
  },
  {
    id: "write_001",
    name: "Confirm before editing files",
    trigger: { tool: ["write", "edit"], condition: "cross_file_or_delete" },
    instruction: "Confirm before editing files",
    intercept_level: "L2",
    status: "active",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 0.9, source: "seed",
  },
]

// === Block Logic Tests ===

test("checkAndBlock throws TamerBlockError for rm -rf", () => {
  assert.throws(
    () => checkAndBlock("bash", { command: "rm -rf /tmp" }, testRules),
    (e: Error) => {
      assert.equal(e.name, "TamerBlockError")
      assert.ok(e.message.includes("Tamer blocked"))
      assert.ok(e.message.includes("Block destructive commands"))
      return true
    }
  )
})

test("checkAndBlock throws TamerBlockError for sudo", () => {
  assert.throws(
    () => checkAndBlock("bash", { command: "sudo apt install curl" }, testRules),
    (e: Error) => {
      assert.equal(e.name, "TamerBlockError")
      assert.ok(e.message.includes("sudo") || e.message.includes("tamer"))
      return true
    }
  )
})

test("checkAndBlock does NOT throw for safe commands", () => {
  assert.doesNotThrow(() => {
    checkAndBlock("bash", { command: "ls -la /tmp" }, testRules)
  })
})

test("checkAndBlock does NOT throw for write (L2 not L1)", () => {
  // write tool matches L2 rule, but L2 doesn't throw
  assert.doesNotThrow(() => {
    checkAndBlock("write", { filePath: "/tmp/test.txt" }, testRules)
  })
})

test("wouldBlock returns blocked=true for rm -rf", () => {
  const result = wouldBlock("bash", { command: "rm -rf /" }, testRules)
  assert.equal(result.blocked, true)
  assert.ok(result.rule)
  assert.equal(result.rule?.intercept_level, "L1")
})

test("wouldBlock returns blocked=false for safe command", () => {
  const result = wouldBlock("bash", { command: "echo hello" }, testRules)
  assert.equal(result.blocked, false)
})

test("wouldBlock returns blocked=false for read tool", () => {
  const result = wouldBlock("read", { filePath: "/tmp/test.txt" }, testRules)
  assert.equal(result.blocked, false)
})

test("TamerBlockError has correct properties", () => {
  const rule = testRules[0]
  const err = new TamerBlockError(rule)
  assert.equal(err.name, "TamerBlockError")
  assert.equal(err.ruleId, "block_001")
  assert.equal(err.ruleName, "Block destructive commands")
  assert.ok(err.instruction.includes("rm -rf"))
})

// === Injection Tests ===

test("formatRulesForInjection produces non-empty string for active rules", () => {
  const injection = formatRulesForInjection(testRules)
  assert.ok(injection.includes("Tamer"))
  assert.ok(injection.includes("Block destructive commands"))
  assert.ok(injection.includes("Confirm before editing files"))
  assert.ok(injection.includes("⛔")) // L1 marker
})

test("formatRulesForInjection returns empty for no active rules", () => {
  const injection = formatRulesForInjection([])
  assert.equal(injection, "")
})

test("formatRulesForCompaction includes rule names", () => {
  const compaction = formatRulesForCompaction(testRules)
  assert.ok(compaction.includes("Tamer"))
  assert.ok(compaction.includes("Block destructive commands"))
  assert.ok(compaction.includes("Continue following these rules"))
})

test("countByLevel counts correctly", () => {
  const counts = countByLevel(testRules)
  assert.equal(counts.L1, 2)
  assert.equal(counts.L2, 1)
  assert.equal(counts.L3, 0)
  assert.equal(counts.total, 3)
})

// === Trigger Detection Tests ===

test("detectTriggers detects correction signals", () => {
  assert.ok(detectTriggers("wrong, the function name is foo").isCorrection)
  assert.ok(detectTriggers("remember this for next time").isCorrection)
})

test("detectTriggers detects session end signals", () => {
  assert.ok(detectTriggers("wrap up for today").isSessionEnd)
})

test("detectTriggers returns false for normal text", () => {
  const result = detectTriggers("Please read this file")
  assert.equal(result.isCorrection, false)
  assert.equal(result.isSessionEnd, false)
})

test("memory confirmation requires explicit persistence intent", () => {
  assert.equal(hasExplicitMemoryConfirmation("Confirmed."), true)
  assert.equal(hasExplicitMemoryConfirmation("I explicitly confirm saving this rule."), true)
  assert.equal(hasExplicitMemoryConfirmation("Please confirm the test result."), false)
  assert.equal(hasExplicitMemoryConfirmation("This implementation looks good."), false)
})

test("countCorrections counts multiple corrections", () => {
  assert.equal(countCorrections("Wrong, fix it and do not repeat it again."), 3)
  assert.equal(countCorrections("all good here"), 0)
})

// === Empty Rules Tests ===

test("checkAndBlock with empty rules does not throw", () => {
  assert.doesNotThrow(() => {
    checkAndBlock("bash", { command: "rm -rf /" }, [])
  })
})

test("wouldBlock with empty rules returns not blocked", () => {
  const result = wouldBlock("bash", { command: "rm -rf /" }, [])
  assert.equal(result.blocked, false)
})
