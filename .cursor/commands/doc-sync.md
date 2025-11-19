---
name: doc-sync
description: Update docs and comments so they accurately match the current code behavior.
---

You are running the /doc-sync command in Cursor.

The user is NOT asking you to change core behavior or add new features.
They are asking you to make sure that documentation and comments are honest and up to date with what the code actually does.

INPUT REQUIREMENTS

- The user may tag files or folders, for example:
  - /doc-sync @parsing/ @docs/
  - /doc-sync @src/parsers/fanduel.ts @docs/
- Or refer to the whole repo with:
  - /doc-sync #codebase

Treat the tagged items as the primary scope.
If #codebase is present, treat the whole repo as in-scope, but prioritize:

- Recently changed areas.
- Core modules and main pipeline code.
- README.md and docs/\*.md.

CORE BEHAVIOR

- Load and follow the full instructions stored in:
  docs/DocSyncPrompt.md

- Within the chosen scope:

  - Review code files, focusing on:
    - Inline comments
    - Top-of-file descriptions
    - Function or module doc-style comments
  - Review documentation files, especially:
    - README.md
    - docs/\*.md
    - Any other markdown that explains how things work

- Look for mismatches between:

  - What the code currently does, and
  - What the docs and comments claim.

- For each mismatch:

  - Update the wording so it accurately describes the current behavior.
  - Clarify important flows (for example, HTML → Bet → FinalRow).
  - Align field definitions (for example, Name, Type, Category, Line, Status) with how they are actually used in the code.
  - Remove or rewrite comments that are outdated or misleading.

- You MUST NOT:
  - Change core logic or behavior under /doc-sync.
  - Perform large refactors.
  - Add new features.

SPECIAL CARE FOR APEX DOCS

- For these files:

  - docs/ApexAuditPrompt.md
  - docs/AuditReviewPrompt.md
  - docs/ApplyCriticalPrompt.md
  - docs/FixAllPrompt.md

- You MAY:

  - Fix clearly outdated wording.
  - Update names, paths, and field descriptions so they match the current code and commands.

- You MUST NOT:
  - Rewrite their overall structure.
  - Change their high-level role or command contracts.
  - Remove entire sections.

CHAT RESPONSE STYLE

After running /doc-sync:

- Keep your response short and human.
- Do NOT paste entire files or large diffs.

Respond with something like:

- "Ran /doc-sync on: <scope summary>"
- A few bullets summarizing changes, for example:
  - "Updated README.md to reflect the HTML → Bet → FinalRow pipeline."
  - "Corrected docs so Type is always the stat code (Pts, Ast, 3pt, etc.)."
  - "Cleaned up comments in parsing/fanduel.ts to match the current mapping logic."
- Optionally:
  - "Next: skim README.md and docs/ to see the updated explanations."

Always assume the user will NOT update docs manually.
Your job is to keep the words in sync with the working code.
