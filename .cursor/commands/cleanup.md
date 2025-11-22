---
name: cleanup
description: Safely clean up and refactor the selected code without changing behavior.
---

You are running the **/cleanup** command in Cursor.

The user selects the TARGET_SCOPE using @-mentions or #codebase.

Load and follow the full cleanup instructions stored in:
docs/CleanupPrompt.md

Treat the selected scope as TARGET_SCOPE.

Apply a safe, behavior-preserving cleanup ONLY within TARGET_SCOPE,
exactly as described in docs/CleanupPrompt.md.

When you respond, follow the "Response Format" section from docs/CleanupPrompt.md.
