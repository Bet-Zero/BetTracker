---
name: plan-mode
description: Create and execute a structured plan for complex, multi-step tasks using the workspace planning workflow.
---

You are running the **/plan-mode** command in Cursor.

The user wants to build something complex that requires planning, tracking, and organized execution.

## INPUT

The user will describe what they want to build, for example:

- "I want to build a new trade machine feature"
- "Migrate all player data to new schema"
- "Refactor the entire roster system"
- "Add authentication system"

Treat the user's description as the **TARGET_REQUEST**.

## CORE BEHAVIOR

Load and follow the full planning instructions stored in:
`docs/cursor-prompts/PlanModePrompt.md`

Treat the user's request as TARGET_REQUEST and:

- Determine if plan mode is needed based on complexity
- Create plan structure using templates
- Break work into chunks if needed (only for massive multi-phase plans)
- Set up workspace if needed
- Execute work following the workflow checklist
- Track progress in plan files
- Clean up temporary files when complete
- Update documentation as required

## HARD RULES

Under `/plan-mode` you MUST:

- Follow the complete workflow outlined in `docs/cursor-prompts/PlanModePrompt.md`
- Reference and integrate all workspace rules documents:
  - `docs/workspace-rules/WORKFLOW_CHECKLIST.md` - Step-by-step execution
  - `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md` - Decision logic
  - `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md` - File placement rules
  - `docs/workspace-rules/COMMUNICATION_RULES.md` - Ask vs decide rules
  - `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` - Documentation requirements
  - `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` - When to create docs
- Use templates from:
  - `plans/_templates/plan.template.md` - Plan structure
  - `plans/_templates/chunk.template.md` - Chunk structure (if chunks needed)
  - `cursor_work/_templates/workspace_readme.template.md` - Workspace README (if workspace needed)
  - `docs/templates/file_header.template.txt` - File headers for permanent files
- Ask clarifying questions about project direction before starting execution
- Make technical decisions independently
- Track progress in plan.md PROGRESS section or chunk STATE
- Clean up temporary files when chunk/plan completes
- Update documentation following mandatory update rules

## WORKFLOW

1. **Pre-execution Self-Check** - Determine if plan mode is needed
2. **Ask Clarifying Questions** - Understand requirements fully before planning
3. **Create Plan Structure** - Use template to create plan.md
4. **Determine Chunk Need** - Only create chunks for massive multi-phase plans
5. **Set Up Workspace** - Create workspace directory if needed
6. **Execute Work** - Follow workflow checklist with file placement rules
7. **Track Progress** - Update plan.md or chunk files as work progresses
8. **Clean Up** - Remove temporary files when complete
9. **Update Documentation** - Follow documentation update rules

Perform the complete planning workflow exactly as described in `docs/cursor-prompts/PlanModePrompt.md`.
