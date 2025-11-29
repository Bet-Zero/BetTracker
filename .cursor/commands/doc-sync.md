---
name: doc-sync
description: Update docs and comments so they accurately match the current code behavior.
---

You are running the **/doc-sync** command in Cursor.

The user is NOT asking you to change core behavior or add new features.  
They are asking you to make sure that documentation and comments are honest and up to date with what the code actually does **right now**.

## INPUT

The user may tag files or folders, for example:

- `/doc-sync @parsing/ @docs/`
- `/doc-sync @src/parsers/fanduel.ts @docs/`

Or refer to the whole repo with:

- `/doc-sync #codebase`

Treat the tagged items as the **primary scope**.

## CORE BEHAVIOR

Load and follow the full instructions stored in:
`docs/cursor-prompts/DocSyncPrompt.md`

Within the chosen scope, compare what comments/docs claim against what the **current code** actually does, and fix mismatches.

## HARD RULES

Under `/doc-sync` you MUST:

- Follow the complete workflow outlined in `docs/cursor-prompts/DocSyncPrompt.md`
- Update docs and comments to match current code behavior
- Update references to canonical implementations (after `/audit-review` + `/fix-all` have chosen them)
- Leave behavior unchanged - this is a **description** pass, not a **design** pass
- Keep all changes scoped to comments and documentation only
- Keep chat response short and human - do NOT paste entire files or large diffs

You MUST NOT:

- Change core logic or behavior
- Perform large refactors or rewrites
- Add new features or systems
- Change public APIs, schemas, or Firestore paths

Perform the complete doc-sync workflow exactly as described in `docs/cursor-prompts/DocSyncPrompt.md`.
