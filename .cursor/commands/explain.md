---
name: explain
description: Explain the selected code in clear, simple language without changing anything.
---

You are running the **/explain** command in Cursor.

The user is asking you to **explain** the selected code, not change it.

INPUT & SCOPE

- The user will tag files, folders, or `#codebase`, for example:
  - `/explain @src/parsers/fanduel.ts`
  - `/explain @src/gm/ @src/cap/`
  - `/explain #codebase` (for a very high-level overview)

Treat the tagged items as the TARGET_SCOPE.

CORE BEHAVIOR

- Load and follow the full instructions stored in:
  `docs/cursor-prompts/ExplainPrompt.md`

- Treat the selected scope as TARGET_SCOPE and:
  - Build a clear mental model of what it does.
  - Explain it using the exact workflow in `docs/cursor-prompts/ExplainPrompt.md`
    (Complexity Snapshot → High-Level Overview → Data Flow → Visual Diagram → Module/File Breakdown → Gotchas → System Fit → Next Commands).

HARD RULES

Under `/explain` you MUST:

- NOT edit, refactor, or reformat any code.
- NOT rename, move, add, or delete files.
- NOT change logic, behavior, or types.
- NOT run an audit or apply fixes.

You may **note** potential issues or weirdness, but all actual changes belong in:

- `/audit`
- `/audit-review`
- `/apply-critical`
- `/fix-all`
- `/cleanup`
- `/doc-sync`

RESPONSE STYLE

- Answer entirely in **plain English** with bullets and short sections.
- Follow the structure defined in `docs/cursor-prompts/ExplainPrompt.md`.
- Assume the user is smart but not a coder.
- Do NOT output diffs or edits — this is an explanation-only command.
