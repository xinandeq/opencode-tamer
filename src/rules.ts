/**
 * tamer v0.0 — Rule Matching Engine
 *
 * Given a tool call (tool name + args), find matching active rules.
 */

import type { TamerRule, MatchResult, ConditionType } from "./types.ts";

// Dangerous command patterns for "dangerous_command" condition
const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+-rf/i,
  /git\s+reset\s+--hard/i,
  /git\s+push\s+--force/i,
  /drop\s+table/i,
  /dd\s+if=/i,
  /mkfs/i,
  /:\(\)\{\s*:\s*\|\s*:&\s*\};:/i, // fork bomb
];

// Uncertainty signal patterns
const UNCERTAINTY_PATTERNS: RegExp[] = [
  /可能/i, /也许/i, /我猜/i, /试试/i, /不确定/i, /大概/i,
  /maybe/i, /perhaps/i, /i\s+think/i, /not\s+sure/i, /guess/i,
];

// sudo pattern
const SUDO_PATTERN = /\bsudo\b/i;

/**
 * Extract file path from tool args (best-effort)
 */
export function extractFilePath(tool: string, args: Record<string, unknown> | null): string | null {
  if (!args) return null;

  const pathFields = ["filePath", "path", "file_path", "target_file", "file"];
  for (const field of pathFields) {
    const val = args[field];
    if (typeof val === "string" && val.length > 0) {
      return val;
    }
  }

  // For bash/terminal commands, try to extract from command string
  if (tool === "bash" || tool === "run_terminal_cmd") {
    const cmd = typeof args.command === "string" ? args.command : "";
    // Look for file paths in the command
    const pathMatch = cmd.match(/(?:^|\s)(\/[^\s]+|~\/[^\s]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
  }

  return null;
}

/**
 * Check if a command contains dangerous patterns
 */
export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(command));
}

/**
 * Check if a command uses sudo
 */
export function usesSudo(command: string): boolean {
  return SUDO_PATTERN.test(command);
}

/**
 * Check if text contains uncertainty signals
 */
export function hasUncertaintySignal(text: string): boolean {
  return UNCERTAINTY_PATTERNS.some(p => p.test(text));
}

/**
 * Check if the tool is a write/edit operation
 */
export function isWriteTool(tool: string): boolean {
  const writeTools = ["write", "edit", "multiedit", "MultiEdit", "str_replace_editor", "string_replace", "str_replace", "write_file"];
  return writeTools.includes(tool);
}

/**
 * Check if the tool is a bash/terminal command
 */
export function isBashTool(tool: string): boolean {
  return ["bash", "run_terminal_cmd", "terminal", "shell"].includes(tool);
}

/**
 * Evaluate a single condition against the tool call
 */
function evaluateCondition(
  condition: ConditionType,
  tool: string,
  args: Record<string, unknown> | null
): boolean {
  switch (condition) {
    case "always":
      return true;

    case "dangerous_command": {
      if (!isBashTool(tool)) return false;
      const cmd = typeof args?.command === "string" ? args.command : "";
      return isDangerousCommand(cmd);
    }

    case "cross_file_or_delete": {
      if (!isWriteTool(tool)) return false;
      // v0.0 simplification: trigger on all write operations
      // v0.1+ will add cross-file or delete-specific detection
      return true;
    }

    case "sudo": {
      if (!isBashTool(tool)) return false;
      const cmd = typeof args?.command === "string" ? args.command : "";
      return usesSudo(cmd);
    }

    case "uncertainty_signal": {
      // Check if the tool args contain uncertainty language
      const text = JSON.stringify(args || {});
      return hasUncertaintySignal(text);
    }

    case "unread_file": {
      // v0.0 simplification: always false (needs session-level read tracking)
      // v0.1+ will track reads within a session
      return false;
    }

    default:
      return false;
  }
}

/**
 * Match active rules against a tool call
 */
export function matchRules(
  tool: string,
  args: Record<string, unknown> | null,
  rules: TamerRule[]
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const rule of rules) {
    // Skip non-active rules
    if (rule.status !== "active") continue;

    // Check tool match
    const toolMatch = rule.trigger.tool.includes("*") || rule.trigger.tool.includes(tool);
    if (!toolMatch) continue;

    // Evaluate condition
    const conditionMet = evaluateCondition(rule.trigger.condition, tool, args);
    if (!conditionMet) continue;

    results.push({
      matched: true,
      rule,
      reason: `Tool "${tool}" matched rule "${rule.name}" (condition: ${rule.trigger.condition})`,
    });
  }

  return results;
}

/**
 * Get only L1 (block) matches from match results
 */
export function getL1Matches(matches: MatchResult[]): MatchResult[] {
  return matches.filter(m => m.rule?.intercept_level === "L1");
}

/**
 * Get active rules only
 */
export function getActiveRules(rules: TamerRule[]): TamerRule[] {
  return rules.filter(r => r.status === "active");
}
