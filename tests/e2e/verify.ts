/**
 * tamer v0.0 — E2E Test Script
 * Run inside Docker: bun run tests/e2e/verify.ts
 */

import { readFileSync } from "node:fs"
import { formatRulesForInjection, formatRulesForCompaction, countByLevel } from "../../src/inject.ts"
import { wouldBlock } from "../../src/block.ts"
import { matchRules } from "../../src/rules.ts"
import { detectTriggers } from "../../src/triggers.ts"
import { validateRulesFile } from "../../src/acmf.ts"

const rulesFile = JSON.parse(readFileSync("/root/.tamer/rules.json", "utf-8"))
const rules = rulesFile.rules

let pass = 0
let fail = 0

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`✅ ${name}`)
    pass++
  } else {
    console.log(`❌ ${name} ${detail || ""}`)
    fail++
  }
}

console.log("=== tamer v0.0 E2E Verification ===")
console.log(`Rules loaded: ${rules.length}`)
console.log()

// Test 1: Rules file validation
const validation = validateRulesFile(rulesFile)
check("Rules file is valid ACMF", validation.valid, validation.errors.join("; "))

// Test 2: Rule injection produces non-empty output
const injection = formatRulesForInjection(rules)
check("L3 injection is non-empty", injection.length > 0)
check("L3 injection contains tamer marker", injection.includes("tamer"))
check("L3 injection contains rule names", injection.includes("破坏性命令阻断"))
check("L3 injection contains L1 marker (⛔)", injection.includes("⛔"))

// Test 3: Compaction injection
const compaction = formatRulesForCompaction(rules)
check("Compaction injection is non-empty", compaction.length > 0)
check("Compaction injection contains rules", compaction.includes("破坏性命令阻断"))

// Test 4: L1 Block - rm -rf
const rmResult = wouldBlock("bash", { command: "rm -rf /tmp/test" }, rules)
check("L1 block: rm -rf is blocked", rmResult.blocked)
check("L1 block: correct rule matched", rmResult.rule?.name === "破坏性命令阻断")

// Test 5: L1 Block - git reset --hard
const gitResult = wouldBlock("bash", { command: "git reset --hard HEAD~3" }, rules)
check("L1 block: git reset --hard is blocked", gitResult.blocked)

// Test 6: L1 Block - sudo (rule is disabled, should NOT block)
const sudoResult = wouldBlock("bash", { command: "sudo apt update" }, rules)
check("L1 block: sudo NOT blocked (rule disabled)", !sudoResult.blocked)

// Test 7: Safe command NOT blocked
const lsResult = wouldBlock("bash", { command: "ls -la /tmp" }, rules)
check("Safe command: ls NOT blocked", !lsResult.blocked)

// Test 8: read tool NOT blocked
const readResult = wouldBlock("read", { filePath: "/tmp/test.txt" }, rules)
check("read tool NOT blocked", !readResult.blocked)

// Test 9: write tool matches L2 (not L1 block)
const writeMatches = matchRules("write", { filePath: "/tmp/test.txt" }, rules)
check("write tool: L2 matched, NOT blocked", writeMatches.length > 0 && writeMatches.some(m => m.rule?.intercept_level === "L2"))
check("write tool: wouldBlock returns false", !wouldBlock("write", { filePath: "/tmp/test.txt" }, rules).blocked)

// Test 10: dd if= blocked
const ddResult = wouldBlock("bash", { command: "dd if=/dev/zero of=/dev/sda" }, rules)
check("L1 block: dd if= is blocked", ddResult.blocked)

// Test 11: Trigger detection
check("Trigger: '不对' detected", detectTriggers("不对，这里应该用async").isCorrection)
check("Trigger: '记住' detected", detectTriggers("记住，下次不要这样做").isCorrection)
check("Trigger: '收工' detected", detectTriggers("收工").isSessionEnd)
check("Trigger: normal text not triggered", !detectTriggers("请帮我读取文件").isCorrection)

// Test 12: Rule count
const counts = countByLevel(rules)
check("Rule counts: L1=1 (sudo disabled)", counts.L1 === 1, `got ${counts.L1}`)
check("Rule counts: L2=2", counts.L2 === 2, `got ${counts.L2}`)
check("Rule counts: L3=1", counts.L3 === 1, `got ${counts.L3}`)
check("Rule counts: total active=4", counts.total === 4, `got ${counts.total}`)

console.log()
console.log(`=== E2E Results: ${pass} pass, ${fail} fail ===`)
if (fail > 0) {
  process.exit(1)
}
