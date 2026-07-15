/**
 * tamer v0.0 — Type Definitions
 *
 * ACMF (Agent Correction Memory Format) lite schema
 */

/** Intercept level — controls how strongly tamer enforces a rule */
export type InterceptLevel = "L1" | "L2" | "L3";

/** Rule status */
export type RuleStatus = "active" | "disabled" | "archived" | "review_needed";

/** Condition type for rule triggering */
export type ConditionType =
  | "always"               // always trigger when tool matches
  | "dangerous_command"     // only for bash with dangerous patterns
  | "cross_file_or_delete"  // only for cross-file edits or file deletion
  | "sudo"                  // only for bash with sudo
  | "uncertainty_signal"    // only when agent expresses uncertainty
  | "unread_file";          // only when editing a file not previously read

/** ACMF rule trigger specification */
export interface RuleTrigger {
  /** Tool names that this rule applies to */
  tool: string[];
  /** Condition type */
  condition: ConditionType;
}

/** ACMF rule (lite version of full ACMF spec) */
export interface TamerRule {
  id: string;
  name: string;
  trigger: RuleTrigger;
  instruction: string;
  intercept_level: InterceptLevel;
  status: RuleStatus;
  hit_count: number;
  pass_count: number;
  false_positive_count: number;
  created_at: string;
  last_hit_at: string | null;
  salience: number;
  source: "seed" | "personal" | "project";
}

/** Rules file format */
export interface TamerRulesFile {
  version: string;
  rules: TamerRule[];
}

/** Result of rule matching */
export interface MatchResult {
  matched: boolean;
  rule?: TamerRule;
  reason?: string;
}

/** tamer configuration */
export interface TamerConfig {
  rules_file: string;
  inject_enabled: boolean;
  block_enabled: boolean;
  trigger_detection_enabled: boolean;
}
