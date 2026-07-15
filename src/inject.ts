/**
 * tamer v0.0 — L3 Rule Injection
 *
 * Injects active rules into the system prompt via
 * experimental.chat.system.transform hook.
 */

import type { TamerRule } from "./types.ts";
import { getActiveRules } from "./rules.ts";

/**
 * Format rules into a system prompt injection string.
 *
 * The injection text is designed to be:
 * - Concise (~500-700 tokens for 15 rules)
 * - Structured (clear list format)
 * - Actionable (tells Agent what to check)
 */
export function formatRulesForInjection(rules: TamerRule[]): string {
  const active = getActiveRules(rules);

  if (active.length === 0) {
    return ""; // No active rules, don't inject anything
  }

  const ruleLines = active.map(r => {
    const level = r.intercept_level === "L1" ? "⛔" : r.intercept_level === "L2" ? "⚠️" : "💡";
    return `- ${level} ${r.name}：${r.instruction}`;
  }).join("\n");

  return [
    "🛡 tamer 已激活（v0.0）。你有以下纠错规则：",
    ruleLines,
    "",
    "在执行任何操作前，检查是否触发以上规则。",
    "⛔ 标记的规则会物理阻断你的操作。",
    "⚠️ 标记的规则需要你先停下来确认。",
    "💡 标记的规则是软性提醒。",
  ].join("\n");
}

/**
 * Format a compact version of rules for compaction context.
 * Used in experimental.session.compacting hook.
 *
 * Compact format: only rule names + one-line instruction.
 * ~200 tokens for 15 rules.
 */
export function formatRulesForCompaction(rules: TamerRule[]): string {
  const active = getActiveRules(rules);

  if (active.length === 0) {
    return "";
  }

  const lines = active.map(r => `- ${r.name}: ${r.instruction}`).join("\n");

  return [
    "## tamer 纠错规则（压缩后保留）",
    "恢复后必须继续遵守以下规则：",
    lines,
  ].join("\n");
}

/**
 * Count active rules by intercept level
 */
export function countByLevel(rules: TamerRule[]): { L1: number; L2: number; L3: number; total: number } {
  const active = getActiveRules(rules);
  return {
    L1: active.filter(r => r.intercept_level === "L1").length,
    L2: active.filter(r => r.intercept_level === "L2").length,
    L3: active.filter(r => r.intercept_level === "L3").length,
    total: active.length,
  };
}
