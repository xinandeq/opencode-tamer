import { test } from "node:test"
import assert from "node:assert/strict"
import {
  matchRules,
  getActiveRules,
  getL1Matches,
  isDangerousCommand,
  usesSudo,
  isWriteTool,
  isBashTool,
  hasUncertaintySignal,
  extractFilePath,
} from "../../src/rules.ts"
import type { TamerRule } from "../../src/types.ts"

// Test rules
const testRules: TamerRule[] = [
  {
    id: "test_block",
    name: "破坏性命令阻断",
    trigger: { tool: ["bash", "run_terminal_cmd"], condition: "dangerous_command" },
    instruction: "阻断 rm -rf 等命令",
    intercept_level: "L1",
    status: "active",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 1.0, source: "seed",
  },
  {
    id: "test_sudo",
    name: "不用sudo",
    trigger: { tool: ["bash", "run_terminal_cmd"], condition: "sudo" },
    instruction: "不要用sudo",
    intercept_level: "L1",
    status: "active",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 0.6, source: "seed",
  },
  {
    id: "test_write",
    name: "改文件先确认",
    trigger: { tool: ["write", "edit", "multiedit"], condition: "cross_file_or_delete" },
    instruction: "改文件前确认",
    intercept_level: "L2",
    status: "active",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 0.9, source: "seed",
  },
  {
    id: "test_uncertain",
    name: "不猜API",
    trigger: { tool: ["*"], condition: "uncertainty_signal" },
    instruction: "不要猜",
    intercept_level: "L3",
    status: "active",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 0.7, source: "seed",
  },
  {
    id: "test_disabled",
    name: "禁用规则",
    trigger: { tool: ["bash"], condition: "always" },
    instruction: "不应触发",
    intercept_level: "L1",
    status: "disabled",
    hit_count: 0, pass_count: 0, false_positive_count: 0,
    created_at: "2026-07-14T00:00:00Z", last_hit_at: null, salience: 0.5, source: "seed",
  },
]

test("rm -rf triggers dangerous_command rule", () => {
  const matches = matchRules("bash", { command: "rm -rf /tmp/test" }, testRules)
  assert.ok(matches.length > 0, "Should match dangerous_command rule")
  assert.equal(matches[0].rule?.id, "test_block")
})

test("git reset --hard triggers dangerous_command rule", () => {
  const matches = matchRules("bash", { command: "git reset --hard HEAD~3" }, testRules)
  assert.ok(matches.length > 0, "Should match dangerous_command rule")
  assert.equal(matches[0].rule?.id, "test_block")
})

test("safe command does not trigger dangerous_command rule", () => {
  const matches = matchRules("bash", { command: "ls -la /tmp" }, testRules)
  const blockMatches = matches.filter(m => m.rule?.id === "test_block")
  assert.equal(blockMatches.length, 0, "Should not match dangerous_command rule")
})

test("sudo triggers sudo rule", () => {
  const matches = matchRules("bash", { command: "sudo apt install curl" }, testRules)
  assert.ok(matches.some(m => m.rule?.id === "test_sudo"), "Should match sudo rule")
})

test("write triggers cross_file_or_delete rule", () => {
  const matches = matchRules("write", { filePath: "/tmp/test.txt" }, testRules)
  assert.ok(matches.some(m => m.rule?.id === "test_write"), "Should match write rule")
})

test("read does not trigger write rule", () => {
  const matches = matchRules("read", { filePath: "/tmp/test.txt" }, testRules)
  assert.equal(matches.length, 0, "read should not match any rule")
})

test("disabled rules are not matched", () => {
  const matches = matchRules("bash", { command: "ls" }, testRules)
  assert.ok(!matches.some(m => m.rule?.id === "test_disabled"), "Disabled rule should not match")
})

test("wildcard tool matches any tool", () => {
  const matches = matchRules("custom_tool", { content: "maybe try this" }, testRules)
  assert.ok(matches.some(m => m.rule?.id === "test_uncertain"), "Wildcard should match any tool")
})

test("isDangerousCommand detects rm -rf", () => {
  assert.ok(isDangerousCommand("rm -rf /"))
  assert.ok(isDangerousCommand("git reset --hard origin/main"))
  assert.ok(isDangerousCommand("dd if=/dev/zero of=/dev/sda"))
  assert.ok(!isDangerousCommand("ls -la"))
  assert.ok(!isDangerousCommand("echo hello"))
})

test("usesSudo detects sudo", () => {
  assert.ok(usesSudo("sudo rm file"))
  assert.ok(usesSudo("sudo apt update"))
  assert.ok(!usesSudo("ls -la"))
})

test("isWriteTool detects write tools", () => {
  assert.ok(isWriteTool("write"))
  assert.ok(isWriteTool("edit"))
  assert.ok(isWriteTool("multiedit"))
  assert.ok(isWriteTool("MultiEdit"))
  assert.ok(!isWriteTool("read"))
  assert.ok(!isWriteTool("bash"))
})

test("isBashTool detects bash tools", () => {
  assert.ok(isBashTool("bash"))
  assert.ok(isBashTool("run_terminal_cmd"))
  assert.ok(!isBashTool("write"))
  assert.ok(!isBashTool("read"))
})

test("hasUncertaintySignal detects uncertainty", () => {
  assert.ok(hasUncertaintySignal("maybe this is correct"))
  assert.ok(hasUncertaintySignal("我不确定这个API"))
  assert.ok(!hasUncertaintySignal("the file is at /tmp/test"))
})

test("extractFilePath extracts from args", () => {
  assert.equal(extractFilePath("write", { filePath: "/tmp/test.txt" }), "/tmp/test.txt")
  assert.equal(extractFilePath("write", { target_file: "/app/src/index.ts" }), "/app/src/index.ts")
  assert.equal(extractFilePath("read", { path: "/etc/hosts" }), "/etc/hosts")
  assert.equal(extractFilePath("bash", { command: "cat /etc/passwd" }), "/etc/passwd")
  assert.equal(extractFilePath("bash", { command: "echo hello" }), null)
  assert.equal(extractFilePath("write", null), null)
})

test("getL1Matches filters only L1 rules", () => {
  const matches = matchRules("bash", { command: "rm -rf /tmp" }, testRules)
  const l1 = getL1Matches(matches)
  assert.ok(l1.every(m => m.rule?.intercept_level === "L1"), "All should be L1")
  assert.ok(l1.some(m => m.rule?.id === "test_block"), "Should include block rule")
})

test("getActiveRules filters only active rules", () => {
  const active = getActiveRules(testRules)
  assert.equal(active.length, 4, "Should have 4 active rules (1 disabled)")
  assert.ok(!active.some(r => r.id === "test_disabled"), "Should not include disabled rule")
})
