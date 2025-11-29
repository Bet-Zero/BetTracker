---
name: audit-review
description: Review an existing Apex Audit file and build a structured Fix Plan.
---

You are running the **/audit-review** command in Cursor.

The user is NOT asking for a new audit.  
They are asking you to review an existing Apex Audit result and turn it into a safe, ordered **Fix Plan** that other commands can execute.

## INPUT

The user MUST tag exactly one existing audit markdown file when calling this command, for example:

- `/audit-review @audits/codebase-audit.md`
- `/audit-review @audits/parsing-module-audit.md`

If the user does NOT tag an audit file:

- Do NOT run anything.
- Reply in chat asking them to tag the specific audit markdown file.

## CORE BEHAVIOR

Load and follow the full instructions stored in:
`docs/cursor-prompts/AuditReviewPrompt.md`

Treat the tagged audit file as the source **diagnosis**.  
You are creating a refined, execution-ready **treatment plan**, NOT re-running a fresh audit.

## HARD RULES

Under `/audit-review` you MUST:

- Use ONLY the tagged audit file as input
- Follow the complete workflow outlined in `docs/cursor-prompts/AuditReviewPrompt.md`
- Create a Fix Plan file in `audits/` directory (same base name + `_fixplan` before extension)
- Double-check each issue against the current codebase
- Assign review status (CONFIRMED / ADJUSTED / REJECTED) and fix-safety flags (SAFE_AUTO / NEEDS_CONTEXT / NEEDS_DECISION)
- Pay special attention to duplicate/overlapping implementations
- Keep chat response short and human - do NOT paste full files or diffs

Perform the complete audit review workflow exactly as described in `docs/cursor-prompts/AuditReviewPrompt.md`.
