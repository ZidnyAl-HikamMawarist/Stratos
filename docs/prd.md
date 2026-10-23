# Stratos (`Stratos.exe`)
## Product Requirements Document (PRD) & Design System

**Version:** 3.1.0  
**Status:** Implementation baseline; technical decisions and integrations must be verified before use  
**Target:** Windows desktop  
**Default locale:** Bahasa Indonesia (`id-ID`); English (`en-US`) also supported  
**Architecture:** Electron + React/TypeScript + local AI router + dual-mode coding workspace

> This document is the product-level source of truth. Supporting technical decisions, security tests, provider compatibility, and acceptance tests are defined in the companion documents in this folder. Do not assume that a named provider or repository is compatible until verified.

---

## 0. Mandatory instructions for AI coding agents

1. Read this entire PRD and the four companion documents before starting work.
2. Inspect the existing repository, package scripts, dependency versions, Git status, tests, and current architecture before changing files.
3. Do not invent APIs, repository behavior, provider capabilities, pricing, test results, or file paths.
4. Work on **one milestone at a time**. Plan it, implement it, run relevant checks, report results, then stop and request explicit user approval before starting the next milestone.
5. Never claim a feature works unless it has been run or otherwise verified. Clearly distinguish automated tests, manual tests, untested assumptions, and known limitations.
6. Never overwrite user work, discard uncommitted changes, reset Git history, or run destructive commands without explicit approval.
7. Keep changes focused; do not silently refactor unrelated areas or add dependencies without explaining the reason.
8. If requirements conflict with technical reality, security, upstream license, provider terms, or compatibility, stop and present options before making a consequential decision.
9. UI must follow Section 5. No fake status, fake analytics, placeholder buttons presented as functional, generic SaaS hero sections, neon gradients, emoji labels, or decorative dashboards.
10. After each milestone, report files changed, features implemented, commands/tests run and actual results, known issues, and user verification steps.

### Required milestone gates

- **M1:** Desktop shell, theme, localization, launcher.
- **M2:** Router foundation, first verified provider, account integration only after verification, request logs and analytics.
- **M3:** Dual-mode workspace, safe file access, editor, terminal, agent interaction and diff review.
- **M4:** Bounded retry/failover, recovery tests, security/release review, Windows packaging.

Do not begin the next milestone until the user explicitly approves the current milestone.

---

## 1. Product vision

Stratos combines two related capabilities in a local Windows application:

1. **AI Router & Usage Dashboard:** route supported model requests through configured provider/model candidates, manage verified connections, inspect request outcomes, and report usage with honest pricing labels.
2. **Dual-Mode Coding Workspace:** work with local code in an IDE-style layout or a terminal-centric agent layout, with visible tool activity, controlled terminal execution, and reviewable file changes.

The product prioritizes user control, security, truthful status, recoverable work, and modular integrations. It must not promise perfect continuation across providers or access methods that violate provider rules.

### Product principles

- Local-first storage for settings, sessions, and logs unless the user explicitly chooses otherwise.
- Explicit consent for authentication, file access, shell execution, and risky operations.
- Distinguish connected, authenticated, tested, degraded, rate-limited, unsupported, and disconnected states.
- Separate provider adapters, router policy, agent orchestration, workspace services, persistence, and UI.
- Minimize retained data and redact secrets.
- Working, tested vertical slices take precedence over breadth of features.
- Follow provider terms and supported authentication mechanisms.

### Non-goals for the first release

- Guaranteed invisible failover for every mid-stream failure.
- Universal compatibility with every OAuth/SSO login, model, CLI, or subscription.
- Bypassing quotas, access controls, subscription restrictions, or provider usage policies.
- A hosted collaboration service or remote telemetry by default.
- Full parity with mature commercial IDEs.
- Arbitrary shell execution without user-visible controls.
- Claiming that reference API value is actual cost or guaranteed savings.
- Undocumented scraping or reuse of browser cookies/session secrets.

---

## 2. Users, core problems, and success measures

### Primary users
- Developers who use multiple AI providers/accounts for coding.
- Developers who want one local place for provider setup, request visibility, and code editing.
- Users who prefer either an IDE layout or a terminal-centric agent workflow.

### Core problems
- Provider configuration is scattered across tools.
- Token usage, request failures, and provider switching are difficult to inspect.
- Manual switching can interrupt coding work.
- Coding agents, terminals, diffs, and provider settings are split across applications.
- Estimated value and actual charges are easily confused.

