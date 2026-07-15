# Tamer

> Turn a confirmed correction into a portable policy for your coding agent.

Tamer is an OpenCode plugin that closes one small but valuable loop:

`user correction -> explicit confirmation -> structured rule -> later injection or block -> hit evidence`

It is not a general-purpose memory system. It keeps durable behavioral rules that the user explicitly confirms, stores them locally in `~/.tamer/rules.json`, and can move with the user across projects.

## Current Status

`v0.1.0 Technical Preview`

- OpenCode `1.18.1` verified
- 51 local tests and 51 isolated cloud tests pass
- Real-model verification covers prompt injection, confirmed rule creation, and physical blocking
- npm package: `opencode-tamer`

Do not treat this preview as a complete safety sandbox. L1 blocking covers known command patterns; malformed or unavailable rule storage fails open so Tamer does not disable the host agent.

## Install

Add it to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-tamer"]
}
```

OpenCode installs npm plugins automatically. On first load, Tamer creates `~/.tamer/rules.json` from bundled seeds. Only the destructive-command rule is active by default; preference examples remain disabled.

For source development:

```bash
bun install
bun run typecheck
bun run test:all
npm pack --dry-run --cache /tmp/tamer-npm-cache
```

Do not copy only `src/plugin.ts` into `.opencode/plugins/`: it imports sibling modules and that installation is incomplete. The verified local-preview path installs the complete package and uses a one-line local plugin entry.

## Use

When you correct the agent, Tamer detects the signal but does not save it automatically. The agent should propose one reusable rule and wait for explicit confirmation. It can then call:

- `tamer_remember`: save one confirmed L2 or L3 personal rule
- `tamer_rules`: list, enable, disable, or archive rules

Example:

```text
User: 不对，声明完成前必须先运行相关测试。请记住这条规则。
Agent: 建议保存为“完成前验证：声明完成前必须运行相关测试”，是否确认？
User: 确认。
Agent: calls tamer_remember
```

Rules are deduplicated by normalized instruction. Writes are atomic, and hit count plus last-hit time are persisted.

## Enforcement Levels

| Level | Behavior | Preview use |
|:---|:---|:---|
| L1 | Hook throws before a matched tool executes | Known destructive shell patterns |
| L2 | Rule is injected and matching is recorded | Confirm-before-action policies |
| L3 | Rule is injected into the system and compaction contexts | Preferences and working habits |

## Default Policy

Only `破坏性命令阻断` is active on first install. It blocks matched patterns such as `rm -rf`, `git reset --hard`, `drop table`, and `dd if=`. The remaining bundled rules are disabled examples so Tamer does not silently impose the author's preferences on a new user.

## Data

```text
~/.tamer/
├── rules.json   # versioned rules, mode 0600 on Tamer writes
└── hits.jsonl   # correction, match, and block evidence
```

Tamer sends no telemetry in v0.1. Rule data stays on the user's machine.

## Verification

Verified on 2026-07-15:

| Layer | Result |
|:---|:---|
| TypeScript contract | pass |
| Local unit + integration | 51 pass, 0 fail |
| Tencent Cloud isolated Docker | 51 pass, 0 fail |
| Real OpenCode + MiniMax | injection pass; confirmed rule persisted; destructive command blocked; canary preserved |
| npm dry-run package | 12 required files, no Docker config or credentials |

## Roadmap

| Version | Product question |
|:---|:---|
| v0.1 Technical Preview | Can a confirmed correction become a rule and prevent a repeat in OpenCode? |
| v0.2 Dogfood | Do the rules reduce repeated corrections over 20+ real sessions without noisy false positives? |
| v0.3 Public Beta | Can 10 external users install, understand, and retain it without founder support? |
| v0.4 Portable Core | Can the same rule store drive a second harness adapter without weakening semantics? |
| v1.0 | Is there repeatable willingness to pay for team policy sync, audit, and governance? |

## License

MIT
