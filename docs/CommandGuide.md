# Custom Cursor Commands Guide

This document explains each custom Cursor command, what it does, when to use it, and the recommended order of operations.

---

## Commands Overview

### 🔍 Analysis & Discovery Commands

#### `/explain`

**What it does:** Explains selected code in plain, simple language without making any changes. Provides a clear mental model of how the code works, including data flow, key concepts, and how it fits into the larger system.

**When to use:**

- You're trying to understand unfamiliar code
- You need a high-level overview before making changes
- You want to understand the architecture or data flow
- You're onboarding to a new part of the codebase

**Output:** Read-only explanation with complexity scores, visual diagrams, and module breakdowns.

---

#### `/audit`

**What it does:** Performs a deep, technical audit of the selected scope (files, folders, or entire codebase). Identifies correctness issues, architectural problems, security concerns, performance issues, and code quality problems. Produces a comprehensive audit report.

**When to use:**

- Before starting major refactoring work
- When you suspect there are bugs or architectural issues
- After significant changes to verify code quality
- When you want a comprehensive health check of your codebase
- To identify duplicate or overlapping implementations

**Output:** Detailed audit markdown file saved to `audits/` directory, plus output in chat. Includes severity ratings (Critical/High/Medium/Low) and prioritized action plans.

---

#### `/relevance`

**What it does:** Analyzes artifacts (docs, scripts, outputs, logs, etc.) to determine their current relevance. Classifies files as ACTIVE, LEGACY_BUT_IMPORTANT, ARCHIVE_CANDIDATE, PROBABLY_TRASH, or UNKNOWN. Detects semantic duplicates and generates a safe cleanup script.

**When to use:**

- When your repository has accumulated many files and you're unsure what's still needed
- Before major cleanup efforts
- When you suspect there are duplicate or outdated files
- To identify what can be safely archived or removed

**Output:** Classification report grouped by status, plus a bash script (commented for safety) suggesting cleanup actions.

---

### 🔧 Fix & Improvement Commands

#### `/audit-review`

**What it does:** Reviews an existing Apex Audit report and converts it into a structured, execution-ready Fix Plan. Validates issues against current code, adjusts severities if needed, and classifies each issue by fix-safety (SAFE_AUTO, NEEDS_CONTEXT, NEEDS_DECISION).

**When to use:**

- After running `/audit` to create an actionable plan
- When you have an existing audit file that needs to be turned into executable fixes
- To validate whether audit findings are still current

**Input required:** Must tag an existing audit file (e.g., `/audit-review @audits/codebase-audit.md`)

**Output:** A Fix Plan markdown file (e.g., `audits/codebase-audit_fixplan.md`) with ordered fix steps, grouped by severity and fix-safety.

---

#### `/apply-critical`

**What it does:** Applies only the **Critical SAFE_AUTO** fixes from a Fix Plan. This is the most conservative fix command, focusing only on the highest-severity issues that can be safely automated.

**When to use:**

- As a first step after creating a Fix Plan
- When you want to fix only the most critical issues first
- To address urgent correctness or safety problems before broader fixes
- When you want to test the fix process with the safest subset

**Input required:** Must tag a Fix Plan file (e.g., `/apply-critical @audits/codebase-audit_fixplan.md`)

**Output:** Code changes applied directly to files, plus a summary of what was fixed.

---

#### `/fix-all`

**What it does:** Applies all appropriate fixes from a Fix Plan across all severities (Critical, High, Medium, Low). Attempts all SAFE_AUTO fixes, carefully handles NEEDS_CONTEXT items, and leaves NEEDS_DECISION items as TODOs.

**When to use:**

- After reviewing a Fix Plan and deciding to proceed with all fixes
- When you want comprehensive improvements across the codebase
- As a follow-up to `/apply-critical` to handle remaining issues
- When the Fix Plan has been validated and you're ready for broader changes

**Input required:** Must tag a Fix Plan file (e.g., `/fix-all @audits/codebase-audit_fixplan.md`)

**Output:** Code changes applied directly to files, plus a summary of fixes applied and items skipped.

---

#### `/cleanup`

**What it does:** Performs safe, behavior-preserving cleanup: removes dead code, normalizes style, improves readability, and removes unused imports/variables. **Never changes business logic or behavior.**

**When to use:**