### Success measures
Track locally, by default:
- Successful, failed, retried, rate-limited, and rerouted requests.
- Provider/model attempts and fallback outcomes.
- Input/output token counts with reported-versus-estimated provenance.
- Crash/startup reliability and measured performance.
- File changes accepted/rejected and terminal processes cancelled/failed.
- Installer, upgrade (if supported), and uninstall outcomes.

No telemetry is sent to Stratos developers unless a future opt-in feature is separately designed and documented.

---

## 3. Platform, stack, and architecture

### Platform
- Windows 10/11 x64 is the intended target; exact minimum supported build must be recorded before release.
- Portable build and/or NSIS installer.
- Remote AI use requires internet; local settings and stored logs should remain accessible offline where feasible.

### Preferred stack

| Layer | Preferred technology | Constraints |
|---|---|---|
| Desktop | Electron | Current supported, patched version; hardened renderer settings |
| UI | React + TypeScript | Strict typing where practical |
| Styling | Tailwind CSS + design tokens | Avoid scattered hard-coded colors |
| UI primitives | shadcn/ui / Radix | Must follow Stratos design system |
| Icons | lucide-react | Monochrome SVG |
| UI state | Zustand | Separate transient UI state from domain persistence |
| Database | SQLite via maintained Electron-compatible integration | Verify native module rebuild compatibility |
| Secrets | Windows Credential Manager or suitable OS-protected secret store | Never plain-text settings/database |
| Editor | @monaco-editor/react | File access through controlled services |
| Terminal | xterm.js + node-pty | PTY lifecycle owned by privileged service |
| Panels | react-resizable-panels | Enforce minimum usable widths |
| Packaging | electron-builder | Test actual Windows builds |
| Tests | Vitest/Jest and Playwright or compatible alternatives | Choose after inspecting repo |

Do not select versions solely because they are latest. Verify compatibility, maintenance, security advisories, and licenses.

### Logical architecture

1. **Renderer UI:** React screens, editor, terminal display, and user interaction.
2. **Preload/IPC boundary:** narrow, typed, allowlisted operations; validate all arguments and sender identity.
3. **Application services:** settings, account metadata, routing, request logs, pricing, sessions.
4. **Router:** provider adapters, normalized request/response, routing policy, bounded retries, usage capture.
5. **Agent orchestrator:** conversation state, tool schemas, cancellation, tool execution policy, recovery.
6. **Workspace services:** project-root enforcement, file operations, Git inspection, PTY lifecycle, preview lifecycle.
7. **Persistence:** SQLite for structured non-secret data; OS-protected store for credentials.
8. **External providers:** only verified and permitted integrations.

Renderer processes must not have unrestricted Node.js access. UI components must not own router or agent business logic.

---

## 4. Navigation and functional requirements

### 4.1 Home / Launcher

**Header**
- Theme toggle: Obsidian Slate / Soft Nordic Ice.
- Language switcher: Bahasa Indonesia / English.
- Settings access.
- Dynamic localized labels.

**Main area**
- `Stratos` name and actual app version.
- Router state: Stopped, Starting, Active, Degraded, Error.
- Connected-account count from actual stored state.
- Three destinations: Dashboard, Workspace, Settings.

**Acceptance criteria**
- Launcher renders on startup without blank screen.
- Theme and locale switch without restart and persist.
- Navigation opens correct pages.
- Router status is derived from real service state.
- Empty state is useful when no provider is connected.

### 4.2 Dashboard

#### Overview / Analytics
Four distinct metrics:
1. Total requests, with success/failure/retry/reroute breakdown.
2. Input tokens.
3. Output tokens.
4. Estimated value/cost, with actual cost separated from reference value.

Charts show real stored data only. Empty states explain how to create data. Token counts and prices use tabular numerals. Date/provider/model filters should be provided where useful.

#### Providers & Accounts
Potential API-key integrations include OpenRouter, Google AI Studio, Groq, and DeepSeek, subject to verification. Potential account-based integrations include Google Antigravity, OpenCode, Claude Code, Gemini CLI, Cursor, and GitHub Copilot, only where a supported, permitted, technically verified integration exists.

Each integration displays:
- Provider, account label, supported models, and authentication type.
- Connection/test state and last successful test.
- Verified capabilities: streaming, tool calling, usage reporting, context limit, constraints.
- Quota status only when supplied by a reliable source.
- Relevant actions: Connect, Configure, Test, Disconnect, Revoke, Remove.

