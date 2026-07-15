/**
 * tamer v0.0 — Correction Trigger Word Detection
 *
 * Detects when user is correcting the Agent, for future rule creation.
 * In v0.0, only logs the detection. v0.1+ will create rules.
 */

// Correction trigger words
const CORRECTION_TRIGGERS: RegExp[] = [
  /wrong/i, /no[,.]/i, /stop/i, /don'?t/i, /remember/i, /correct/i, /fix/i, /not\s+that/i, /again/i,
];

// Session end signals
const SESSION_END_TRIGGERS: RegExp[] = [
  /done/i, /finish/i, /wrap\s+up/i,
];

export interface TriggerResult {
  isCorrection: boolean;
  isSessionEnd: boolean;
  matchedPattern?: string;
  snippet?: string;
}

const MEMORY_CONFIRMATION_PATTERNS: RegExp[] = [
  /^\s*(yes|confirmed|I confirm)[.!]?\s*$/i,
  /I (?:explicitly )?confirm (?:saving|remembering|this rule)/i,
  /(?:please|you can) remember this rule/i,
]

/** Return true only for an explicit request to persist a rule. */
export function hasExplicitMemoryConfirmation(text: string): boolean {
  return MEMORY_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * Detect correction trigger words in user message.
 *
 * @param text - user message content
 * @returns detection result
 */
export function detectTriggers(text: string): TriggerResult {
  if (!text || typeof text !== "string") {
    return { isCorrection: false, isSessionEnd: false };
  }

  // Check correction triggers
  for (const pattern of CORRECTION_TRIGGERS) {
    if (pattern.test(text)) {
      return {
        isCorrection: true,
        isSessionEnd: false,
        matchedPattern: pattern.source,
        snippet: text.slice(0, 200),
      };
    }
  }

  // Check session end triggers
  for (const pattern of SESSION_END_TRIGGERS) {
    if (pattern.test(text)) {
      return {
        isCorrection: false,
        isSessionEnd: true,
        matchedPattern: pattern.source,
        snippet: text.slice(0, 200),
      };
    }
  }

  return { isCorrection: false, isSessionEnd: false };
}

/**
 * Count corrections in a message (for "3 corrections → prompt" feature)
 */
export function countCorrections(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (const pattern of CORRECTION_TRIGGERS) {
    const matches = text.match(new RegExp(pattern.source, "gi"));
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}
