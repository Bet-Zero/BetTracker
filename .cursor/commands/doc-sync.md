---
name: doc-sync
description: Update docs and comments so they accurately match the current code behavior.
---

You are running the **/doc-sync** command in Cursor.

The user is NOT asking you to change core behavior or add new features.  
They are asking you to make sure that documentation and comments are honest and up to date with what the code actually does **right now**.

---

## INPUT REQUIREMENTS

The user may tag files or folders, for example:

- `/doc-sync @parsing/ @docs/`
- `/doc-sync @src/parsers/fanduel.ts @docs/`

Or refer to the whole repo with:

- `/doc-sync #codebase`

Treat the tagged items as the **primary scope**.

If `#codebase` is present, treat the whole repo as in-scope, but prioritize:

- Recently changed areas (for example, touched by `/fix-all` or recent commits)
- Core modules and main pipeline code
- `README.md` and `docs/*.md`

You MAY also read:

- Relevant audit files (for example, `audits/*-audit.md`)
- Relevant Fix Plan files (for example, `audits/*-audit_fixplan.md`)

…but only to understand the intended architecture and canonical choices.  
**Do not** re-run audits or change their contents beyond small wording fixes.

---

## CORE BEHAVIOR

- Load and follow the full instructions stored in:  
  `docs/DocSyncPrompt.md`

Within the chosen scope:

1. **Review code comments**

   - Inline comments
   - Top-of-file descriptions
   - Function or module doc-style comments (JSDoc, block comments, etc.)

2. **Review documentation files**

   - `README.md`
   - `docs/*.md`
   - Any other markdown that explains how systems, parsers, pipelines, or commands work

3. **Compare words vs reality**

   - Compare what comments/docs claim…
   - …against what the **current code** actually does.

4. **Fix mismatches**
   - Update wording so it accurately describes the **current** behavior and APIs.
   - Clarify important flows (for example: `HTML → Bet → FinalRow` or `HTML → Bet` if that’s the new architecture).
   - Align field definitions (for example: `Name`, `Type`, `Category`, `Line`, `Status`) with how they are actually used in the code and data models.
   - Remove or rewrite comments that are outdated, misleading, or refer to deprecated versions (for example: old parser versions that are no longer canonical).

You MUST NOT under `/doc-sync`:

- Change core logic or behavior.
- Perform large refactors or rewrites of code.
- Add new features or new systems.
- Change public APIs, schemas, or Firestore paths.

Your job is **only** to make the words match the working code and agreed architecture.

---

## CANONICAL IMPLEMENTATIONS & DUPLICATES

When `/audit` + `/audit-review` + `/fix-all` have:

- Chosen a **canonical implementation** (for example, `betParser.ts`), and/or
- Archived or removed duplicate/overlapping implementations,

Then under `/doc-sync` you should:

- Update docs to clearly identify the **canonical module** or approach.
- Remove or update references to obsolete files (for example: `parser_v1`, `parser_v2`, `newParser`) so they are no longer presented as active or recommended.
- Clarify the current architecture, for example:
  - Which parser is “the real one”
  - Which components/hooks are the official ones to use
  - Which modules are legacy or deprecated (if they still exist for now)

Do NOT reintroduce or “revive” deprecated variants in docs.  
Docs should reflect the **current, canonical** design.

---

## SPECIAL CARE FOR APEX / SYSTEM DOCS

For these files (examples):

- `docs/ApexAuditPrompt.md`
- `docs/AuditReviewPrompt.md`
- `docs/FixAllPrompt.md`
- `docs/DocSyncPrompt.md`
- `docs/CleanupPrompt.md` (and similar command prompt docs)

You MAY:

- Fix clearly outdated wording.
- Update names, paths, and field descriptions so they match the current code, commands, and workflows.
- Clarify how commands interact (for example: `/audit` → `/audit-review` → `/fix-all` → `/doc-sync`).

You MUST NOT:

- Rewrite their overall structure.
- Change their high-level role or command contracts.
- Remove entire sections or invert the intended workflow.

Treat these docs as the **command contracts** for your AI system.  
Adjust wording and details, not the core design.

---

## SAFETY RULES

Under `/doc-sync`, you MUST:

- Leave behavior unchanged.
- Avoid editing core logic except trivial comment-only changes that require touching code lines.
- Keep all changes scoped to:
  - Comments
  - Documentation
  - Very small metadata updates that do not affect runtime behavior

If you suspect a mismatch is due to a bug (code is wrong, docs are right):

- Do NOT “fix” the code under `/doc-sync`.
- Instead,:
  - Update docs to reflect the code **and** add a note/TODO if appropriate, or
  - Call out in your chat summary that this should be addressed via `/audit` + `/fix-all`.

---

## CHAT RESPONSE STYLE

After running `/doc-sync`:

- Keep your response short and human.
- Do NOT paste entire files or large diffs.

Respond with something like:

- `Ran /doc-sync on: parsing/, docs/`
- A few bullets summarizing changes, for example:
  - `Updated README.md to reflect the current HTML → Bet pipeline and removed references to the old FinalRow-based parser.`
  - `Clarified that Type represents stat codes (Pts, Ast, 3pt, etc.) and aligned comments in parsing/fanduel.ts.`
  - `Updated docs to mark betParser.ts as the canonical parser and removed references to parser_v1/parser_v2 as active implementations.`
- Optionally:
  - `Next: skim README.md and docs/ to see the updated explanations.`

Always assume the user will NOT update docs manually.  
Your job under `/doc-sync` is to keep documentation and comments in **honest, up-to-date sync** with the real, running code and canonical architecture.