API-key requirements:
- Mask by default; optional reveal.
- Explicit save action.
- Redact secrets from logs and error messages.
- Test without exposing the key.

Account authentication requirements:
- Use documented/provider-approved flows.
- Use authorization-code + PKCE where supported.
- Validate OAuth state and redirect handling.
- Do not use undocumented cookie/session extraction.
- Clearly identify account and authentication window.
- Explain disconnect/revocation.

#### Combos & Routing Policies
A combo is an ordered list of provider/model candidates. Configure:
- Name, candidates, and order.
- Required capabilities (streaming/tool calling).
- Eligible error categories.
- Maximum attempts and total retry time.
- Per-provider cooldown.
- Optional context/cost preference.
- Behavior when no candidate is compatible.

Skip candidates that cannot satisfy required capabilities. Bound retries and never rotate indefinitely to evade provider quotas. Make every attempt and switch observable.

#### Request Logs & Token Inspector
Where available, store:
- Timestamp, correlation ID, provider/model, outcome.
- Error category, latency, time to first token, retry/fallback events.
- Input/output token counts and provenance (reported/estimated).
- Actual cost and reference value as separate fields.
- Redacted metadata and response status.

Do not store API keys, access/refresh tokens, cookies, authorization headers, or full source-code prompts by default. Prompt/response retention, if ever offered, requires explicit opt-in and clear retention/deletion controls.

#### Local Endpoint
- Loopback binding by default, not all interfaces.
- Separate local access token or equivalent request authentication.
- Do not rely on CORS as authentication.
- Validate Host/Origin and guard against DNS rebinding/browser-origin access.
- Show actual address/port and running state.
- Allow stopping service and report port conflicts.
- Never print local access tokens in ordinary logs.
- `20128` is a preferred default, not a guaranteed available port.

#### Pricing
Store dated pricing snapshots rather than hard-coded values in UI:
- Provider/model identifier.
- Input/output price and unit.
- Currency.
- Effective/verified timestamp.
- Source URL or documented source.
- Verification state.

Definitions:
- **Actual Cost:** amount billed or reported by provider, if known.
- **Estimated API Equivalent:** reference price for equivalent measured/estimated usage.
- **Estimated Value:** reference value, not actual cash value.
- **Estimated Savings:** show only when baseline and calculation are defensible.

For free/subscription usage, never label reference value as actual charge or guaranteed savings. If price or exchange rate is unknown, show Unknown or USD-only rather than inventing a value.

### 4.3 Settings
Include:
- Default workspace folder.
- Theme and locale.
- Router port/startup behavior.
- Log retention and prompt/response logging controls.
- Default combo/model.
- Pricing source and exchange-rate settings.
- Terminal shell choice, if supported.
- Workspace safety preferences.
- Version, diagnostics, licenses, and data location.
- Export/delete logs and clear stored connections.

Dangerous settings require clear consequences and confirmation.

---

## 5. Design system

### 5.1 Design goals
Professional, compact, developer-focused, accessible, and visually calm. No fake functionality or decorative content.

### 5.2 Obsidian Slate (default)

```css
:root[data-theme="obsidian"] {
  --bg-primary: #0B0F17;
  --bg-secondary: #111827;
  --bg-tertiary: #1E293B;
  --border-subtle: #1F2937;
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --accent-primary: #38BDF8;
  --accent-hover: #0284C7;
}
```

### 5.3 Soft Nordic Ice

Pure white `#FFFFFF` must not be used as a main surface color.

```css
:root[data-theme="nordic"] {
  --bg-primary: #F4F7FB;
  --bg-secondary: #EAF0F8;
  --bg-tertiary: #FAFCFF;
  --border-subtle: #D5E2F2;
  --text-primary: #1E293B;
  --text-secondary: #475569;
  --accent-primary: #0284C7;
  --accent-hover: #0369A1;
}
```

### 5.4 Strict visual rules
1. No neon/cyberpunk gradients or excessive glow.
2. Default radius maximum 6–8 px.
3. Compact spacing; common panel padding 12–16 px.
4. Monochrome Lucide SVG icons, generally 14–16 px, stroke width 1.75.
5. No emojis in UI buttons, titles, navigation, or status labels.
6. No oversized SaaS hero or unnecessary decoration.
7. Prefer 1 px borders to heavy shadows.
8. Use `font-variant-numeric: tabular-nums` for tokens, prices, timings, and aligned numbers.
9. Reuse design tokens; avoid one-off colors.
10. Provide hover, focus, active, disabled, loading, error, and empty states.
11. Use visible keyboard focus and adequate contrast.
12. Do not use color alone for status.
13. No fake account counts, fake online status, fake charts, or inert buttons presented as functional.
14. On narrow windows, collapse secondary panels instead of allowing overlap.

