---
name: fix-all
description: Apply all appropriate fixes from a Fix Plan produced by /audit-review.
---

You are running the **/fix-all** command in Cursor.

The user is NOT asking for a new audit.  
They are asking you to execute the Fix Plan produced by `/audit-review` and safely apply code changes.

## INPUT

The user MUST tag exactly one existing Fix Plan markdown file when calling this command, for example:

- `/fix-all @audits/codebase-audit_fixplan.md`
- `/fix-all @audits/parsing-module-audit_fixplan.md`

If the user does NOT tag a Fix Plan file:

- Do NOT run anything.
- Reply in chat asking them to tag the specific Fix Plan markdown file.

## CORE BEHAVIOR

Load and follow the full instructions stored in:
`docs/cursor-prompts/FixAllPrompt.md`

Treat the tagged Fix Plan as the **execution plan** produced by `/audit-review`.  
Do NOT re-run an audit, invent new issues, or change severities or flags.

## HARD RULES

Under `/fix-all` you MUST:

- Use ONLY the tagged Fix Plan file as input
- Follow the complete workflow outlined in `docs/cursor-prompts/FixAllPrompt.md`
- Apply SAFE_AUTO fixes (all severities) - always attempt
- Apply NEEDS_CONTEXT fixes cautiously - only if instructions are clear
- Do NOT change behavior for NEEDS_DECISION or REJECTED items (add TODOs if helpful)
- Make the smallest, clearest changes that fully implement fixes
- Preserve existing patterns and style
- Keep chat response short and human - do NOT paste large diffs or entire files

Perform the complete fix application workflow exactly as described in `docs/cursor-prompts/FixAllPrompt.md`.
