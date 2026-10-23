# Stratos Provider Compatibility Matrix
**Version:** 1.0.0  
**Status:** Initial template; all integrations are unverified until evidence is recorded.

## Status definitions
- **Verified:** Tested against the recorded version/date and supported flow.
- **Experimental:** A working proof of concept exists but has limitations or insufficient regression coverage.
- **Unavailable:** No supported integration currently verified.
- **Deprecated:** Previously supported, but should not be used for new configuration.

Never infer support from a product name, login button, GitHub repository, or successful authentication alone.

## Matrix

| Provider / integration | Intended auth | Chat | Streaming | Tool calling | Usage reporting | Last verified | Status | Notes / evidence |
|---|---|---:|---:|---:|---:|---|---|---|
| OpenRouter API | API key | TBD | TBD | TBD | TBD | Not checked | Unverified | Verify API contract and model capabilities |
| Google AI Studio API | API key | TBD | TBD | TBD | TBD | Not checked | Unverified | Verify current API and quota semantics |
| Groq API | API key | TBD | TBD | TBD | TBD | Not checked | Unverified | Verify model/tool support per model |
| DeepSeek API | API key | TBD | TBD | TBD | TBD | Not checked | Unverified | Verify model/tool support per model |
| Google Antigravity | Account-based | TBD | TBD | TBD | TBD | Not checked | Unverified | Confirm documented/allowed integration path |
| OpenCode | CLI/engine or API | TBD | TBD | TBD | TBD | Not checked | Unverified | Clarify UI inspiration vs actual engine |
| Claude Code | Account/CLI-specific | TBD | TBD | TBD | TBD | Not checked | Unverified | Do not assume generic API access |
| Gemini CLI | Account/CLI-specific | TBD | TBD | TBD | TBD | Not checked | Unverified | Verify official supported extension points |
| Cursor | Account/product-specific | TBD | TBD | TBD | TBD | Not checked | Unverified | Do not assume subscription can be routed as API |
| GitHub Copilot | Account/product-specific | TBD | TBD | TBD | TBD | Not checked | Unverified | Verify supported API and terms |

## Required verification per integration

1. Canonical official documentation and repository URL.
2. Exact integration type: public API, supported SDK, documented CLI, or other explicitly permitted method.
3. Authentication method and token lifecycle.
4. Current terms and restrictions relevant to the intended use.
5. Model identifiers and context limits.
6. Streaming behavior, including partial failure.
7. Tool/function calling schema and result behavior.
8. Token usage reporting and its reliability.
9. Error mapping: auth, rate limit, quota, network, server, invalid request.
10. Retry hints/cooldown behavior.
11. Automated contract test results.
12. Last verified date and tested version.

## Per-provider test record

- Provider/integration:
- Documentation URL:
- Repository/package and version:
- Auth method:
- Tested model(s):
- Test date and environment:
- Basic request:
- Streaming:
- Tool call:
- Usage reporting:
- Rate-limit/error behavior:
- Secret redaction:
- License/terms review:
- Limitations:
- Test output/evidence:
- Status and reviewer:

## Rules
- A provider is not “supported” merely because it appears in UI.
- Do not label quota as live unless a reliable supported source supplies it.
- Do not scrape private session cookies or use undocumented auth bypasses.
- Mark capability at the model level when models differ.
- If the provider's terms or supported interface prohibit the intended integration, mark it unavailable and propose a permitted alternative.