- After applying fixes to clean up any mess left behind
- When code has accumulated technical debt but you want to preserve behavior
- To improve code readability without risk
- As a maintenance task to keep code clean
- Before committing changes to ensure clean, consistent code

**Output:** Summary of cleanup changes made, organized by file.

---

#### `/doc-sync`

**What it does:** Updates documentation and comments to accurately match the current code behavior. Ensures README files, inline comments, and docs reflect what the code actually does now, not what it used to do.

**When to use:**

- After making significant code changes
- When documentation is clearly outdated
- After running `/fix-all` or `/apply-critical` to update docs
- When comments describe old architecture or deprecated features
- To ensure canonical implementations are properly documented

**Output:** Updated documentation files and comments, plus a summary of changes.

---

## Recommended Order of Operations

### Standard Workflow: Audit → Fix → Cleanup → Document

1. **`/explain`** (optional) - Understand the code first

   - Use when you need to understand unfamiliar code before making changes

2. **`/audit`** - Identify issues

   - Run on the scope you want to improve
   - Produces: `audits/<scope>-audit.md`

3. **`/audit-review`** - Create Fix Plan

   - Review the audit and create an executable plan
   - Produces: `audits/<scope>-audit_fixplan.md`

4. **`/apply-critical`** (recommended first step) - Fix critical issues

   - Apply only Critical SAFE_AUTO fixes first
   - Test that critical fixes work correctly

5. **`/fix-all`** - Apply remaining fixes

   - Apply all other appropriate fixes from the Fix Plan
   - Handles High, Medium, and Low severity issues

6. **`/cleanup`** - Clean up the code

   - Remove dead code, normalize style, improve readability
   - Ensures code is clean after fixes

7. **`/doc-sync`** - Update documentation
   - Ensure docs and comments match the updated code
   - Document canonical implementations and current architecture

### Alternative Workflows

#### Quick Cleanup (No Audit Needed)

```
/cleanup → /doc-sync
```

Use when you just want to clean up code without a full audit.

#### Understanding First

```
/explain → /audit → /audit-review → /apply-critical → /fix-all → /cleanup → /doc-sync
```

Use when you need to understand code before auditing and fixing.

#### Artifact Cleanup

```
/relevance → (manual cleanup using generated script)
```

Use when you want to clean up repository artifacts, docs, and outputs.

#### Documentation Update Only

```
/doc-sync
```

Use when code is correct but documentation is outdated.

---

## Command Relationships

```
/explain (read-only)
    ↓
/audit (analysis)
    ↓
/audit-review (planning)
    ↓
/apply-critical (safest fixes) → /fix-all (comprehensive fixes)
    ↓
/cleanup (hygiene)
    ↓
/doc-sync (documentation)
```

**Standalone commands:**

- `/relevance` - Can be used independently for artifact analysis
- `/explain` - Can be used independently for understanding
- `/cleanup` - Can be used independently for code hygiene
- `/doc-sync` - Can be used independently for documentation updates

---

## Key Concepts

### Fix-Safety Flags (from Fix Plans)

- **SAFE_AUTO**: Can be safely fixed automatically (e.g., wrong column mapping, missing null-check)
- **NEEDS_CONTEXT**: Can probably be auto-fixed but requires careful consideration (e.g., data shape changes)
- **NEEDS_DECISION**: Requires human product/architecture decision (e.g., how to handle edge cases)

### Severity Levels (from Audits)

- **Critical**: Broken logic, security issues, correctness hazards
- **High**: Architecture fixes, major maintainability issues
- **Medium**: Moderate improvements, simplification opportunities
- **Low**: Style, naming, minor refactors

---

## Best Practices

1. **Always start with `/audit`** when you're unsure about code quality
2. **Use `/apply-critical` first** to test the fix process with the safest changes
3. **Run `/cleanup` after fixes** to ensure code remains clean
4. **Finish with `/doc-sync`** to keep documentation current
5. **Use `/explain` liberally** to understand code before making changes
6. **Run `/relevance` periodically** to keep repository artifacts organized

---

## Notes

- All commands that modify code (`/apply-critical`, `/fix-all`, `/cleanup`, `/doc-sync`) make changes directly to files
- Commands that require input files (`/audit-review`, `/apply-critical`, `/fix-all`) will prompt you if you forget to tag the required file
- All commands provide plain-language summaries suitable for non-coders
- Fix Plans are the bridge between analysis (`/audit`) and execution (`/apply-critical`, `/fix-all`)
