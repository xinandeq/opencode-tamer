# Tamer v0.1 Technical Preview Spec

> Updated 2026-07-15 | First adapter: OpenCode | Status: release candidate, not publicly published

## 1. Product Thesis

Coding agents repeatedly violate user-specific working rules because corrections disappear inside session history. Tamer converts an explicitly confirmed correction into a portable, inspectable policy and provides evidence when that policy later matters.

The wedge is **correction-to-policy**, not generic agent memory. Conversation recall, semantic search, autonomous profile inference, cloud sync, and multi-harness orchestration are outside v0.1.

## 2. Core Loop

```text
chat.message detects a correction signal
  -> agent proposes one concise reusable rule
  -> user explicitly confirms exact text
  -> tamer_remember writes an ACMF-lite personal rule
  -> system/compaction hooks inject active rules
  -> tool hook records matches or blocks known L1 hazards
  -> rules.json stores hit_count and last_hit_at
```

Detection alone never creates memory. This boundary prevents inferred preferences from silently becoming policy.

## 3. Scope

| In v0.1 | Not in v0.1 |
|:---|:---|
| OpenCode npm plugin contract | MCP server |
| Local atomic JSON rule store | Cloud account or sync |
| Explicit-confirmation rule creation | Automatic profile inference |
| Rule list/enable/disable/archive tools | Rule editing UI |
| L1 known-pattern block | General security sandbox |
| L2/L3 prompt injection | Semantic retrieval |
| Hit evidence | Automatic salience decay |

## 4. Interfaces

### `tamer_remember`

Inputs: `name`, `instruction` (max 300 chars), `intercept_level` (`L2` or `L3`). The tool description requires explicit confirmation before use. It writes a personal active rule and deduplicates normalized instruction text.

### `tamer_rules`

Actions: `list`, `enable`, `disable`, `archive`. Mutating actions require `rule_id`.

### Host Hooks

| Hook | Responsibility |
|:---|:---|
| `chat.message` | Read actual OpenCode `TextPart.text` and record correction signals |
| `experimental.chat.system.transform` | Inject active rules and the explicit-confirmation protocol |
| `experimental.session.compacting` | Re-inject active rules after compaction |
| `tool.execute.before` | Match tool calls, update evidence, throw on matched L1 rules |

## 5. Storage and Safety

- Path: `$TAMER_DIR/rules.json`, default `~/.tamer/rules.json`
- First load copies bundled seeds
- Writes use temporary file plus atomic rename
- Tamer-created files use mode `0600`
- Invalid storage fails open and logs the error
- Only the destructive-command seed is active by default
- Release package excludes Docker, tests, scripts, and credentials

Fail-open protects host availability, but it means Tamer is not a hard security boundary. Product copy must never claim complete protection.

## 6. Acceptance Evidence

| Criterion | Evidence on 2026-07-15 |
|:---|:---|
| Current SDK contract compiles | `tsc --noEmit` pass against `@opencode-ai/plugin 1.18.1` |
| Core logic and actual TextPart shape | 51 local tests pass |
| Reproducible isolated environment | 51 Docker tests pass on Tencent Cloud |
| Rule reaches the model | Real MiniMax session reproduced capture instruction and active seed |
| Confirmed correction becomes policy | Real session called `tamer_remember`; seventh rule persisted |
| L1 blocks before execution | Real `rm -rf /tmp/tamer-block-canary` call returned Tamer error |
| Side effect prevented | Canary file remained present |
| Release package is clean | npm dry-run contains 12 required files only |

## 7. Release Gate

Technical Preview can be published only after:

- [x] Local and cloud tests pass
- [x] Real OpenCode injection, remember, and block scenarios pass
- [x] Package contents exclude credentials
- [x] README describes package installation rather than broken single-file copy
- [ ] Previously exposed MiniMax key is rotated
- [ ] Public repository is extracted without tracked `node_modules`
- [ ] npm ownership and publish dry run are confirmed
- [ ] One external user completes installation without live founder repair

## 8. Success Metric

The v0.2 decision metric is not downloads. Across at least 20 dogfood sessions:

- confirmed useful rules created;
- repeated corrections before and after each rule;
- false-positive or unwanted injections;
- rule disable/archive rate;
- installation and recovery failures.

Proceed to public beta only if repeated corrections fall and rule noise remains tolerable.
