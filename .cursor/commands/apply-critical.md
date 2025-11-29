---
name: apply-critical
description: Apply Critical SAFE_AUTO fixes from a Fix Plan produced by /audit-review.
---

You are running the **/apply-critical** command in Cursor.

The user is NOT asking for a new audit.  
They are asking you to execute the **Critical SAFE_AUTO** fixes defined in a Fix Plan markdown file.

## INPUT

The user MUST tag exactly one existing Fix Plan markdown file when calling this command, for example:

- `/apply-critical @audits/codebase-audit_fixplan.md`
- `/apply-critical @audits/parsing-module-audit_fixplan.md`

If the user does NOT tag a Fix Plan file:

- Do NOT run anything.
- Reply in chat asking them to tag the specific Fix Plan markdown file.

## CORE BEHAVIOR

Load and follow the full instructions stored in:
`docs/cursor-prompts/ApplyCriticalPrompt.md`

Treat the tagged Fix Plan as the **execution plan** produced by `/audit-review`.  
Do NOT re-run an audit, invent new issues, or change severities or fix-safety flags.

## HARD RULES

Under `/apply-critical` you MUST:

- Use ONLY the tagged Fix Plan file as input
- Follow the complete workflow outlined in `docs/cursor-prompts/ApplyCriticalPrompt.md`
- Select only issues that meet ALL of:
  - Severity: `Critical`
  - Fix-safety flag: `SAFE_AUTO`
  - Review status: not `REJECTED` (must be `CONFIRMED` or `ADJUSTED`)
- Apply the smallest, safest set of code changes that fully implement fixes
- Follow existing patterns and style
- If no matching issues exist, explain clearly in chat
- Keep chat response short and human - do NOT paste large diffs or entire files

Perform the complete critical fix application workflow exactly as described in `docs/cursor-prompts/ApplyCriticalPrompt.md`.
