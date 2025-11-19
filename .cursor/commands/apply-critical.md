---
name: apply-critical
description: Apply Critical SAFE_AUTO fixes from a Fix Plan produced by /audit-review.
---

You are running the /apply-critical command in Cursor.

The user is NOT asking for a new audit.
They are asking you to execute the Critical SAFE_AUTO fixes defined in a Fix Plan markdown file.

INPUT REQUIREMENTS

- The user MUST tag exactly one existing Fix Plan markdown file when calling this command, for example:

  - /apply-critical @audits/codebase-audit_fixplan.md
  - /apply-critical @audits/parsing-module-audit_fixplan.md

- That tagged Fix Plan is the ONLY plan input you should use.
- Do NOT guess or pick a different file.
- You may also read #codebase and any referenced files to perform the edits.

If the user does NOT tag a Fix Plan file:

- Do NOT run anything.
- Reply in chat with:
  "I need you to tag the specific Fix Plan markdown file, for example:
  /apply-critical @audits/codebase-audit_fixplan.md"

CORE BEHAVIOR

- Load and follow the full instructions stored in:
  docs/ApplyCriticalPrompt.md

- Treat the tagged Fix Plan as the execution plan produced by /audit-review.
  Do NOT re-run an audit or invent new issues.

- From the Fix Plan:

  - Parse all issues.
  - Select only those that meet ALL of the following:
    - Severity: Critical
    - Fix-safety flag: SAFE_AUTO
    - Review status: not REJECTED (must be CONFIRMED or ADJUSTED)
  - If no such issues exist:
    - Do not change any code.
    - Explain this clearly in chat.

- For each selected Critical SAFE_AUTO issue:

  - Open the referenced file or files.
  - Re-read “What’s wrong (confirmed)” and “How to fix (clarified)”.
  - Apply the smallest, safest code changes that fully implement the described fix.
  - Do NOT perform large refactors or redesigns here.
  - If a fix turns out to be ambiguous or requires a product decision:
    - Prefer to skip it.
    - Optionally add a short TODO comment in the code explaining why it was skipped.

- You MAY optionally annotate the Fix Plan file to indicate which items were applied (for example, by adding a simple “APPLIED” note), but this is optional.
  The main source of truth is the code itself.

CHAT RESPONSE STYLE

After running /apply-critical:

- Keep your response short and human.
- Do NOT paste large diffs or entire files.

Respond with something like:

- "Applied Critical SAFE_AUTO fixes from: <fixplan path>"
- A few bullets summarizing the changes, for example:
  - "Fixed 2 Critical mapping bugs in parsing/fanduel.ts (Type vs Line confusion)."
  - "Fixed 1 Critical crash in parsing/utils.ts when odds were missing."
  - "Skipped 1 Critical issue that requires a product decision about partially settled SGPs."
- A simple next step suggestion, for example:
  - "Next: import a few sample bet slips (Single + SGP) and confirm that Name / Type / Line columns populate correctly."

Always assume the user will NOT apply fixes manually.
You must edit the files yourself and leave the project in a safer state than you found it.
