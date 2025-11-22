---
name: fix-all
description: Apply all appropriate fixes from a Fix Plan produced by /audit-review.
---

You are running the **/fix-all** command in Cursor.

The user is NOT asking for a new audit.  
They are asking you to execute the Fix Plan produced by `/audit-review` and safely apply code changes.

---

## INPUT REQUIREMENTS

The user MUST tag exactly one existing Fix Plan markdown file when calling this command, for example:

- `/fix-all @audits/codebase-audit_fixplan.md`
- `/fix-all @audits/parsing-module-audit_fixplan.md`

Rules:

- The tagged Fix Plan is the ONLY plan input you should use.
- Do NOT guess or pick a different file.
- You MAY also read `#codebase` and any referenced files in order to perform the edits.

If the user does NOT tag a Fix Plan file:

- Do NOT run anything.
- Reply in chat with:

> I need you to tag the specific Fix Plan markdown file, for example:  
> `/fix-all @audits/codebase-audit_fixplan.md`

---

## CORE BEHAVIOR

- Load and follow the full instructions stored in:  
  `docs/FixAllPrompt.md`

- Treat the tagged Fix Plan as the **execution plan** produced by `/audit-review`.  
  Do NOT:
  - Re-run an audit
  - Invent new issues
  - Change severities or flags

From the Fix Plan, for each issue:

- Parse its properties:
  - Severity: `Critical` / `High` / `Medium` / `Low`
  - Fix-safety flag: `SAFE_AUTO` / `NEEDS_CONTEXT` / `NEEDS_DECISION`
  - Review status: `CONFIRMED` / `ADJUSTED` / `REJECTED`
  - Files involved
  - “What’s wrong (confirmed)”
  - “How to fix (clarified)”
  - “Impact”

---

## WHAT TO APPLY (DECISION RULES)

### 1. SAFE_AUTO — Primary targets

**Always attempt to apply** issues where:

- Fix-safety flag: `SAFE_AUTO`
- Review status: not `REJECTED`
- Severity: `Critical`, `High`, `Medium`, or `Low`

For these issues:

- Apply the fix exactly as described in “How to fix (clarified)”
- Make the **smallest, clearest change** that fully implements the fix
- Preserve existing patterns and style in each file

This includes:

- Logic corrections
- Clear refactors already validated in the Fix Plan
- Canonicalization of duplicate/overlapping implementations when explicitly described
- Cleanup and architecture changes that are marked SAFE_AUTO

For canonicalization / duplicates:

- Follow the Fix Plan’s instructions about which implementation is canonical.
- Update imports/callers to use the canonical implementation.
- Only delete or archive old variants **after** verifying there are no remaining references across `#codebase`.
- If any doubt remains, keep the old file and add a TODO instead of deleting it.

---

### 2. NEEDS_CONTEXT — Apply cautiously

For issues where:

- Fix-safety flag: `NEEDS_CONTEXT`
- Review status: not `REJECTED`

You MUST:

- Carefully inspect the referenced code and surrounding context.
- Apply the change **only if**:
  - The instructions are clear,
  - The scope of the change is limited,
  - And you can confidently preserve behavior and intent.

If the change feels large, ambiguous, or risky:

- Prefer a smaller, obviously safe improvement, **or**
- Skip the change and add a short, precise TODO comment referencing the Fix Plan issue ID.

---

### 3. NEEDS_DECISION or REJECTED — Do not change behavior

For issues where:

- Fix-safety flag: `NEEDS_DECISION`, **or**
- Review status: `REJECTED`

Rules:

- Do NOT change behavior.
- Do NOT refactor or delete code for these issues.
- You MAY add a concise TODO comment indicating:
  - The Fix Plan issue ID
  - The decision required (for example: choosing a canonical implementation, picking between two designs, product-level behavior choice)
- Leave the implementation functionally as-is until a human decision is made.

---

## HOW TO APPLY EACH ISSUE

For each issue you decide to apply:

1. Open the referenced file(s).
2. Re-read:
   - “What’s wrong (confirmed)”
   - “How to fix (clarified)”
3. Apply the minimal set of edits that correctly implement the fix.
4. Keep the style consistent with the existing file (naming, patterns, formatting).
5. If multiple issues touch the same area:
   - Merge changes into a single, coherent refactor rather than applying them in a conflicting way.
6. If a requested change turns out to be ambiguous or unsafe:
   - Prefer to skip it.
   - Add a short TODO in the code referencing the Fix Plan issue ID and why it was skipped.

You MAY optionally annotate the Fix Plan file (for example, marking items as `APPLIED` or `SKIPPED`), but this is secondary.  
The main source of truth is the updated codebase.

---

## SAFETY RULES

While applying fixes, you MUST NOT:

- Introduce new libraries or frameworks
- Change database schemas or Firestore paths
- Rename public APIs outside what’s explicitly described in the Fix Plan
- Invent new features beyond what the Fix Plan specifies
- Aggressively delete files or modules that appear unused unless:
  - The Fix Plan explicitly calls for it, AND
  - You have verified (via `#codebase`) that there are no remaining references

When in doubt, leave the behavior as-is and add a TODO.

---

## CHAT RESPONSE STYLE

After running `/fix-all`:

- Keep your response short and human.
- Do NOT paste large diffs or entire files.

Respond with something like:

- `Applied fixes from: audits/codebase-audit_fixplan.md`
- A few bullets summarizing the work, for example:
  - `Applied all Critical and High SAFE_AUTO fixes (total: N issues).`
  - `Applied Medium and Low SAFE_AUTO fixes where appropriate (total: M issues).`
  - `Attempted NEEDS_CONTEXT items where instructions were clear; left TODO notes for ambiguous ones.`
  - `Left NEEDS_DECISION items unchanged and added TODOs describing the decisions required.`
- A next-step suggestion, for example:
  - `Next: run your tests or re-import representative bet slips (Single, SGP, Futures) to confirm expected behavior.`

Always assume the user will NOT apply fixes manually.  
You must edit the files yourself and leave the project in a **safer, cleaner, more correct** state than before, strictly following the Fix Plan.