### 5.5 Layout
- Workspace header target: 40 px.
- Workspace bottom status bar target: 24 px.
- Dashboard: sidebar plus responsive content.
- Resizable panels only where useful; enforce minimum widths.
- Preserve panel layout where possible.

### 5.6 Localization
- Default `id-ID`; secondary `en-US`.
- Stable translation keys; no hard-coded UI strings.
- Locale-aware dates/numbers/currency.
- Do not translate code, model IDs, or shell output.
- Switching locale must not require restart.
- Test for missing keys and clipped strings.

---

## 6. Workspace requirements

Workspace operations are restricted to the selected or explicitly approved project root by default.

### 6.1 Header
- Home/Dashboard navigation.
- Workspace name/path and folder-switch action.
- Active combo/model.
- Mode switcher: IDE Mode / Terminal Agent Mode.
- Theme/language controls.
- Agent activity and cancellation state.

### 6.2 IDE Mode

**File explorer**
- Browse files under workspace root.
- Respect ignore rules where appropriate without making files inaccessible.
- Refresh and clear permission errors.
- Prevent symlink/path traversal outside root unless explicitly approved.
- Exclude secrets/generated folders from agent context by default where feasible.

**Monaco editor**
- Multi-tab editor, dirty state, unsaved-change confirmation.
- Safe file read/write through privileged services.
- Detect external modifications where feasible.
- Avoid silent overwrites and preserve encoding/line endings where practical.

**Agent panel**
- Session identity, model/combo, composer, send/stop/retry/error states.
- `@file` context tagging with visible references.
- Show tool activity/results and which files are in context.
- Cancellation prevents future tool actions where possible.
- Never claim a file was read or changed unless verified.

**Diff review**
- Show proposed changes before applying where practical.
- Accept/reject by file or change.
- Display changed-file list and summary.
- Preserve recoverable patch/diff record.
- Detect underlying file changes and warn about conflicts.
- Do not silently accept destructive edits.

**Integrated terminal**
- xterm.js renders terminal output; node-pty is controlled by a privileged service.
- Show shell, working directory, process state, and exit status.
- Allow process termination.
- Validate IPC and restrict process spawning.
- Require confirmation for commands considered high-risk by the configured policy.
- Do not claim dangerous-command detection is perfect.

**Optional live preview**
- Treat preview content as untrusted.
- Isolate preview from privileged APIs.
- Never expose Electron preload APIs to arbitrary web content.
- Preview may be deferred if it threatens MVP stability.

### 6.3 Terminal Agent Mode
- Approximately 70% command/agent event stream and 30% modified-file/diff inspector.
- Keyboard-oriented, compact, expandable long outputs.
- Clearly distinguish suggested commands from commands actually executed.
- Same diff and workspace safety rules as IDE Mode.

“Terminal Agent Mode” describes Stratos UX and does not mean OpenCode is integrated. Actual OpenCode integration requires a separate approved decision and verified protocol, version, authentication, lifecycle, and license review.

### 6.4 Status bar
Show only verified state:
- Active provider/model/combo.
- Current-session input/output usage if known.
- Clearly labeled estimated value.
- Agent/terminal state.
- Workspace/Git status if available.

No emoji labels or fabricated values.

---

## 7. Agent orchestration and tools

### Separation
The agent orchestrator manages normalized conversation state, tool calls/results, routing, cancellation, workspace operations, change records, and recovery. It must not live inside a React component.

### Tool execution
- Define finite tools with validated schemas.
- Validate arguments before execution.
- Execute only through application services.
- Use invocation IDs, timeouts, output limits, and structured results.
- Redact secrets.
- Require approval for high-risk actions unless the user explicitly configures a narrower trusted policy.
- Never execute model-generated text as a shell command outside the explicit command flow.

### Session state
Persist according to user retention settings:
- Session ID/timestamps.
- Normalized messages.
- Provider/model attempts and fallback events.
- Tool calls/results/status.
- Workspace reference.
- Pending/completed change proposals.
- Cancellation/error state.

