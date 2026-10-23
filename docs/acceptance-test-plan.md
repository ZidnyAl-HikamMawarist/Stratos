# Stratos Acceptance & Verification Test Plan
**Version:** 1.0.0  
**Purpose:** Define evidence required to pass milestones and prevent visual completion from being mistaken for functional completion.

## Result labels
- **PASS:** test ran and expected behavior observed.
- **FAIL:** test ran and behavior differed from expectation.
- **BLOCKED:** test could not run due to a documented blocker.
- **NOT RUN:** no execution evidence; must never be reported as passing.

Record app version/commit, Windows environment, commands, results, and relevant redacted evidence.

## Traceability
Use stable requirement/test IDs in issues, commits, and reports. Suggested pattern: `M1-UI-001`, `M2-ROUTER-001`, `M3-WS-001`, `M4-FAILOVER-001`. Every P0 requirement must map to at least one test or an explicitly documented manual verification.

## Milestone 1 — Desktop shell

| ID | Test | Expected result |
|---|---|---|
| M1-UI-001 | Launch app in development | Launcher appears; no blank screen or unhandled startup error |
| M1-UI-002 | Switch Obsidian/Nordic | Theme updates immediately and tokens remain consistent |
| M1-UI-003 | Switch ID/EN | All supported UI strings update without restart |
| M1-UI-004 | Restart app | Theme and locale persist |
| M1-UI-005 | Navigate all destinations | Correct screens open; no inert navigation |
| M1-SEC-001 | Inspect renderer privilege boundary | No unrestricted Node integration; preload API is narrow |
| M1-UI-006 | Inspect no-provider state | Honest, useful empty state; no fake connected status |
| M1-QA-001 | Run lint/typecheck/tests available in repo | Actual command and result recorded |

**Gate:** user inspects UI and explicitly approves before M2.

## Milestone 2 — Router/provider/analytics

| ID | Test | Expected result |
|---|---|---|
| M2-ROUTER-001 | Start/stop local router | State reflects actual service lifecycle |
| M2-SEC-001 | Request without local auth | Rejected |
| M2-SEC-002 | Check bind address | Loopback by default; no accidental public bind |
| M2-PROV-001 | Test one verified provider | Real request succeeds; provider/model recorded |
| M2-PROV-002 | Provider returns invalid credentials | Useful error; secret redacted; no retry loop |
| M2-LOG-001 | Inspect request record | Correlation ID, status, attempt history available |
| M2-LOG-002 | Search logs for canary secret | No occurrence in logs/diagnostics |
| M2-USAGE-001 | Provider reports usage | Input/output counts and provenance are correct |
| M2-PRICE-001 | Model has no verified price | UI shows Unknown, not invented value |
| M2-PORT-001 | Preferred port is occupied | Clear conflict handling or reported alternate port |

**Gate:** at least one real provider path and the security/logging checks pass; user approves before M3.

## Milestone 3 — Workspace

| ID | Test | Expected result |
|---|---|---|
| M3-WS-001 | Select workspace folder | Root displayed and enforced |
| M3-WS-002 | Read/edit/save file | Correct content saved; unsaved state visible |
| M3-WS-003 | File changes externally | Conflict is detected or overwrite is prevented where feasible |
| M3-SEC-001 | Attempt path traversal | Access outside root denied by default |
| M3-SEC-002 | Symlink points outside root | Access denied or explicit permission required |
| M3-DIFF-001 | Review and reject proposed diff | Original file remains unchanged |
| M3-DIFF-002 | Accept proposed diff | Only reviewed change is applied; result can be verified |
| M3-TERM-001 | Run harmless command | Output and exit status appear |
| M3-TERM-002 | Stop long-running harmless command | Process termination is reflected in UI |
| M3-AGENT-001 | Switch workspace mode | Session and unsaved changes are not silently discarded |
| M3-AGENT-002 | Cancel agent task | No subsequent tool action begins where cancellation can be enforced |

**Gate:** real local file and terminal workflow passes; user approves before M4.

## Milestone 4 — Failover/release

| ID | Test | Expected result |
|---|---|---|
| M4-FAILOVER-001 | Primary returns 429 before stream | Compatible secondary selected within attempt limit |
| M4-FAILOVER-002 | Primary auth error | Policy handles error without infinite rotation |
| M4-FAILOVER-003 | Primary fails mid-stream | Partial output marked interrupted, not silently concatenated |
| M4-FAILOVER-004 | Tool call is interrupted | No duplicate side effect from automatic retry |
| M4-FAILOVER-005 | Secondary lacks tool support | Candidate skipped |
| M4-FAILOVER-006 | All candidates fail | Clear error and full attempt history retained |
| M4-FAILOVER-007 | Cooldown/attempt limit configured | Policy is respected |
| M4-RELEASE-001 | Build portable/installer | Artifact produced and build result recorded |
| M4-RELEASE-002 | Install in clean test environment | App launches and basic functions work |
| M4-RELEASE-003 | Uninstall | Behavior and data-retention policy match documentation |
| M4-RELEASE-004 | Dependency/license/security review | Findings recorded; release blockers resolved or explicitly adjudicated |
| M4-RELEASE-005 | Child-process cleanup | No avoidable orphaned router/PTY processes remain after exit |

**Gate:** test results, known limitations, and release notes are reviewed; user approves release candidate.

## Test report template

```text
App version/commit:
Windows version and machine:
Milestone:
Test ID:
Command/steps:
Expected:
Actual:
Result: PASS / FAIL / BLOCKED / NOT RUN
Evidence:
Issue/reference:
Known limitations:
Reviewer:
```

## Rules against false completion
- A build succeeding does not prove runtime behavior.
- A screenshot does not prove backend integration.
- A mocked provider does not prove a real provider works.
- A passing test for one model does not prove every model supports the same capabilities.
- Untested requirements must remain NOT RUN or BLOCKED.
- Any skipped test needs a reason and an owner/next action.
