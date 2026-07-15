import { after, test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { tamerPlugin } from "../../src/plugin.ts"
import { loadRulesFile } from "../../src/store.ts"

const originalTamerDir = process.env.TAMER_DIR
const tamerDir = mkdtempSync(join(tmpdir(), "tamer-plugin-"))
process.env.TAMER_DIR = tamerDir

after(() => {
  if (originalTamerDir === undefined) delete process.env.TAMER_DIR
  else process.env.TAMER_DIR = originalTamerDir
  rmSync(tamerDir, { recursive: true, force: true })
})

async function loadHooks() {
  return tamerPlugin({ directory: "/tmp" } as never)
}

test("returns the current OpenCode hook and custom-tool contract", async () => {
  const hooks = await loadHooks()
  const hookNames = Object.keys(hooks)
  assert.ok(hookNames.includes("tool.execute.before"))
  assert.ok(hookNames.includes("experimental.chat.system.transform"))
  assert.ok(hookNames.includes("experimental.session.compacting"))
  assert.ok(hookNames.includes("chat.message"))
  assert.ok(hooks.tool?.tamer_remember)
  assert.ok(hooks.tool?.tamer_rules)
})

test("detects a correction from the real TextPart.text field", async () => {
  const hooks = await loadHooks()
  await hooks["chat.message"]?.(
    { sessionID: "session-test" },
    { parts: [{ type: "text", text: "不对，这里应该先运行测试。" }] } as never,
  )
  const hits = readFileSync(join(tamerDir, "hits.jsonl"), "utf-8")
    .trim()
    .split("\n")
    .map((line: string) => JSON.parse(line) as { action: string })
  assert.ok(hits.some((hit: { action: string }) => hit.action === "trigger_detected"))
})

test("persists, lists, and disables an explicitly confirmed rule", async () => {
  const hooks = await loadHooks()
  const remember = hooks.tool?.tamer_remember
  const manage = hooks.tool?.tamer_rules
  assert.ok(remember && manage)
  if (!remember || !manage) return

  await assert.rejects(
    remember.execute(
      { name: "未确认规则", instruction: "这条规则不应被保存。", intercept_level: "L3" },
      {} as never,
    ),
    /explicit user confirmation/,
  )
  await hooks["chat.message"]?.(
    { sessionID: "session-confirmation" },
    { parts: [{ type: "text", text: "我明确确认把这条规则记住。" }] } as never,
  )

  const remembered = await remember.execute(
    { name: "测试后再完成", instruction: "声明完成前必须运行相关测试。", intercept_level: "L3" },
    {} as never,
  )
  assert.match(String(remembered), /Remembered rule/)

  const personal = loadRulesFile().rules.find((rule) => rule.source === "personal")
  assert.ok(personal)
  if (!personal) return
  const listed = await manage.execute({ action: "list" }, {} as never)
  assert.match(String(listed), /测试后再完成/)
  const disabled = await manage.execute({ action: "disable", rule_id: personal.id }, {} as never)
  assert.match(String(disabled), /disabled/)
  assert.equal(loadRulesFile().rules.find((rule) => rule.id === personal.id)?.status, "disabled")
})

test("exports the PluginModule server entry", async () => {
  const mod = await import("../../src/plugin.ts")
  assert.equal(typeof mod.server, "function")
})