Avoid storing complete source contents unnecessarily. Prefer file references and patch records.

### Partial output and cancellation
- Stop generation and tool execution separately.
- Explain when cancellation is best-effort.
- Preserve partial output but mark it incomplete.
- Do not execute malformed/incomplete tool calls.
- Do not apply incomplete changes automatically.

---

## 8. Router and failover behavior

This section overrides any assumption that failover must always be invisible.

### 8.1 Request lifecycle
Every logical request has a correlation ID and one or more attempt records. Suggested states:
`queued`, `sending`, `streaming`, `completed`, `failed`, `cancelled`, `retrying`, `rerouted`, `needs_user_action`.

### 8.2 Error classification
Normalize authentication, rate limit/quota, transient network, provider outage, invalid request, unsupported capability, context length, policy refusal, cancellation, and unknown errors.

Retry only categories allowed by policy. Do not blindly retry invalid requests, refusals, or unsupported capabilities.

### 8.3 Retry rules
- Bound attempts and elapsed time.
- Respect `Retry-After` where available.
- Apply provider cooldown.
- Prevent loops and unbounded account rotation.
- Make attempts observable.
- Do not retry non-idempotent tool actions without verifying whether they already ran.

### 8.4 Streaming
- Failure before output: automatic retry may be permitted by policy.
- Failure after streaming begins: preserve and label partial output; never silently concatenate different provider outputs as if continuous.
- Restart from a safe checkpoint when possible; otherwise request user action.
- Validate tool-call completeness and deduplicate execution where possible.

### 8.5 Context preservation
Preserve normalized messages, relevant tool results, workspace references, and change state. Context transfer reconstructs a compatible request; it cannot transfer hidden internal reasoning or guarantee identical model continuation.

Before switching, check destination capabilities and context limits. Summarization/trimming must follow an explicit logged policy. If recovery could repeat destructive work, ask the user.

### 8.6 Required failover scenarios
- 429 before stream selects compatible secondary.
- Authentication failure does not loop indefinitely.
- Partial stream remains marked interrupted and is not silently merged.
- Interrupted tool call is not automatically duplicated.
- Candidate without required tool calling is skipped.
- All candidates fail with useful error and intact request history.
- Cooldown and maximum attempts are respected.
- Cancellation prevents subsequent tool actions where possible.

---

## 9. Security and privacy requirements

Security applies from M1 onward.

### Electron
- `nodeIntegration: false`.
- `contextIsolation: true`.
- Renderer sandbox enabled where compatible; any exception requires written justification and threat review.
- Narrow preload API; no generic arbitrary IPC exposure.
- Validate IPC sender and every argument.
- Restrictive Content Security Policy.
- Restrict navigation, window creation, and permissions.
- Never load untrusted remote content in a privileged window.
- Keep Electron and dependencies patched.
- Review Electron security checklist before release.

### Credentials
- Use Windows Credential Manager or an appropriate OS-protected secret store where feasible.
- Never store raw keys/tokens/cookies in plain-text JSON or ordinary database fields.
- Redact secrets from logs, crash reports, and diagnostic exports.
- Provide disconnect/delete/revoke controls where supported.
- Do not overpromise protection from malware running as the same user.

### Local service
- Loopback binding by default.
- Authenticate local requests independently from upstream provider keys.
- Validate Host/Origin where relevant; protect against DNS rebinding and cross-origin access.
- Do not rely on CORS alone.
- Do not expose local access tokens in normal logs.

### Filesystem and shell
- Restrict file operations to selected root by default.
- Normalize paths; test traversal and symlink escapes.
- Require explicit permission for access outside root.
- Show high-risk command and working directory before execution.
- Make process status and cancellation visible.
- Never silently delete/overwrite/run arbitrary files.
- Maintain recoverable diffs where practical.

### Retention
- Document data locations and retention.
- Allow export/clear of logs and session history.
- Default to minimal retention and no remote telemetry.
- Explain what deletion does and does not remove.

### Threats to assess
Malicious project files/prompt injection, browser-origin requests to local router, malicious provider responses, secret leakage, path traversal, untrusted shell commands, dependency supply-chain issues, unintended network exposure, malformed IPC, and installer/update tampering.

---

## 10. Data model and persistence

