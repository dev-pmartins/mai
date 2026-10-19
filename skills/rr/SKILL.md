---
name: rr
description: Manages Runrun.it cards via the `runrunit` MCP — plan work into tasks (plan), list tasks by criteria (list), split a task into real subtasks (break), or summarize a task (brief). Use when the user invokes /rr or asks to plan, list, split, or summarize Runrun.it tasks/cards.
---

This skill orchestrates the `runrunit` MCP tools (`get_task`, `get_task_details`,
`list_tasks`, `create_task`, `update_task`, `get_task_description`, `list_projects`,
`get_preferred_project`, `set_preferred_project`, `clear_preferred_project`,
`list_board_stages`, `list_users`, `list_teams`, `get_me`) for four flows: `plan`,
`list`, `break`, `brief`. If the `runrunit` MCP isn't available, tell the user and
stop — never invent data.

**Always reply to the user in Portuguese (pt-BR)** — this applies to every output:
analysis, proposals, tables, confirmations, and task titles/descriptions written to
Runrun.it. These instructions are in English for the model's own clarity, but nothing
you show the user or write into a task should be in English unless the user writes to
you in English first.

General rule: **`plan` and `break` always propose before creating or changing anything
in Runrun.it.** Never call `create_task`/`update_task` without the user having
explicitly confirmed the final list of items and their properties. `list` and `brief`
are read-only and need no confirmation.

**Never call `create_task` without `board_stage_id`.** Without it, Runrun.it does not
inherit the project's board — the task lands on the account's default board (which may
belong to a different team, e.g. Marketing), even with the correct `project_id`. Always
resolve it:
1. `list_projects` already returns the chosen project's `board_id`.
2. `list_board_stages(board_id)` to list valid stages and pick/ask which one to use
   (usually the first one in the `opened` group, e.g. "Backlog").
3. For `type_id` and `custom_fields` (Produto, Sistema, Tipo de solicitação, Equipe,
   etc.) — there's no schema endpoint for these. Look up a recent task in the same
   project (`list_tasks` with `project_id`, `limit: 1`, `sort_by: "created_at"`) and
   call `get_task_details` on it to copy `type_id`/`custom_fields` as a default
   suggestion. Show these values to the user in the proposal — never create the task
   with these fields silently left blank.

**Even with a resolved `board_stage_id`, `create_task` can still fail** with `422 "A
etapa deve pertencer a este quadro"` for some projects — the API sometimes resolves
"this project's board" in a way that doesn't match the `board_id` shown by the
project's own existing tasks. When this happens, fall back to this sequence instead
(don't retry the same call, don't give up):
1. `create_task` again, but **minimal** — only `title`, `project_id`, `type_id`,
   `team_id`. Drop `board_stage_id`, `custom_fields`, and `responsible_id` from this
   call — the task will land on the account's default board, whose custom fields and
   user authorizations differ from the project's real board, so passing those now
   causes further `422`s (`"O campo 'X' não pertence ao quadro da tarefa"` or
   `"user_not_authorized"`) even when they're correct for the target board.
2. `change_task_board(task_id, board_id)` to move it to the project's real board — this
   already drops it on that board's default stage (usually Backlog).
3. `update_task` with the `custom_fields` (and `board_stage_id` only if a non-default
   stage is needed) — this now succeeds since the task is on the right board.
4. Assign the responsible person with `assign_task_user(task_id, assignee_id,
   team_id)` — not `update_task`'s `responsible_id`, which returns 200 but silently
   leaves `responsible_id` as `null`.
5. `update_task_description` as usual, last.

**When writing a task's description** (via `update_task_description`, called after
`create_task`): prioritize text that's easy to read and straight to the point, not
tiring. Short sentences, bullet points instead of long paragraphs, only the essentials
— what to do, critical technical context (e.g. where in the code, dependencies, open
decisions), and points of attention. No filler intro/conclusion, and don't repeat what
the title already says. (Written in Portuguese, per the rule above.)

## `rr plan [context]`

Goal: turn a natural-language description into one or more real tasks in Runrun.it.

