import { test } from "node:test"
import assert from "node:assert/strict"
import { validateRule, validateRulesFile, parseRulesFile } from "../../src/acmf.ts"

test("valid rule passes validation", () => {
  const rule = {
    id: "test_001",
    name: "Test Rule",
    trigger: { tool: ["write"], condition: "always" },
    instruction: "Test instruction",
    intercept_level: "L1",
    status: "active",
    hit_count: 0,
  }
  const errors = validateRule(rule, 0)
  assert.equal(errors.length, 0, `Expected no errors, got: ${errors.join("; ")}`)
})

test("missing required fields fails", () => {
  const rule = { id: "test_002" }
  const errors = validateRule(rule, 1)
  assert.ok(errors.length > 0, "Should have errors for missing fields")
  assert.ok(errors.some(e => e.includes("name")), "Should mention missing name")
  assert.ok(errors.some(e => e.includes("trigger")), "Should mention missing trigger")
})

test("invalid intercept_level fails", () => {
  const rule = {
    id: "test_003",
    name: "Test",
    trigger: { tool: ["write"], condition: "always" },
    instruction: "Test",
    intercept_level: "L4",
    status: "active",
  }
  const errors = validateRule(rule, 2)
  assert.ok(errors.some(e => e.includes("intercept_level")), "Should mention invalid intercept_level")
})

test("instruction too long fails", () => {
  const rule = {
    id: "test_004",
    name: "Test",
    trigger: { tool: ["write"], condition: "always" },
    instruction: "x".repeat(301),
    intercept_level: "L1",
    status: "active",
  }
  const errors = validateRule(rule, 3)
  assert.ok(errors.some(e => e.includes("300")), "Should mention length limit")
})

test("salience out of range fails", () => {
  const rule = {
    id: "test_005",
    name: "Test",
    trigger: { tool: ["write"], condition: "always" },
    instruction: "Test",
    intercept_level: "L1",
    status: "active",
    salience: 1.5,
  }
  const errors = validateRule(rule, 4)
  assert.ok(errors.some(e => e.includes("salience")), "Should mention salience range")
})

test("valid rules file passes", () => {
  const data = {
    version: "0.0.1",
    rules: [
      {
        id: "r1",
        name: "Rule 1",
        trigger: { tool: ["write"], condition: "always" },
        instruction: "Do X",
        intercept_level: "L1",
        status: "active",
      },
      {
        id: "r2",
        name: "Rule 2",
        trigger: { tool: ["bash"], condition: "dangerous_command" },
        instruction: "Do Y",
        intercept_level: "L2",
        status: "active",
      },
    ],
  }
  const result = validateRulesFile(data)
  assert.equal(result.valid, true, `Expected valid, got errors: ${result.errors.join("; ")}`)
  assert.equal(result.rule_count, 2)
})

test("duplicate IDs fail", () => {
  const data = {
    version: "0.0.1",
    rules: [
      { id: "dup", name: "R1", trigger: { tool: ["write"], condition: "always" }, instruction: "X", intercept_level: "L1", status: "active" },
      { id: "dup", name: "R2", trigger: { tool: ["bash"], condition: "always" }, instruction: "Y", intercept_level: "L2", status: "active" },
    ],
  }
  const result = validateRulesFile(data)
  assert.ok(!result.valid, "Should fail with duplicate IDs")
  assert.ok(result.errors.some(e => e.includes("Duplicate")), "Should mention duplicates")
})

test("parseRulesFile handles invalid JSON", () => {
  const { data, errors } = parseRulesFile("not json {{{")
  assert.equal(data, null)
  assert.ok(errors.length > 0)
  assert.ok(errors.some(e => e.includes("parse error")))
})

test("parseRulesFile handles valid JSON", () => {
  const json = JSON.stringify({
    version: "0.0.1",
    rules: [{
      id: "r1", name: "R1", trigger: { tool: ["write"], condition: "always" },
      instruction: "X", intercept_level: "L1", status: "active",
    }],
  })
  const { data, errors } = parseRulesFile(json)
  assert.equal(errors.length, 0)
  assert.ok(data)
  if (!data) return
  assert.equal(data.rules.length, 1)
})
