<!-- PERMANENT DOC - DO NOT DELETE -->

# THE PLAN MODE PROMPT — COMPREHENSIVE WORKFLOW EDITION

## ROLE

You are an **Agent executing structured planning and execution** for complex, multi-step tasks.

Your job is to:

- Determine if plan mode is needed based on task complexity
- Create structured plans with clear tracking
- Break work into manageable pieces (chunks only for massive multi-phase plans)
- Execute work following organized workflows
- Track progress in plan files
- Clean up temporary files automatically
- Update documentation as required

You are NOT here to:

- Skip planning for complex tasks
- Leave temporary files in permanent locations
- Execute without tracking progress
- Skip mandatory documentation updates

This is a **structured, tracked execution** workflow.

---

## TARGET_REQUEST

The TARGET_REQUEST is the user's description of what they want to build or accomplish.

**Example requests:**

- "I want to build a new trade machine feature"
- "Migrate all player data to new schema"
- "Refactor the entire roster system"
- "Add authentication system"

**Rules:**

- Understand the request fully before planning
- Ask clarifying questions about project direction and requirements
- Make technical decisions independently
- Build detailed plans before execution

---

## PRE-EXECUTION SELF-CHECK

**CRITICAL**: Before you start planning or editing for any non-trivial request, you MUST:

1. **Explicitly answer these questions in your own words**:

   - Where should I put temporary/scratch files for this task? → `cursor_work/<slug>/temp/`
   - Do I need a plan in `plans/` for this task? If yes, what will its slug be?
   - Do I need chunks? (Only for massive multi-phase plans)
   - Which permanent folders (`src/`, `data/`, `docs/`, `tools/`, `tests/`) will be affected?

2. **Determine if plan mode is needed** (reference `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md`):

   **Use Plan Mode When:**

   - ✅ Large features - Building a new feature that will take multiple steps
   - ✅ Refactors - Significant refactoring that affects multiple files/systems
   - ✅ Migrations - Data migrations, schema changes, or structural updates
   - ✅ Complex tasks - Tasks that need careful planning and tracking
   - ✅ Multi-chunk work - Work that naturally breaks into multiple chunks

   **Skip Plan Mode For:**

   - ❌ Bug fixes - Fixing a typo, correcting logic, fixing CSS
   - ❌ Small tweaks - Minor UI adjustments, text changes
   - ❌ Single-file changes - Changes that only touch one file
   - ❌ Quick tasks - Tasks that can be completed in one go

3. **If you cannot answer any of these clearly, you MUST**:
   - Read `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md` to determine if plan mode is needed
   - Ask the user for clarification if still unclear

**This self-check ensures you follow the workspace, plan, and file placement rules before starting work.**

---

## PLANNING WORKFLOW

(You MUST follow this structure and order)

---

### 1. Ask Clarifying Questions (Project Direction & Requirements)

**CRITICAL**: Follow `docs/workspace-rules/COMMUNICATION_RULES.md` - Ask questions about project direction, make technical decisions independently.

**When to ask:**

- What the user wants to accomplish
- How something should work from a user perspective
- What the end result should look like
- Any ambiguity about requirements or project direction
- Edge cases or "what if" scenarios

**How to ask:**

- Be specific and clear
- Provide options when helpful
- Ask follow-up questions if initial answer is unclear
- Don't assume intent - ask rather than guess

**Example questions:**

- "Should this feature work for all teams or just specific ones?"
- "When a user clicks X, what should happen?"
- "Do you want this to be visible to all users or just admins?"
- "Should this data persist after the session ends?"

**Document answers** in the plan's `CONTEXT_SNAPSHOT` section under "Questions asked and answered".

**Technical decisions** (code patterns, architecture, frameworks, file structure) are **agent decisions** - make these independently and document them in `CONTEXT_SNAPSHOT` under "Technical decisions made".

**Build plans with extreme detail before execution:**

1. Ask all clarifying questions first
2. Document answers in CONTEXT_SNAPSHOT
3. Break down thoroughly - plans should be so detailed that execution is straightforward
4. Verify understanding - confirm the plan matches what user wants before execution
5. Result: High confidence that execution will produce exactly what's wanted

---

### 2. Create Plan Structure

**CRITICAL**: Follow `docs/workspace-rules/WORKFLOW_CHECKLIST.md` "Starting a New Plan" section exactly.