Suggested logical entities (adapt after repository inspection; do not create unnecessary tables):
- `app_settings`
- `provider_definitions`
- `provider_accounts` (non-secret metadata only)
- `model_catalog`
- `combos`
- `combo_candidates`
- `requests`
- `request_attempts`
- `usage_records`
- `pricing_snapshots`
- `agent_sessions`
- `agent_messages`
- `tool_invocations`
- `change_sets`
- `schema_migrations`

Use parameterized DB operations, versioned migrations, indexes for common filters, bounded log growth, and documented recovery. Never silently delete user history to repair migration failure. Secrets do not belong in these tables.

---

## 11. Provider compatibility and licensing

Maintain a support matrix for each exact integration:
- Repository/provider and exact integration method.
- Auth method and restrictions.
- Supported models.
- Chat, streaming, tool calling, usage reporting.
- Context limits and known limitations.
- Rate-limit/error behavior.
- Last verified date.
- Status: Verified, Experimental, Unavailable, or Deprecated.

Candidate references:
- 9Router: `https://github.com/decolua/9router`
- OpenCode: `https://github.com/sst/opencode` and/or current canonical repository, to be verified.
- Monaco React: `https://github.com/suren-atoyan/monaco-react`
- xterm.js: `https://github.com/xtermjs/xterm.js`
- node-pty: `https://github.com/microsoft/node-pty`

A URL is a research starting point, not proof of current maintenance, API compatibility, license suitability, or provider permission. Inspect licenses, dependency notices, build/test steps, maintenance, advisories, and terms before integration.

---

## 12. Error handling and observability

Show truthful loading, success, partial success, failure, timeout, cancellation, and unsupported states. Provide a request ID and safe diagnostic summary where useful. Redact secrets. Keep raw stack traces out of ordinary user messages. Handle offline mode, invalid credentials, quotas, malformed responses, database errors, port conflicts, missing shell, PTY failures, and permission denial. Never swallow errors or show fake success.

---

## 13. Accessibility and usability

- Keyboard-accessible controls and visible focus.
- Essential information must not be tooltip-only.
- Respect Windows text scaling where practical.
- Adequate contrast in both themes.
- Icon-only status must include accessible labels.
- Localization must not clip content.
- Destructive actions need confirmation and non-destructive workflows need cancellation.

---

## 14. Testing strategy

### Unit tests
Routing, error classification, retry eligibility, token/cost calculations, locale formatting, redaction, path validation, IPC validation, migrations, persistence.

### Integration tests
Mock providers, adapter normalization, streaming failures, usage accounting, secret store where testable, agent tool lifecycle, file/diff flow, terminal process lifecycle, restart persistence.

### End-to-end journeys
1. Switch theme/locale, restart, verify persistence.
2. Configure a test provider, make request, inspect redacted logs.
3. Configure combo and simulate fallback.
4. Open workspace, edit, review/reject a diff.
5. Run and stop a harmless command.
6. Cancel agent request and ensure no new tool action starts.
7. Export/clear logs.
8. Install/launch/uninstall packaged build; test upgrade if supported.

Use mock providers and synthetic data for deterministic tests. Never commit real credentials or personal source code. Report tests honestly.

---

## 15. Performance and reliability

Measure on a declared Windows reference machine rather than promising unmeasured RAM or installer size. Measure cold startup, idle RAM, active router, editor, and terminal-heavy use. Keep UI responsive during requests; paginate/virtualize large logs; bound terminal output; clean up child processes; ensure provider outages do not freeze the UI; preserve data on migration failure.

---

## 16. Milestones and release gates

### M1 — Desktop Shell
Scope: Electron/React/TypeScript, secure preload/IPC, themes, ID/EN, launcher, navigation, persisted preferences, empty/loading/error states.

Pass criteria:
- Runs in development on target Windows environment.
- Theme/locale switch and persist.
- Navigation works.
- Renderer has no unrestricted Node access.
- No fake status/analytics.
- Lint, typecheck, and available tests report actual results.
- User explicitly approves M1.

### M2 — Router, providers, analytics
Sub-phases:
1. Inspect router repo/docs and complete compatibility/license review.
2. Implement secure local router foundation with IDs, errors, logs, mock tests.
3. Integrate one verified API-key provider end-to-end.
4. Add one account-based provider only after authentication method is verified.
5. Add usage dashboard and dated pricing.

Pass criteria:
- At least one real provider request works.
- Logs redact secrets.
- Loopback/auth behavior tested.
- Token provenance displayed.
- Missing prices remain unknown.
- User explicitly approves M2.

