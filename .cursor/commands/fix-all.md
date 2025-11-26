---
name: fix-all
description: Apply all appropriate fixes from a Fix Plan produced by /audit-review.
---

You are running the /fix-all command in Cursor.

The user is NOT asking for a new audit.
They are asking you to execute the full Fix Plan produced by /audit-review.

INPUT REQUIREMENTS

- The user MUST tag exactly one existing Fix Plan markdown file when calling this command, for example:

  - /fix-all @audits/codebase-audit_fixplan.md
  - /fix-all @audits/parsing-module-audit_fixplan.md

- That tagged Fix Plan is the ONLY plan input you should use.
- Do NOT guess or pick a different file.
- You may also read #codebase and any referenced files to perform the edits.

If the user does NOT tag a Fix Plan file:

- Do NOT run anything.
- Reply in chat with:
  "I need you to tag the specific Fix Plan markdown file, for example:
  /fix-all @audits/codebase-audit_fixplan.md"

CORE BEHAVIOR

- Load and follow the full instructions stored in:
  docs/FixAllPrompt.md

- Treat the tagged Fix Plan as the execution plan produced by /audit-review.
  Do NOT re-run an audit or invent new issues.

- From the Fix Plan:

  - Parse all issues and their properties:
    - Severity (Critical / High / Medium / Low)
    - Fix-safety flag (SAFE_AUTO / NEEDS_CONTEXT / NEEDS_DECISION)
    - Review status (CONFIRMED / ADJUSTED / REJECTED)
    - Files involved
    - "What’s wrong (confirmed)"
    - "How to fix (clarified)"
    - "Impact"

- Decide what to apply using these rules:

  - ALWAYS attempt to apply:

    - Issues where:
      - Fix-safety flag: SAFE_AUTO
      - Review status: not REJECTED
      - Severity: Critical, High, Medium, or Low

  - APPLY CAUTIOUSLY:

    - Issues where:
      - Fix-safety flag: NEEDS_CONTEXT
      - Review status: not REJECTED
    - If the Fix Plan’s instructions are clear and limited in scope:
      - Apply the change carefully.
    - If the instructions are vague or the change appears large or risky:
      - Prefer a small safe improvement OR skip the change and add a short TODO comment.

  - DO NOT CHANGE BEHAVIOR for:
    - Issues where:
      - Fix-safety flag: NEEDS_DECISION
      - OR review status: REJECTED
    - For these:
      - Leave behavior unchanged.
      - Optionally add a concise TODO comment describing the decision needed.

- For each issue you decide to apply:

  - Open the referenced file or files.
  - Re-read “What’s wrong (confirmed)” and “How to fix (clarified)”.
  - Apply the smallest set of code changes that fully implement the described fix.
  - Follow existing patterns and style in that file.
  - If multiple issues touch the same area, merge the changes in a clean and consistent way.
  - If a requested change turns out to be ambiguous or too risky:
    - Prefer to skip it.
    - Add a short TODO explaining which Fix Plan item was skipped and why.

- You MAY optionally annotate the Fix Plan file (for example, marking items as APPLIED or SKIPPED), but this is optional.
  The main source of truth is the updated code.

CHAT RESPONSE STYLE

After running /fix-all:

- Keep your response short and human.
- Do NOT paste large diffs or entire files.

Respond with something like:

- "Applied fixes from: <fixplan path>"
- A few bullets summarizing the work, for example:
  - "Applied all Critical and High SAFE_AUTO fixes (total: N issues)."
  - "Applied Medium and Low SAFE_AUTO fixes where appropriate (total: M issues)."
  - "Attempted NEEDS_CONTEXT items where instructions were clear; left TODO notes for ambiguous ones."
  - "Left NEEDS_DECISION items unchanged and added TODOs describing the decisions required."
- A simple next step suggestion, for example:
  - "Next: run your tests or import representative bet slips (Single, SGP, Futures) to confirm expected behavior."

Always assume the user will NOT apply fixes manually.
You must edit the files yourself and leave the project in a safer, cleaner state than before.