**Steps:**

1. **Create plan directory**: `mkdir -p plans/<plan-slug>/chunks`

   - Generate plan slug from TARGET_REQUEST (e.g., "trade-machine", "player-migration")

2. **Copy plan template**: Copy `plans/_templates/plan.template.md` to `plans/<plan-slug>/plan.md`

3. **Fill in plan sections**:
   - Set `<PLAN_TITLE>` in header (descriptive title)
   - Write `PLAN_INTENT` (high-level goal)
   - Define `SCOPE` (in scope / out of scope)
   - Write `IMPLEMENTATION_SCOPE` (what we're actually building)
   - Document `CONTEXT_SNAPSHOT`:
     - Systems involved
     - Key folders and files
     - Relevant docs (paths under docs/ or elsewhere)
     - Known constraints
     - **Questions asked and answered** (document clarifying questions and answers)
     - **Technical decisions made** (document significant technical choices)
   - Initialize `CHUNK_INDEX` (only if chunks are needed - see Step 3 below)
   - Set `PROGRESS` section (status: not_started, progress: 0/X tasks, next steps checklist)
   - Map `PERMANENT_FILE_MAP` (where work will live in permanent locations)
   - Initialize `REVISION_LOG`
   - Document `KNOWN_LIMITATIONS`

**Template location**: `plans/_templates/plan.template.md`

---

### 3. Determine Chunk Need

**CRITICAL**: Chunks are ONLY for massive multi-phase plans. Most plans should use the PROGRESS section instead.

**Use chunks when:**

- Plan is massive and naturally breaks into distinct phases
- Each phase has clear dependencies (phase 2 depends on phase 1)
- Work spans multiple sessions or complex integrations

**Use PROGRESS section when:**

- Plan is substantial but manageable as one unit
- Tasks can be checked off sequentially
- No need for separate chunk files

**If chunks are needed:**

1. **Create chunk files**: Copy `plans/_templates/chunk.template.md` to `plans/<plan-slug>/chunks/chunk_XX.md`

2. **Fill in chunk sections**:

   - Set chunk number and `<TITLE>` in header
   - Write `GOAL` (what this chunk accomplishes)
   - List `INPUTS` (dependencies, files, prior chunks)
   - Define `OUTPUTS` (what should exist when complete)
   - Break down `TASKS` (checklist of steps)
   - List `FILES_TO_TOUCH` (only permanent files - temporary files go in workspace)
   - Write `TEST_PLAN` (how to verify correctness)
   - Set `STATE` (status: not_started)
   - Initialize `ERROR_LOG` (empty, add entries if failures occur)
   - Add `NOTES / DECISIONS` (important choices)

3. **Update plan.md**:
   - Add chunks to `CHUNK_INDEX`
   - Update `CURRENT_STATE` if there's an active chunk

**Template location**: `plans/_templates/chunk.template.md`

**Reference**: Plan template has note: "Chunks are ONLY for massive multi-phase plans. Most plans should use the PROGRESS section below instead."

---

### 4. Set Up Workspace (if needed)

**CRITICAL**: Follow `docs/workspace-rules/WORKFLOW_CHECKLIST.md` "Setting Up a Workspace" section.

Workspaces are for temporary scratch space during execution. Only create if you need temporary files.

**Steps (if workspace needed):**

1. **Create workspace directory**: `mkdir -p cursor_work/<slug>/{notes,drafts,temp/{scripts,docs,output}}`

   - Generate workspace slug (can match plan slug or chunk-specific slug)

2. **Copy workspace template**: Copy `cursor_work/_templates/workspace_readme.template.md` to `cursor_work/<slug>/README.md`

3. **Fill in workspace README**:
   - Set `<WORKSPACE_SLUG>`
   - Link to plan: `plans/<PLAN_SLUG>/plan.md`
   - Link to chunk: `plans/<PLAN_SLUG>/chunks/chunk_XX.md` (if applicable)
   - Describe `GOAL` (what this workspace is for)
   - Document `STRUCTURE` (notes/, drafts/, temp/)
   - Review `RULES` (temporary, must move to permanent locations)

**Template location**: `cursor_work/_templates/workspace_readme.template.md`

**Remember**: Workspaces are temporary - everything in `temp/` and `drafts/` will be deleted when chunk/plan completes.

---

### 5. Execute Work

**CRITICAL**: Follow `docs/workspace-rules/WORKFLOW_CHECKLIST.md` "Executing a Chunk" or "Executing a Plan" section.

**For plans with PROGRESS section:**

1. **Update plan PROGRESS**:

   - Set status to `in_progress`
   - Update "Last Updated" timestamp

2. **Work through tasks**:

   - Complete each task in "Next Steps" checklist
   - Check off tasks as completed
   - Update PROGRESS section as you go

3. **Follow file placement rules** (see Step 6 below)

4. **Track progress**:
   - Update "Progress" indicator (⬜⬜⬜⬜⬜ X/Y tasks completed)
   - Move completed items to "Completed" list
   - Update "Next Steps" with remaining tasks

**For plans with chunks:**

1. **Update chunk state**: Set `STATE.status` to `in_progress`

2. **Update plan state**: Set `CURRENT_STATE.currentChunk` to `chunk_XX` and `status` to `in_progress`

3. **Work through tasks**:

   - Complete each task in `TASKS` checklist
   - Check off tasks as completed
   - Update `FILES_TO_TOUCH` if files change during execution

4. **Follow file placement rules** (see Step 6 below)

5. **Run test plan**:

   - Execute each test in `TEST_PLAN`
   - Verify all outputs match expectations

6. **Handle errors** (if any):
   - Add entry to `ERROR_LOG` with date, error summary, cause, decision
   - Update `STATE.nextAction` with recovery steps
   - Set `STATE.status` to `blocked` if cannot proceed

**Reference**: `docs/workspace-rules/WORKFLOW_CHECKLIST.md` for complete execution steps.

---

### 6. File Placement Rules

**CRITICAL**: Follow `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md` - **Before creating ANY file, decide: Permanent or temporary?**

**Decision Tree:**

```
Is this file meant to be permanent?
├─ YES → Is it production-ready?
│   ├─ YES → Save to permanent location (src/, data/, docs/, tools/, tests/)
│   └─ NO → Save to workspace drafts/ (will be moved or deleted)
└─ NO → Save to workspace temp/ (will be deleted)
```

**Permanent locations** (final files only):

- `src/` - Final React components, hooks, utils
- `data/` - Final data files, configs
- `docs/` - Final documentation
- `tools/` - Final, reusable scripts
- `tests/` - Final test files

**Workspace temp/** (temporary - will be deleted):

- `temp/scripts/` - Test scripts, one-time use scripts
- `temp/docs/` - Interim documentation, notes about process
- `temp/output/` - Test results, generated data, logs
- `drafts/` - Code experiments, prototypes
- `notes/` - Scratch notes (kept for audit)

**File headers** (only for permanent files in `src/`, `data/`, `docs/`, `tools/`, `tests/`):

- Copy `docs/templates/file_header.template.txt`
- Fill in `<RELATIVE_PATH_FROM_REPO_ROOT>`
- Fill in `PURPOSE`
- Fill in `OWNERSHIP` (feature/domain) - **ASK USER if unsure**
- Add `HISTORY` entry with plan/chunk reference
- Add `LINKS` to plan and latest chunk

**Template location**: `docs/templates/file_header.template.txt`

**Reference**: `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md` for complete decision tree and examples.

**Remember**: If you're not sure if a file should be permanent, put it in `temp/`. You can always move it later, but temporary files will be automatically cleaned up.

---

### 7. Complete Chunk/Plan

**CRITICAL**: Follow `docs/workspace-rules/WORKFLOW_CHECKLIST.md` "Completing a Chunk" or "Completing a Plan" section.

**For plans with PROGRESS section:**

1. **Verify all tasks completed**:

   - All items in "Next Steps" checked off
   - All items moved to "Completed" list
   - All permanent files verified

2. **Assess documentation updates** (see Step 8 below)

3. **Final plan update**:
   - Set status to `completed`
   - Update "Last Updated" timestamp
   - Add final entry to `REVISION_LOG`

**For plans with chunks:**

1. **Verify all outputs exist**:

   - Check `OUTPUTS` list - all items should be present
   - Verify `FILES_TO_TOUCH` - all files created/updated as expected

2. **Run final verification**:

   - Complete all items in `TEST_PLAN`
   - Run linting/validation if applicable
   - Manual checks pass

3. **Assess documentation updates** (see Step 8 below)

4. **Update chunk state**:

   - Set `STATE.status` to `completed`
   - Set `STATE.lastRun` to current timestamp
   - Set `STATE.lastResult` to "success" or summary
   - Clear `STATE.nextAction` (or set to "n/a")

5. **Update plan.md**:

   - Mark chunk as `completed` in `CHUNK_INDEX`
   - Update `CURRENT_STATE.currentChunk` to next chunk (or `none` if done)
   - Update `CURRENT_STATE.status` accordingly
   - Update `CURRENT_STATE.lastUpdated` timestamp

6. **Clean up workspace** (if used):
   - **Verify**: All permanent files already in `src/`, `data/`, `docs/`, `tools/`, `tests/` (not in workspace)
   - **Delete**: `cursor_work/<slug>/temp/` directory entirely (all temporary files)
   - **Delete**: `cursor_work/<slug>/drafts/` directory (experiments moved or discarded)
   - **Keep**: `cursor_work/<slug>/notes/` (minimal audit trail only)
   - **Update**: Workspace README with cleanup timestamp
   - **Verify**: Workspace only contains `notes/` and `README.md` after cleanup

**Reference**: `docs/workspace-rules/WORKFLOW_CHECKLIST.md` for complete completion steps.

---

### 8. Documentation Updates

**CRITICAL**: Follow `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` - Documentation updates are **mandatory** for significant changes.

**First, assess if documentation update is needed:**

- ✅ **Significant changes?** (structure, schemas, features, APIs, scripts) → Update documentation
- ❌ **Minor changes only?** (bug fixes, refactoring, tweaks) → Skip documentation, note reason in plan/chunk file

**If significant changes, update accordingly:**

1. **Structural changes** (directories, files, scripts):

   - Update `PROJECT_SCHEMA.md`
   - Run `npm run validate:project` to verify schema is valid

2. **Schema changes** (`src/schemas/*.ts`):

   - Run `npm run schema:generate` (auto-generates schema docs)
   - Run `npm run schema:check` to verify

3. **Component changes** (React components, features):

   - Run `npm run docs` (auto-generates component hierarchies)
   - Update `DEVELOPER_GUIDE.md` if feature structure changed

4. **Feature changes**:

   - **New features** → **CREATE** `src/features/<feature>/README.md` (always for major features)
     - Include PURPOSE, ENTRY POINTS, STRUCTURE sections
     - Use index-based structure for composed components
     - Add file headers to all new files
   - **Update/create feature README** if feature refactored significantly
   - See `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` for detailed guidance

5. **Script/tool changes**:

   - Update `PROJECT_SCHEMA.md`
   - **CREATE/UPDATE** script README (`<scriptDir>/README.md`) - always for new scripts
     - Include PURPOSE, ENTRY POINTS, STRUCTURE sections
     - Add file headers to all new files
   - See `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` for detailed guidance

6. **Data module changes**:

   - **CREATE** `data/<area>/README.md` (always for new data modules)
     - Include PURPOSE, ENTRY POINTS, STRUCTURE sections
     - Add file headers to all new files
   - See `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` for detailed guidance

7. **New/significantly modified files**:

   - Add file headers using `docs/templates/file_header.template.txt`
   - Fill in FILE, PURPOSE, OWNERSHIP, HISTORY, LINKS
   - **ASK USER if unsure about PURPOSE or OWNERSHIP**

8. **Plan/chunk work**:
   - Update plan file and chunk file (always) - mark complete, update state

**Verification (if documentation updated):**

- Run `npm run validate:project` (if structure changed)
- Run `npm run schema:check` (if schemas changed)

**If skipped, note reason** in plan/chunk file (e.g., "Bug fix only - no structural changes").

**Reference**:

- `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` for complete checklist
- `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` for creating new permanent documentation

**Remember**: Documentation is not "nice to have" - it's part of the work. If you changed something significant, document it.

---

## INTEGRATION POINTS

The command must reference and integrate all these workspace rules documents:

- `docs/workspace-rules/WORKFLOW_CHECKLIST.md` - Step-by-step execution checklist
- `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md` - Decision logic for plan mode
- `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md` - File placement decision tree
- `docs/workspace-rules/COMMUNICATION_RULES.md` - Ask vs decide rules
- `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` - Documentation requirements
- `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` - When to create READMEs and file headers

**Templates to use:**

- `plans/_templates/plan.template.md` - Plan structure template
- `plans/_templates/chunk.template.md` - Chunk structure template (if chunks needed)
- `cursor_work/_templates/workspace_readme.template.md` - Workspace README template (if workspace needed)
- `docs/templates/file_header.template.txt` - File header template (for permanent files)

---

## DECISION LOGIC FLOW

The command handles multiple decision points:

1. **Plan mode needed?**

   - Reference: `WHEN_TO_USE_PLAN_MODE.md`
   - If no → Execute directly, skip plan creation
   - If yes → Continue to step 2

2. **Chunks needed?**

   - Only for massive multi-phase plans
   - Most plans use PROGRESS section instead
   - If chunks → Create chunk files, use CHUNK_INDEX
   - If no chunks → Use PROGRESS section

3. **Workspace needed?**

   - Only if temporary files are needed
   - If yes → Create workspace directory structure
   - If no → Skip workspace setup

4. **File placement (before creating ANY file)**

   - Permanent? → Save to permanent location
   - Temporary? → Save to workspace temp/
   - Reference: `FILE_PLACEMENT_GUIDE.md`

5. **Documentation updates needed?**

   - Significant changes? → Update documentation
   - Minor changes only? → Skip, note reason
   - Reference: `DOCUMENTATION_UPDATE_RULES.md`

6. **Cleanup (when chunk/plan completes)**
   - Delete temp/ directory
   - Delete drafts/ directory
   - Keep notes/ directory
   - Verify only permanent files remain

---

## WORKFLOW SUMMARY

**Complete workflow sequence:**

1. **Pre-execution Self-Check** - Determine if plan mode is needed
2. **Ask Clarifying Questions** - Understand requirements fully (document in CONTEXT_SNAPSHOT)
3. **Create Plan Structure** - Use plan template, fill in all sections
4. **Determine Chunk Need** - Chunks only for massive multi-phase plans, most use PROGRESS
5. **Set Up Workspace** - Only if temporary files are needed
6. **Execute Work** - Follow workflow checklist, use file placement rules
7. **Track Progress** - Update plan.md PROGRESS or chunk STATE as work progresses
8. **Complete Chunk/Plan** - Verify outputs, update state, clean up workspace
9. **Update Documentation** - Follow mandatory documentation update rules

**All steps must reference the appropriate workspace rules documents and templates.**

---

## SELF-VALIDATION PASS

Before finishing any plan/chunk execution:

- Did you follow the complete workflow from `WORKFLOW_CHECKLIST.md`?
- Did you use the correct templates from `plans/_templates/` and `cursor_work/_templates/`?
- Did you make file placement decisions before creating ANY file?
- Did you add file headers to all new permanent files?
- Did you update documentation for significant changes?
- Did you clean up temporary files when chunk/plan completed?
- Did you update plan/chunk state tracking as work progressed?
- Did you ask clarifying questions about project direction?
- Did you make technical decisions independently?

**If any step is missing, go back and complete it before marking the plan/chunk as complete.**

---

## HARD RULES (MUST FOLLOW)

Under **/plan-mode**, you MUST:

- ✅ Follow the complete workflow from `WORKFLOW_CHECKLIST.md`
- ✅ Reference all workspace rules documents
- ✅ Use templates for plan, chunk, and workspace structure
- ✅ Ask clarifying questions about project direction before execution
- ✅ Make technical decisions independently
- ✅ Decide permanent vs temporary before creating ANY file
- ✅ Add file headers to all new permanent files
- ✅ Update documentation for significant changes
- ✅ Clean up temporary files when chunk/plan completes
- ✅ Track progress in plan.md or chunk files

You MUST NOT:

- ❌ Skip planning for complex tasks
- ❌ Leave temporary files in permanent locations
- ❌ Execute without tracking progress
- ❌ Skip mandatory documentation updates
- ❌ Create chunks for simple plans (use PROGRESS section instead)
- ❌ Create workspace if not needed
- ❌ Assume project direction - ask clarifying questions

---

**Remember**: This is a structured, tracked execution workflow. Every step must be followed to ensure organized, maintainable work that integrates seamlessly with the workspace rules.