### M3 — Dual-mode workspace
Sub-phases:
1. Workspace root and filesystem boundaries.
2. Monaco tabs, dirty state, safe writes.
3. Controlled PTY and process lifecycle.
4. Agent sessions, file context, diff review, accept/reject.
5. Terminal Agent Mode using shared services.

Pass criteria:
- User can open a project, edit a file, review a diff, run/stop a command.
- Path boundaries are tested.
- Mode switching does not discard unsaved work.
- Agent tool activity is observable.
- User explicitly approves M3.

### M4 — Resilience and release
Sub-phases:
1. Bounded retries/cooldown and compatible fallback.
2. Agent state recovery and partial stream tests.
3. Security/performance/dependency/license review.
4. Portable/NSIS packaging and install tests.

Pass criteria:
- Required failover scenarios pass.
- No promise of perfect cross-provider continuation.
- Installer works on declared Windows environment.
- Critical known issues are resolved or documented with release decision.
- Release notes, license notices, and basic documentation exist.
- User explicitly approves M4.

### Release checklist
- [ ] Milestone criteria met and recorded.
- [ ] Provider matrix current.
- [ ] Provider terms/auth/license reviewed.
- [ ] No real secrets in repo/logs/fixtures/build.
- [ ] Electron security settings reviewed.
- [ ] Router loopback/auth verified.
- [ ] Filesystem/terminal boundaries tested.
- [ ] Retry/fallback bounded and observable.
- [ ] Partial streams not silently merged.
- [ ] Pricing sourced and labeled.
- [ ] Migrations/recovery tested.
- [ ] Both themes and locales checked.
- [ ] Test results accurately reported.
- [ ] Windows build tested.
- [ ] Known limitations and notices documented.
- [ ] User approves release candidate.

---

## 17. MVP prioritization

### P0 — First usable vertical slice
- Secure desktop shell, themes, localization.
- One verified API provider and authenticated local router.
- Request logs with secret redaction and usage accounting.
- Workspace selection, Monaco editor, controlled terminal.
- Manual model/provider selection.
- Basic agent interaction, diff review, cancellation.
- Safe credential storage.

### P1 — Expand after P0 is stable
- One verified account-based integration.
- Combos and bounded pre-stream fallback.
- Additional providers.
- Dashboard analytics/pricing snapshots.
- Terminal Agent Mode and persisted sessions.

### P2 — Defer until validated
- Broad account/provider matrix.
- Advanced multi-account pooling.
- Mid-stream automatic agent recovery across heterogeneous providers.
- Multi-framework live preview.
- Advanced savings analytics.
- Deep external agent engine integration.

These priorities do not change the four milestone gates; they control implementation breadth.

---

## 18. Definition of Done

A feature is done only when:
1. Requirements and behavior are described.
2. Implementation is present and connected to real state/services.
3. Relevant automated tests are added or an explicit reason is documented.
4. Lint/typecheck/build checks are run where available.
5. Manual verification steps are recorded for UI/system behavior.
6. Errors, loading, empty, and cancellation states are handled.
7. Secrets and unsafe side effects are reviewed.
8. Documentation is updated.
9. Actual test results and known limitations are reported.
10. User verifies the milestone and explicitly approves continuation.

A passing typecheck alone does not prove product behavior. A screenshot alone does not prove integration. Unrun tests must be labelled unrun.

---

## 19. Open decisions

Do not silently invent answers:
1. New repository or existing project?
2. 9Router dependency, fork, or adapter-based integration?
3. Which first API provider and which first account-based integration?
4. Which local API formats are required for MVP?
5. Native Stratos agent orchestrator or external engine?
6. Is actual OpenCode integration required, or is Terminal Agent Mode sufficient?
7. Which workspace actions require confirmation?
8. Which official pricing and exchange-rate sources are approved?
9. Minimum Windows version/reference test machine?
10. Portable, NSIS, or both?
11. Default retention for logs and agent sessions?
12. Which P0 capabilities define the first usable release?

Ask only questions that block the current milestone; later decisions can remain open until relevant.

---

## 20. Final product promise

Stratos is successful when it provides a secure and useful local coding environment with a working AI router, not merely a polished UI. It connects verified providers, routes compatible requests with bounded policies, records usage honestly, lets users work with local files and terminal processes under visible control, and recovers from supported failures while clearly identifying cases that need user action.

**Execution rule:** plan one milestone, implement it, test it, demonstrate it, and wait for explicit user approval before moving on.
