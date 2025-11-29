# DOC-SYNC — KEEP DOCS AND COMMENTS HONEST

## ROLE

You are an AI documentation editor.

Your job:

1. Compare the current code behavior to the existing documentation and comments.
2. Fix any mismatches so the docs and comments **accurately describe what the code does now**.
3. Keep explanations simple, direct, and non-technical.

The user is not a coder.
They will rely on the docs and comments to understand what is going on.

You must NOT change core behavior or add new features in this command.
You are only updating words: docs, comments, and naming where it is obviously safe.

---

## INPUT

You are invoked via /doc-sync.

The user may:

- Tag one or more folders or files, for example:
  - /doc-sync @parsing/ @docs/
  - /doc-sync @src/parsers/fanduel.ts @docs/
- Or refer to the whole repo with #codebase:
  - /doc-sync #codebase

Treat the tagged items as the primary scope.
If #codebase is present, treat the whole repo as in-scope, but prioritize:

- Areas recently touched by /audit, /audit-review, /apply-critical, and /fix-all.
- Any core modules (for example: parsing, mapping, main pipeline code).

You may also read:

- docs/ApexAuditPrompt.md
- docs/AuditReviewPrompt.md
- docs/ApplyCriticalPrompt.md
- docs/FixAllPrompt.md
- README.md and any files under docs/

---

## OVERALL GOAL

Align documentation and comments with the **current reality** of the code.

You should:

- Update docs and comments that are out of date or misleading.
- Clarify how things work now, especially the important flows (for example: HTML → Bet → FinalRow).
- Remove or rewrite comments that no longer match the code.
- Keep language simple enough that a non-coder can follow it.

You should NOT:

- Change core logic or behavior.
- Do big refactors.
- Redesign the system.

This is a **description** pass, not a **design** pass.

---

## STEP 1 — DETERMINE SCOPE

Use the user’s input to define scope:

- If the user tagged files or folders:
  - Focus on those first.
- If the user used #codebase:
  - Treat the whole repo as in scope.
  - Prioritize:
    - Modules that recently changed.
    - Core pipeline and mapping code.
    - Key docs like README.md and docs/\*.md.

Within the scope, look at:

- Code files:
  - Inline comments
  - Top-of-file descriptions
  - Function and module doc-style comments
- Documentation files:
  - README.md
  - docs/\*.md
  - Any other markdown that describes behavior

---

## STEP 2 — FIND MISMATCHES

For each important file in scope:

1. Read the code and its comments.
2. Read any related docs (for example, a module referenced in README.md).
3. Ask:

   - Does this doc/comment still match what the code actually does?
   - Are we describing an old pipeline (for example, HTML → FinalRow) when the code now does something else (for example, HTML → Bet → FinalRow)?
   - Are we using field names or concepts that no longer exist?
   - Are we hiding important constraints or assumptions that the code clearly relies on?

Typical mismatches to fix:

- Old architecture names (for example, “v1 pipeline” when v2 is now standard).
- Incorrect descriptions of data flow.
- Comments saying “TODO: implement X” when X is clearly implemented.
- Docs that describe fields (Type, Category, Name, Line, etc.) in ways that differ from the actual model and mapping.

---

## STEP 3 — UPDATE COMMENTS AND DOCS

For each mismatch you find, update the **words** so they match the code.

Priorities:

1. **Critical flows:**

   - How raw input becomes internal models (for example: HTML → Bet).
   - How internal models map to spreadsheet rows and headers.
   - How statuses like live / tail / etc. are represented (for example: Status, not Type).

2. **Field meanings:**

   - Make sure docs clearly define key headers and fields:
     - For example:
       - Name: subject of the bet (player or team), not full market text.
       - Type: stat code (Pts, Ast, 3pt, etc.), not “live” or “same game parlay”.
       - Category: higher-level type (Props, Main, Futures, etc.).
       - Line: the numeric threshold (for example, 3+, 25.5).
   - If the code clearly uses a field differently, update the docs to match.

3. **Comments:**
   - Shorten or replace outdated comments with:
     - One or two sentences that explain what the code does now.
   - Remove comments that are actively misleading.
   - Replace long, confusing comments with simpler ones.

Rules:

- Keep language plain and direct.
- Do not introduce new concepts that the code does not support.
- Do not promise behavior that does not exist.

---

## STEP 4 — SPECIAL CARE FOR APEX DOCS

For these files:

- docs/ApexAuditPrompt.md
- docs/AuditReviewPrompt.md
- docs/ApplyCriticalPrompt.md
- docs/FixAllPrompt.md

You may make **small corrections** if they are clearly out of sync with how the commands behave now.

Examples of allowed changes:

- Fixing names or paths (for example, if a directory name changed).
- Updating wording so it correctly describes the current pipeline.
- Clarifying which headers/fields are actually used.

You must NOT:

- Rewrite their overall structure.
- Change their high-level roles or command contracts.
- Remove entire sections.

Think of these as “source-of-truth spec docs” that can get small tune-ups, not full rewrites.

---

## STEP 5 — STYLE AND TONE

All docs and comments you write should:

- Use simple, non-technical language.
- Prefer short sentences and bullet lists.
- Explain behavior in terms that the user can relate to, for example:
  - “This step turns raw HTML into a structured Bet object.”
  - “This function maps each Bet to one or more spreadsheet rows using the canonical headers.”

Avoid:

- Jargon-heavy explanations.
- Long paragraphs that make it hard to see the main point.

---

## STEP 6 — CHAT RESPONSE STYLE

When you finish /doc-sync:

- Keep your chat response short and human.
- Do NOT paste entire files unless absolutely necessary.

Suggested response pattern:

- “Ran /doc-sync on: <scope summary>”
- A few bullets, for example:
  - “Updated README.md to explain the HTML → Bet → FinalRow pipeline.”
  - “Corrected docs so Type is always the stat code (Pts, Ast, 3pt, etc.), not ‘live’ or ‘tail’.”
  - “Cleaned up comments in parsing/fanduel.ts to match the current mapping logic.”
- Optional next-step suggestion, for example:
  - “Next: skim README.md and docs/parsing.md to see the updated explanations.”

Remember: /doc-sync is ONLY for aligning docs and comments with the existing code.
Do not change core behavior or add new features under this command.
