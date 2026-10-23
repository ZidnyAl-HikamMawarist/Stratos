# Stratos Architecture Decision Records (ADR)
**Version:** 1.0.0  
**Status:** Decision templates and provisional recommendations; confirm consequential choices with the project owner.

Use one ADR per consequential architecture decision. Do not treat provisional recommendations as proof that an integration works.

## ADR-001: Electron renderer privilege boundary
**Status:** Recommended  
**Decision:** Keep renderer unprivileged; use `nodeIntegration: false`, `contextIsolation: true`, sandboxing where compatible, a narrow preload API, sender validation, and typed/validated IPC.  
**Alternatives:** Expose Node APIs directly to renderer; use broad generic IPC methods.  
**Why:** Reduces the impact of renderer compromise and makes permissions auditable.  
**Consequences:** File, terminal, database, and secret operations must be implemented through explicit application services.  
**Validation:** Review the actual BrowserWindow configuration, IPC allowlist, sender checks, CSP, navigation restrictions, and tests against Electron's current security guidance.

## ADR-002: Provider adapter boundary
**Status:** Recommended  
**Decision:** Normalize provider capabilities and request/response events behind a provider-adapter interface.  
**Alternatives:** Provider-specific logic inside UI; assume all providers use identical APIs.  
**Why:** Provider formats, auth, streaming, tool calling, and usage reporting differ.  
**Consequences:** Maintain per-provider contract tests and a dated compatibility matrix.  
**Validation:** One mock adapter and one real provider must pass the same common contract where capabilities overlap.

## ADR-003: Router core choice
**Status:** Open; do not implement before review  
**Options:** Use 9Router as a dependency; fork it; build an adapter around it; implement a separate router.  
**Evaluation criteria:** Current maintenance, license, API surface, provider support, authentication method, security, testability, upstream update burden, and compatibility with Stratos's agent state model.  
**Required evidence:** Repository inspection, license review, build/test run, dependency review, and a small proof of concept.  
**Decision owner:** Project owner, informed by technical findings.

## ADR-004: Agent orchestration boundary
**Status:** Recommended  
**Decision:** Keep agent orchestration separate from React components and separate from provider routing.  
**Responsibilities:** Normalized session state, tool schema validation, tool lifecycle, cancellation, diff proposals, and safe recovery.  
**Why:** UI mode changes must not destroy sessions; router fallback must not duplicate side effects.  
**Validation:** A session continues across UI mode switching and survives a controlled app restart where persistence is enabled.

## ADR-005: Terminal Agent Mode vs actual OpenCode
**Status:** Open  
**Options:** Implement a Stratos-owned terminal-centric UX; integrate actual OpenCode as a child process or supported interface.  
**Rule:** UI resemblance does not imply engine integration.  
**Required evidence for OpenCode integration:** Canonical repository/version, supported protocol, process lifecycle, auth, workspace permissions, license and distribution review, cancellation behavior, and automated integration test.  
**Default recommendation:** Start with a Stratos-owned UX and a minimal native orchestrator unless a tested integration offers clear value.

## ADR-006: Credential storage
**Status:** Recommended  
**Decision:** Use Windows Credential Manager or a suitable OS-protected secret store; database stores only secret references and non-secret metadata.  
**Alternatives:** Plain-text settings file or ordinary SQLite columns.  
**Consequences:** Add credential-store abstraction, migration/error handling, disconnect and deletion paths.  
**Validation:** Automated tests verify redaction; manual tests verify save/read/delete and behavior when secret store is unavailable.

## ADR-007: Local router exposure
**Status:** Recommended  
**Decision:** Bind loopback by default and require a local access credential independent from upstream provider credentials.  
**Why:** Local services can be targeted by other local processes or browser-origin attacks. CORS is not authentication.  
**Validation:** Test unauthorized calls, unexpected Host/Origin, port conflict, and no secret leakage.

## ADR-008: Persistence and retention
**Status:** Recommended  
**Decision:** SQLite for structured records, versioned migrations, bounded logs, and explicit retention/deletion. Secrets stay outside ordinary tables.  
**Validation:** Migration tests, export/clear tests, and simulated migration failure without silent data loss.

## ADR-009: Failover semantics
**Status:** Recommended  
**Decision:** Bound retries, respect retry hints, apply cooldown, preserve attempt history, and do not silently merge partial streams from different providers.  
**Why:** Different models may differ in context, tool behavior, and output.  
**Validation:** Required failure scenarios in `acceptance-test-plan.md`.

## ADR-010: Pricing and usage semantics
**Status:** Recommended  
**Decision:** Separate actual billed cost, estimated API equivalent, estimated value, and estimated savings. Record source and date for price snapshots.  
**Validation:** Unknown prices remain unknown; free/subscription usage is not misrepresented as actual cost or guaranteed savings.

## ADR-011: Native dependencies and packaging
**Status:** Open until repository inspection  
**Decision criteria:** Electron version compatibility, ABI rebuild support, Windows signing/distribution requirements, installer lifecycle, and reproducible build process.  
**Validation:** Clean Windows build and install in a fresh test environment.

## ADR template
For future decisions, record:
- ID and title
- Status: Proposed / Accepted / Rejected / Superseded
- Context and constraints
- Options considered
- Decision and rationale
- Security/license impact
- Consequences and migration path
- Validation evidence
- Decision date and owner
