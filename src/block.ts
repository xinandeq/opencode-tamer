/**
 * tamer v0.0 — L1 Block Logic
 *
 * Physical blocking via throw Error in tool.execute.before hook.
 */

import type { TamerRule, MatchResult } from "./types.ts";
import { matchRules, getL1Matches } from "./rules.ts";

/**
 * TamerBlockError — thrown to physically block a tool execution.
 *
 * In opencode, throwing an Error in tool.execute.before hook
 * causes the tool call to be rejected (physical block).
 */
export class TamerBlockError extends Error {
  ruleId: string;
  ruleName: string;
  instruction: string;

  constructor(rule: TamerRule) {
    const msg = [
      `🛡 tamer 阻断：${rule.name}`,
      `原因：${rule.instruction}`,
      `规则ID：${rule.id}`,
    ].join("\n");

    super(msg);
    this.name = "TamerBlockError";
    this.ruleId = rule.id;
    this.ruleName = rule.name;
    this.instruction = rule.instruction;
  }
}

/**
 * Check if a tool call should be blocked by L1 rules.
 * If yes, throw TamerBlockError to physically block it.
 *
 * @param tool - tool name (e.g. "write", "bash")
 * @param args - tool arguments
 * @param rules - all rules (active and inactive)
 * @throws {TamerBlockError} if an L1 rule matches
 * @returns array of all matches (for logging/auditing)
 */
export function checkAndBlock(
  tool: string,
  args: Record<string, unknown> | null,
  rules: TamerRule[]
): MatchResult[] {
  const matches = matchRules(tool, args, rules);
  const l1Matches = getL1Matches(matches);

  if (l1Matches.length > 0) {
    // Block on the first matching L1 rule
    const firstMatch = l1Matches[0];
    if (firstMatch.rule) {
      throw new TamerBlockError(firstMatch.rule);
    }
  }

  return matches;
}

/**
 * Check if a tool call would be blocked (without actually blocking).
 * Useful for testing.
 */
export function wouldBlock(
  tool: string,
  args: Record<string, unknown> | null,
  rules: TamerRule[]
): { blocked: boolean; rule?: TamerRule; reason?: string } {
  const matches = matchRules(tool, args, rules);
  const l1Matches = getL1Matches(matches);

  if (l1Matches.length > 0 && l1Matches[0].rule) {
    return {
      blocked: true,
      rule: l1Matches[0].rule,
      reason: l1Matches[0].reason,
    };
  }

  return { blocked: false };
}
