# Tamer Decision Log

## 2026-07-14: OpenCode First

**Decision:** validate the first adapter on OpenCode.

**Why:** it exposes prompt, compaction, message, and pre-tool hooks through a maintainable TypeScript plugin API. ACMF-lite storage remains harness-neutral so a second adapter can be tested later.

## 2026-07-15: Narrow the Category

**Decision:** position Tamer as a correction-to-policy compiler, not a generic agent memory product.

**Why:** generic memory is crowded and difficult to evaluate. A confirmed correction has a clear source, a user-controlled write boundary, and a measurable outcome: whether the same correction is needed again.

## 2026-07-15: Explicit Confirmation Before Memory

**Decision:** correction detection never writes a rule by itself. The agent proposes exact text; `tamer_remember` is called only after user confirmation.

**Why:** inferred preferences create hidden policy and entropy. Confirmation keeps ownership with the user and makes each durable rule auditable.

## 2026-07-15: No MCP in v0.1

**Decision:** use OpenCode custom tools and local storage; postpone MCP.

**Why:** MCP adds deployment and protocol surface without improving the first value test. Portability comes from the rule format and adapter boundary, not from adding a server prematurely.

## 2026-07-15: Conservative Defaults

**Decision:** activate only the destructive-command seed. Ship other rules as disabled examples.

**Why:** “edit only after confirmation” and similar preferences are not universal. A memory product loses trust if the author's habits appear as the user's policy.

## 2026-07-15: Package Installation Is the Supported Path

**Decision:** publish/install the complete `opencode-tamer` package. Do not instruct users to copy `src/plugin.ts` alone.

**Evidence:** the entry imports sibling modules. On the real server, cross-directory re-export from `.opencode/plugins/` was resolved in configuration but did not activate; package installation initialized immediately and exposed all hooks and tools.

## 2026-07-15: Security Incident

**Finding:** a MiniMax API key was present in `docker/opencode-test.json`, and the old package configuration would have included that file in an npm tarball.

**Action:** replace the value with `{env:MINIMAX_API_KEY}`, add a strict package allowlist, add release hygiene files, and verify a 12-file tarball.

**Residual action:** rotate the exposed credential at MiniMax. Removing it from the current tree does not invalidate prior exposure.

## Verification Record

| Check | Result |
|:---|:---|
| Type check | pass |
| Local test | 51 pass, 0 fail |
| Cloud Docker test | 51 pass, 0 fail |
| Real OpenCode 1.18.1 injection | pass |
| Real confirmed `tamer_remember` | pass; personal rule persisted |
| Real L1 block | pass; tool returned Tamer error and canary survived |
| npm dry-run | 12 required files; no secret config |

Earlier “94 tests, 100%” reporting is retired. It mixed different suites and counted a missing correction signal as a pass. Tests now fail hard when that signal is absent.
