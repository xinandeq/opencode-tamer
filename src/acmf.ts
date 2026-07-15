/**
 * tamer v0.0 — ACMF JSON Validation
 *
 * Validates rule files against the ACMF lite schema.
 */

import type { TamerRule, TamerRulesFile, InterceptLevel, RuleStatus, ConditionType } from "./types.ts";

const VALID_INTERCEPT_LEVELS: InterceptLevel[] = ["L1", "L2", "L3"];
const VALID_STATUSES: RuleStatus[] = ["active", "disabled", "archived", "review_needed"];
const VALID_CONDITIONS: ConditionType[] = [
  "always", "dangerous_command", "cross_file_or_delete", "sudo", "uncertainty_signal", "unread_file"
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  rule_count: number;
}

/**
 * Validate a single rule object
 */
export function validateRule(rule: unknown, index: number): string[] {
  const errors: string[] = [];
  const r = rule as Record<string, unknown>;

  if (!r || typeof r !== "object") {
    return [`Rule #${index}: not an object`];
  }

  // Required fields
  const required = ["id", "name", "trigger", "instruction", "intercept_level", "status"];
  for (const field of required) {
    if (!(field in r) || r[field] === undefined || r[field] === null) {
      errors.push(`Rule #${index} (${r.id || "unknown"}): missing required field "${field}"`);
    }
  }

  // intercept_level must be valid
  if (r.intercept_level && !VALID_INTERCEPT_LEVELS.includes(r.intercept_level as InterceptLevel)) {
    errors.push(`Rule #${index} (${r.id}): invalid intercept_level "${r.intercept_level}"`);
  }

  // status must be valid
  if (r.status && !VALID_STATUSES.includes(r.status as RuleStatus)) {
    errors.push(`Rule #${index} (${r.id}): invalid status "${r.status}"`);
  }

  // trigger must have tool array and condition
  const trigger = r.trigger as Record<string, unknown>;
  if (trigger) {
    if (!Array.isArray(trigger.tool)) {
      errors.push(`Rule #${index} (${r.id}): trigger.tool must be an array`);
    }
    if (trigger.condition && !VALID_CONDITIONS.includes(trigger.condition as ConditionType)) {
      errors.push(`Rule #${index} (${r.id}): invalid trigger.condition "${trigger.condition}"`);
    }
  } else {
    errors.push(`Rule #${index}: trigger is required`);
  }

  // instruction must not be empty
  if (r.instruction !== undefined && (typeof r.instruction !== "string" || r.instruction.length === 0)) {
    errors.push(`Rule #${index} (${r.id}): instruction must be a non-empty string`);
  }

  // instruction length check (<= 300 chars)
  if (typeof r.instruction === "string" && r.instruction.length > 300) {
    errors.push(`Rule #${index} (${r.id}): instruction exceeds 300 chars (got ${r.instruction.length})`);
  }

  // hit_count must be non-negative integer
  if (r.hit_count !== undefined && (typeof r.hit_count !== "number" || r.hit_count < 0)) {
    errors.push(`Rule #${index} (${r.id}): hit_count must be a non-negative number`);
  }

  // salience must be 0-1
  if (r.salience !== undefined && (typeof r.salience !== "number" || r.salience < 0 || r.salience > 1)) {
    errors.push(`Rule #${index} (${r.id}): salience must be between 0 and 1`);
  }

  return errors;
}

/**
 * Validate a complete rules file
 */
export function validateRulesFile(data: unknown): ValidationResult {
  const errors: string[] = [];
  const obj = data as Record<string, unknown>;

  if (!obj || typeof obj !== "object") {
    return { valid: false, errors: ["Root is not an object"], rule_count: 0 };
  }

  if (typeof obj.version !== "string") {
    errors.push("Missing or invalid 'version' field");
  }

  if (!Array.isArray(obj.rules)) {
    return { valid: false, errors: ["'rules' must be an array", ...errors], rule_count: 0 };
  }

  const rules = obj.rules as unknown[];
  for (let i = 0; i < rules.length; i++) {
    errors.push(...validateRule(rules[i], i));
  }

  // Check for duplicate IDs
  const ids = rules.map((r) => (r as Record<string, unknown>).id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) {
    errors.push(`Duplicate rule IDs: ${[...new Set(dupes)].join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    rule_count: rules.length,
  };
}

/**
 * Parse and validate a rules file from JSON string
 */
export function parseRulesFile(jsonStr: string): { data: TamerRulesFile | null; errors: string[] } {
  try {
    const parsed = JSON.parse(jsonStr);
    const result = validateRulesFile(parsed);
    if (result.valid) {
      return { data: parsed as TamerRulesFile, errors: [] };
    }
    return { data: null, errors: result.errors };
  } catch (e) {
    return { data: null, errors: [`JSON parse error: ${e instanceof Error ? e.message : String(e)}`] };
  }
}