1. Read the given `[context]` and identify the work item(s) to create as task(s).
2. **Never assume project, board, responsible, or team.** Ask:
   - Project: call `get_preferred_project` first (this is per-user — stored in the MCP's
     own cache keyed by this user's Runrun.it credentials, never hardcoded in this
     skill, since a teammate could have a different one pinned). If it returns one,
     propose it directly (e.g. "vou usar o projeto preferido *[nome]* — confirma ou
     quer outro?") instead of listing every project; the user can still ask for a
     different one. If there's none, or the user wants a different project, call
     `list_projects` and present the options (name + client) instead of asking for a
     raw ID. When the user explicitly asks to pin a project as default (e.g. "sempre
     use esse", "deixa esse como preferido"), call `set_preferred_project` with its id
     and name; `clear_preferred_project` unsets it if asked.
   - Board/stage: if `get_preferred_project` returned a `boardId`/`boardName` for the
     chosen project, use that board directly instead of re-resolving it. Otherwise use
     the `board_id` returned by `list_projects` and call `list_board_stages(board_id)`.
     Pick (or ask, if not obvious) the initial stage — see the general rule above about
     never creating without `board_stage_id`. When the user asks to pin the board too
     (e.g. "salva essa opção nos favoritos também"), call `set_preferred_project` again
     with the same `project_id`/`project_name` plus `board_id`/`board_name`.
   - Type and custom fields: look up a recent task in the same project (`list_tasks` +
     `get_task_details`, see general rule above) and bring its `type_id`/
     `custom_fields` as a default suggestion — don't ask field by field, just show
     what will be used in the step-3 proposal so the user can correct it.
   - Responsible person(s): call `list_users` (filtered by `team_id` if already known)
     and present options.
   - Team (`team_id`), urgency, estimate (`current_estimate_seconds`), and desired date
     (`estimated_delivery_date`) — ask only when it makes sense for the context, don't
     force every field every time.
3. Put together a proposal: list of tasks with title + description (see the general
   rule above on direct, easy-to-read style) + all resolved properties, including the
   board/stage and suggested type/custom fields (step 2). Present this list to the user
   clearly (e.g. a table) and ask for confirmation or adjustment.
4. Only after explicit confirmation, call `create_task` once per confirmed item,
   always passing `board_stage_id` (and `type_id`/`custom_fields` when resolved in step
   2), followed by `update_task_description` with the confirmed description. If
   `create_task` 422s on the board/stage, use the fallback sequence from the general
   rule above instead of retrying the same call.
5. Report the result: for each created task, show `id`, `title`, and `link` (already
   included in `create_task`'s return via `simplifyTask`).

## `rr list [criteria]`

Goal: query existing tasks.

1. If the `[criteria]` is already clear and complete (e.g. "my open tasks in project
   X"), translate it directly into `list_tasks` filters (`responsible_id`,
   `project_id`, `team_id`, `is_closed`, `board_stage_id`, `overdue`,
   `parent_task_id`, `completed_since`/`completed_before`, `sort_by`, `page`, `limit`).
2. If the criteria is vague or missing, **ask** what to filter by (responsible person,
   project, open/closed status, period) — don't assume "my tasks" or "all open" without
   confirming. Use `list_projects`/`list_users`/`get_me` to help resolve names into IDs
   when needed.
3. Call `list_tasks` with the resolved filters.
4. Present the result as a compact table: id, title, status, responsible, project, due
   date. If empty, say so clearly instead of staying silent.

## `rr break [task-id]`

Goal: split a task into **real** subtasks (via `parent_task_id`), not checklist items.

1. Call `get_task_details` on the parent task to see title, description,
   `subtask_ids`, `board_stage_id`, `type_id`, and `custom_fields` — subtasks should
   inherit these fields by default (same general rule from the top: never create via
   `create_task` without `board_stage_id`, or the subtask lands on the account's
   default board instead of the parent task's board).
2. If `subtask_ids` already has items, list the existing subtasks (you can use
   `list_tasks` with `parent_task_id: <task-id>` to see each one's status) and ask if
   the user wants to add more subtasks or stop here.
3. Propose a split: titles + short descriptions for the subtasks (see the general rule
   above on direct, easy-to-read style), inheriting `project_id`, `team_id`,
   `board_stage_id`, `type_id`, and `custom_fields` from the parent task by default
   (unless the user explicitly asks for a different project/team/stage). Ask for each
   subtask's responsible person if relevant — it doesn't have to match the parent
   task's.
4. Present the complete proposal (including the inherited board/stage) and wait for
   the user's confirmation/adjustment.
5. Only after confirmation, call `create_task` once per subtask, always passing
   `parent_task_id: <task-id>` and `board_stage_id` (+ `type_id`/`custom_fields` when
   inherited in step 1), followed by `update_task_description` whenever there's a
   description.
6. Report the ids/links of the created subtasks.

## `rr brief [task-id]`

Goal: a quick, complete summary of a task. **Read-only — no confirmation needed.**

1. Call `get_task` (title, status, responsible, project, dates, worked/estimated time)
   and `get_task_description` (full description body) for the given task.
2. If the task has `subtask_ids`, call `list_tasks` with `parent_task_id: <task-id>` to
   summarize how many subtasks exist, how many are closed, and who's responsible.
3. Put together the brief with: title, status/stage, responsible, project, dates
   (created/estimated delivery), worked vs. estimated time, a summary of the
   description, and — if present — a summary of subtask progress. End with the task's
   `link`.
