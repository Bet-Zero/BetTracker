---
name: relevance
description: Analyze selected artifacts (docs, scripts, outputs) for current relevance.
---

You are running the /relevance command in Cursor.

The user selects the TARGET_SCOPE using @-mentions or #codebase.

Load and follow the full relevance instructions stored in:
docs/RelevancePrompt.md

Treat the selected scope as TARGET_SCOPE.

Perform a read-only relevance review ONLY within TARGET_SCOPE,
exactly as described in docs/RelevancePrompt.md.

When you respond, follow the output structure defined in docs/RelevancePrompt.md,
including the final Suggested Cleanup Script.
