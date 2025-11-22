---
name: apply-critical
description: Apply Critical SAFE_AUTO fixes from a Fix Plan produced by /audit-review.
---

You are running the **/apply-critical** command in Cursor.

The user is NOT asking for a new audit.  
They are asking you to execute the **Critical SAFE_AUTO** fixes defined in a Fix Plan markdown file.

---

## INPUT REQUIREMENTS

The user MUST tag exactly one existing Fix Plan markdown file when calling this command, for example:

- `/apply-critical @audits/codebase-audit_fixplan.md`
- `/apply-critical @audits/parsing-module-audit_fixplan.md`

Rules:

- The tagged Fix Plan is the ONLY plan input you should use.
- Do NOT guess or pick a different file.
- You MAY also read `#codebase` and any referenced files in order to perform the edits.

If the user does NOT tag a Fix Plan file:

- Do NOT run anything.
- Reply in chat with:

> I need you to tag the specific Fix Plan markdown file, for example:  
> `/apply-critical @audits/codebase-audit_fixplan.md`

---

## CORE BEHAVIOR

- Load and follow the full instructions stored in:  
  `docs/ApplyCriticalPrompt.md`

- Treat the tagged Fix Plan as the **execution plan** produced by `/audit-review`.  
  Do NOT:
  - Re-run an audit
  - Invent new issues
  - Change severities or fix-safety flags

From the Fix Plan:

- Parse all issues.
- Select only those that meet **ALL** of the following:

  - Severity: `Critical`
  - Fix-safety flag: `SAFE_AUTO`
  - Review status: **not** `REJECTED` (must be `CONFIRMED` or `ADJUSTED`)

- If no such issues exist:
  - Do not change any code.
  - Explain this clearly in chat.

---

## APPLYING CRITICAL SAFE_AUTO FIXES

For each selected Critical SAFE_AUTO issue:

1. Open the referenced file or files.
2. Re-read:
   - “What’s wrong (confirmed)”
   - “How to fix (clarified)”
3. Apply the **smallest, safest set of code changes** that fully implement the described fix.
4. Follow existing patterns and style in that file.
5. Avoid large refactors, architecture changes, or unrelated cleanups.

For Critical SAFE_AUTO issues that involve **canonicalization / duplicates** (for example, picking a canonical parser or component):

- Follow the Fix Plan’s explicit instructions about which implementation is **canonical**.
- Update imports/callers to use the canonical implementation.
- Only delete or archive old variants **after** verifying there are no remaining references across `#codebase`.
- If any uncertainty remains:
  - Prefer to leave old variants in place.
  - Add a short TODO referencing the Fix Plan issue ID instead of deleting.

If a supposedly SAFE_AUTO fix turns out to be ambiguous, risky, or seems to require a product/architecture decision:

- Prefer to **skip** it.
- Optionally add a short TODO comment in the code explaining:
  - Which Fix Plan issue was skipped
  - Why it was not safe to apply automatically

You MAY optionally annotate the Fix Plan file (for example, adding an “APPLIED” note), but this is optional.  
The main source of truth is the updated codebase.

---

## CHAT RESPONSE STYLE

After running `/apply-critical`:

- Keep your response short and human.
- Do NOT paste large diffs or entire files.

Respond with something like:

- `Applied Critical SAFE_AUTO fixes from: audits/codebase-audit_fixplan.md`
- A few bullets summarizing the changes, for example:
  - `Fixed 2 Critical mapping bugs in parsing/fanduel.ts (Type vs Line confusion).`
  - `Fixed 1 Critical crash in parsing/utils.ts when odds were missing.`
  - `Skipped 1 Critical issue that requires a product decision about partially settled SGPs; left a TODO with details.`
- A simple next step suggestion, for example:
  - `Next: import a few sample bet slips (Single + SGP) and confirm that Name / Type / Line columns populate correctly.`

Always assume the user will NOT apply fixes manually.  
You must edit the files yourself and leave the project in a **safer, more correct** state than before.
