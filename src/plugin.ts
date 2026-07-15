/** OpenCode plugin entry for Tamer's correction-to-policy loop. */

import { tool, type Plugin } from "@opencode-ai/plugin"
import { mkdirSync, writeFileSync } from "node:fs"
import { checkAndBlock } from "./block.ts"
import { formatRulesForCompaction, formatRulesForInjection } from "./inject.ts"
import {
  addPersonalRule,
  getTamerPaths,
  initializeRulesFile,
  loadRulesFile,
  markRuleHit,
  setRuleStatus,
} from "./store.ts"
import { detectTriggers, hasExplicitMemoryConfirmation } from "./triggers.ts"
import type { RuleStatus, TamerRule } from "./types.ts"

const PLUGIN_VERSION = "0.1.0"

function loadRules(): TamerRule[] {
  try {
    return loadRulesFile().rules
  } catch (error) {
    console.error(`[tamer] failed to load rules: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

function recordHit(event: {
  tool: string
  rule_id?: string
  rule_name?: string
  action: "blocked" | "matched_l2" | "matched_l3" | "trigger_detected" | "passed"
  timestamp: string
}): void {
  try {
    const paths = getTamerPaths()
    mkdirSync(paths.directory, { recursive: true })
    writeFileSync(paths.hitsFile, `${JSON.stringify(event)}\n`, { flag: "a", mode: 0o600 })
  } catch (error) {
    console.error(`[tamer] failed to record hit: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function recordRuleMatch(rule: TamerRule, toolName: string): void {
  markRuleHit(rule.id)
  recordHit({
    tool: toolName,
    rule_id: rule.id,
    rule_name: rule.name,
    action: rule.intercept_level === "L2" ? "matched_l2" : "matched_l3",
    timestamp: new Date().toISOString(),
  })
}

export const tamerPlugin: Plugin = async ({ directory }) => {
  const projectDir = directory || process.cwd()
  initializeRulesFile()
  let rules = loadRules()
  let memoryConfirmationExpiresAt = 0
  console.error(`[tamer] v${PLUGIN_VERSION} initialized, projectDir=${projectDir}, rules=${rules.length}`)

  return {
    tool: {
      tamer_remember: tool({
        description:
          "Persist a user correction as a personal rule. Call only after the user explicitly confirms the exact rule text.",
        args: {
          name: tool.schema.string().min(1).max(80).describe("Short rule name"),
          instruction: tool.schema.string().min(1).max(300).describe("Exact confirmed behavior to remember"),
          intercept_level: tool.schema.enum(["L2", "L3"]).default("L3").describe("L2 warns; L3 injects guidance"),
        },
        async execute(args) {
          if (Date.now() > memoryConfirmationExpiresAt) {
            throw new Error("Tamer requires an explicit user confirmation in the current conversation before saving a rule.")
          }
          memoryConfirmationExpiresAt = 0
          const result = addPersonalRule({
            name: args.name,
            instruction: args.instruction,
            interceptLevel: args.intercept_level,
          })
          return result.created
            ? `Remembered rule ${result.rule.id}: ${result.rule.instruction}`
            : `Rule already exists as ${result.rule.id}; no duplicate created.`
        },
      }),
      tamer_rules: tool({
        description: "List personal correction rules or enable, disable, or archive one by id.",
        args: {
          action: tool.schema.enum(["list", "enable", "disable", "archive"]).default("list"),
          rule_id: tool.schema.string().optional().describe("Required for enable, disable, and archive"),
        },
        async execute(args) {
          if (args.action === "list") {
            const summary = loadRulesFile().rules.map(({ id, name, instruction, intercept_level, status, hit_count }) => ({
              id,
              name,
              instruction,
              intercept_level,
              status,
              hit_count,
            }))
            return JSON.stringify(summary, null, 2)
          }
          if (!args.rule_id) return "rule_id is required for this action."
          const statusByAction: Record<string, RuleStatus> = {
            enable: "active",
            disable: "disabled",
            archive: "archived",
          }
          const updated = setRuleStatus(args.rule_id, statusByAction[args.action])
          return updated ? `Rule ${updated.id} is now ${updated.status}.` : `Rule not found: ${args.rule_id}`
        },
      }),
    },

    "tool.execute.before": async (input, output) => {
      try {
        const toolName = input.tool || "unknown"
        rules = loadRules()
        if (rules.length === 0) return
        const matches = checkAndBlock(toolName, output.args || null, rules)
        for (const match of matches) {
          if (match.rule && match.rule.intercept_level !== "L1") recordRuleMatch(match.rule, toolName)
        }
      } catch (error) {
        if (error instanceof Error && error.name === "TamerBlockError") {
          const blockError = error as Error & { ruleId: string; ruleName: string }
          markRuleHit(blockError.ruleId)
          recordHit({
            tool: input.tool || "unknown",
            rule_id: blockError.ruleId,
            rule_name: blockError.ruleName,
            action: "blocked",
            timestamp: new Date().toISOString(),
          })
          throw error
        }
        console.error(`[tamer] tool.execute.before error (fail-open): ${error instanceof Error ? error.message : String(error)}`)
      }
    },

    "experimental.chat.system.transform": async (_input, output) => {
      try {
        rules = loadRules()
        const injection = formatRulesForInjection(rules)
        const captureInstruction =
          "[tamer correction capture]\nWhen the user corrects your behavior, propose one concise reusable rule. Call tamer_remember only after the user explicitly confirms that exact rule."
        output.system.push(injection ? `${injection}\n\n${captureInstruction}` : captureInstruction)
      } catch (error) {
        console.error(`[tamer] system.transform error (fail-open): ${error instanceof Error ? error.message : String(error)}`)
      }
    },

    "experimental.session.compacting": async (_input, output) => {
      try {
        rules = loadRules()
        const compaction = formatRulesForCompaction(rules)
        if (compaction) output.context.push(compaction)
      } catch (error) {
        console.error(`[tamer] session.compacting error (fail-open): ${error instanceof Error ? error.message : String(error)}`)
      }
    },

    "chat.message": async (_input, output) => {
      try {
        for (const part of output.parts) {
          if (part.type !== "text" || !part.text) continue
          if (hasExplicitMemoryConfirmation(part.text)) {
            memoryConfirmationExpiresAt = Date.now() + 5 * 60 * 1000
          }
          const trigger = detectTriggers(part.text)
          if (trigger.isCorrection) {
            console.error(`[tamer] correction trigger detected: pattern="${trigger.matchedPattern}"`)
            recordHit({ tool: "chat", action: "trigger_detected", timestamp: new Date().toISOString() })
          }
          if (trigger.isSessionEnd) {
            console.error(`[tamer] session end trigger detected: pattern="${trigger.matchedPattern}"`)
          }
        }
      } catch (error) {
        console.error(`[tamer] chat.message error (fail-open): ${error instanceof Error ? error.message : String(error)}`)
      }
    },
  }
}

export default tamerPlugin
export const server = tamerPlugin
