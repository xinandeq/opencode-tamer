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
    return `- ${level} ${r.name}: ${r.instruction}`;
  }).join("\n");

  return [
    "🛡 Tamer is active. Apply these correction rules:",
    ruleLines,
    "",
    "Check these rules before every action.",
    "⛔ rules physically block matching actions.",
    "⚠️ rules require you to stop and confirm first.",
    "💡 rules are advisory reminders.",
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
    "## Tamer correction rules retained after compaction",
    "Continue following these rules after context recovery:",
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
