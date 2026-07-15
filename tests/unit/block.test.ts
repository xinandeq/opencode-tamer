import { test } from "node:test"
import assert from "node:assert/strict"
import { checkAndBlock, wouldBlock, TamerBlockError } from "../../src/block.ts"
import { formatRulesForInjection, formatRulesForCompaction, countByLevel } from "../../src/inject.ts"
import { detectTriggers, countCorrections, hasExplicitMemoryConfirmation } from "../../src/triggers.ts"
import type { TamerRule } from "../../src/types.ts"

const testRules: TamerRule[] = [
  {
    id: "block_001",
    name: "破坏性命令阻断",
    trigger: { tool: ["bash", "run_terminal_cmd"], condition: "dangerous_command" },
    instruction: "阻断 rm -rf",
    intercept_level: "L1",
    status: "active",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 1.0, source: "seed",
  },
  {
    id: "block_002",
    name: "不用sudo",
    trigger: { tool: ["bash"], condition: "sudo" },
    instruction: "不要用sudo",
    intercept_level: "L1",
    status: "active",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 0.6, source: "seed",
  },
  {
    id: "write_001",
    name: "改文件先确认",
    trigger: { tool: ["write", "edit"], condition: "cross_file_or_delete" },
    instruction: "改文件前确认",
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
      assert.ok(e.message.includes("tamer 阻断"))
      assert.ok(e.message.includes("破坏性命令阻断"))
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
  assert.equal(err.ruleName, "破坏性命令阻断")
  assert.ok(err.instruction.includes("rm -rf"))
})

// === Injection Tests ===

test("formatRulesForInjection produces non-empty string for active rules", () => {
  const injection = formatRulesForInjection(testRules)
  assert.ok(injection.includes("tamer"))
  assert.ok(injection.includes("破坏性命令阻断"))
  assert.ok(injection.includes("改文件先确认"))
  assert.ok(injection.includes("⛔")) // L1 marker
})

test("formatRulesForInjection returns empty for no active rules", () => {
  const injection = formatRulesForInjection([])
  assert.equal(injection, "")
})

test("formatRulesForCompaction includes rule names", () => {
  const compaction = formatRulesForCompaction(testRules)
  assert.ok(compaction.includes("tamer"))
  assert.ok(compaction.includes("破坏性命令阻断"))
  assert.ok(compaction.includes("恢复后必须继续遵守"))
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
  assert.ok(detectTriggers("不对，这里应该用 async").isCorrection)
  assert.ok(detectTriggers("wrong, the function name is foo").isCorrection)
  assert.ok(detectTriggers("记住，下次不要这样做").isCorrection)
})

test("detectTriggers detects session end signals", () => {
  assert.ok(detectTriggers("收工").isSessionEnd)
  assert.ok(detectTriggers("wrap up for today").isSessionEnd)
})

test("detectTriggers returns false for normal text", () => {
  const result = detectTriggers("请帮我读取这个文件")
  assert.equal(result.isCorrection, false)
  assert.equal(result.isSessionEnd, false)
})

test("memory confirmation requires explicit persistence intent", () => {
  assert.equal(hasExplicitMemoryConfirmation("确认保存这条规则。"), true)
  assert.equal(hasExplicitMemoryConfirmation("我明确确认把这条规则记住。"), true)
  assert.equal(hasExplicitMemoryConfirmation("请确认一下测试结果。"), false)
  assert.equal(hasExplicitMemoryConfirmation("这个实现没问题。"), false)
})

test("countCorrections counts multiple corrections", () => {
  assert.equal(countCorrections("不对，错了，重新做"), 3)
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
