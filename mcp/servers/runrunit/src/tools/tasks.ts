import {
  runrunitFetch,
  type RunrunitTask,
  type RunrunitTaskDescription,
} from "../client.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const taskToolDefinitions = [
  {
    name: "get_task",
    description:
      "Get core information about a specific task (Title and Description). Use this for general context about what needs to be done.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "The ID of the task to retrieve",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_task_details",
    description:
      "Get the FULL, raw API response for a task. WARNING: This is very large. Only use if you specifically need technical fields, custom field values, or deep task metadata not available in get_task.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "The ID of the task to retrieve",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_tasks",
    description:
      "List tasks with optional filters. Returns simplified task objects. Use this to find tasks by user, project, or status.",
    inputSchema: {
      type: "object",
      properties: {
        responsible_id: {
          type: "string",
          description: "ID (slug) of user responsible for the task, e.g. 'mario-neto'",
        },
        project_id: {
          type: "number",
          description: "ID of the project the task belongs to",
        },
        team_id: {
          type: "number",
          description: "ID of the team",
        },
        is_closed: {
          type: "boolean",
          description: "Filter by closed status",
        },
        board_stage_id: {
          type: "number",
          description: "Filter by board stage (kanban column) ID",
        },
        overdue: {
          type: "boolean",
          description: "Filter only overdue tasks",
        },
        parent_task_id: {
          type: "number",
          description: "Filter by parent task ID — use this to list an existing task's subtasks",
        },
        completed_since: {
          type: "string",
          description: "Return tasks completed after this datetime (ISO 8601, e.g. '2026-03-01T00:00:00Z')",
        },
        completed_before: {
          type: "string",
          description: "Return tasks completed before this datetime (ISO 8601, e.g. '2026-03-31T23:59:59Z')",
        },
        sort_by: {
          type: "string",
          description: "Field to sort by, e.g. 'created_at', 'estimated_delivery_date'",
        },
        page: {
          type: "number",
          description: "Page number for pagination (default: 1)",
        },
        limit: {
          type: "number",
          description: "Number of tasks to return (max 100)",
        },
      },
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task in Runrun.it. IMPORTANT: without board_stage_id, Runrun.it " +
      "silently places the task on the account's default board instead of the " +
      "project's own board — call list_projects to get the project's board_id, then " +
      "list_board_stages(board_id) to pick a valid board_stage_id before creating.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Task title",
        },
        project_id: {
          type: "number",
          description: "ID of the project to create the task in",
        },
        board_stage_id: {
          type: "number",
          description:
            "ID of the board stage (kanban column) to create the task in — get valid " +
            "values from list_board_stages using the project's board_id (from " +
            "list_projects). Omitting this puts the task on the account's default " +
            "board, not the project's board.",
        },
        type_id: {
          type: "number",
          description: "ID of the task type — check a sibling task in the same project (get_task_details) for a sensible default",
        },
        custom_fields: {
          type: "object",
          description:
            "Task custom fields (e.g. Produto, Sistema, Tipo de solicitação, Equipe). " +
            "Shape mirrors the custom_fields object returned by get_task_details for an " +
            "existing task in the same project — copy that shape/values as a starting point.",
        },
        responsible_id: {
          type: "string",
          description: "ID (slug) of the user responsible for the task",
        },
        team_id: {
          type: "number",
          description: "ID of the team",
        },
        desired_date: {
          type: "string",
          description:
            "Desired/due date in YYYY-MM-DD format. This is the correct API field name " +
            "for a task's deadline (do not use estimated_delivery_date — that one is " +
            "computed by the API from the assignee's queue and was never a valid write " +
            "field). WARNING: as of writing, this field does not reliably persist " +
            "through this endpoint even though the API accepts the request — verify " +
            "with get_task_details after setting it, and if it's still null, tell the " +
            "user to set the due date manually in the Runrun.it UI instead of reporting success.",
        },
        current_estimate_seconds: {
          type: "number",
          description: "Time estimate in seconds (e.g. 3600 = 1 hour)",
        },
        is_urgent: {
          type: "boolean",
          description: "Mark the task as urgent",
        },
        parent_task_id: {
          type: "number",
          description: "ID of the parent task — creates this task as a real subtask of it",
        },
      },
      required: ["title", "project_id"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task in Runrun.it",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "ID of the task to update",
        },
        title: {
          type: "string",
          description: "New task title",
        },
        responsible_id: {
          type: "string",
          description: "ID (slug) of the new responsible user",
        },
        team_id: {
          type: "number",
          description: "ID of the team",
        },
        board_stage_id: {
          type: "number",
          description: "ID of the board stage to move the task to",
        },
        type_id: {
          type: "number",
          description: "ID of the task type — check a sibling task in the same project (get_task_details) for a sensible default",
        },
        custom_fields: {
          type: "object",
          description:
            "Task custom fields to set (e.g. Produto, Sistema, Tipo de solicitação, " +
            "Equipe). Shape mirrors the custom_fields object returned by get_task_details.",
        },
        desired_date: {
          type: "string",
          description:
            "New desired/due date in YYYY-MM-DD format — this is the field Runrun.it " +
            "actually stores and shows as the task's deadline. (Do not confuse with " +
            "estimated_delivery_date, which the API computes from the assignee's queue " +
            "and does not accept as write input.)",
        },
        current_estimate_seconds: {
          type: "number",
          description: "New time estimate in seconds",
        },
        is_closed: {
          type: "boolean",
          description: "Close or reopen the task",
        },
        is_urgent: {
          type: "boolean",
          description: "Mark or unmark as urgent",
        },
        points: {
          type: "number",
          description: "Scrum points for the task",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_task_description",
    description: "Get the full description details of a task, including who is editing it and when it was last updated.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "number",
          description: "The ID of the task",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "assign_task_user",
    description: "Assign a user to a task in Runrun.it",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "number",
          description: "The ID of the task",
        },
        assignee_id: {
          type: "string",
          description: "ID (slug) of the user to assign, e.g. 'mario-neto'",
        },
        team_id: {
          type: "number",
          description: "ID of the team",
        },
      },
      required: ["task_id", "assignee_id"],
    },
  },
  {
    name: "update_task_description",
    description: "Update the description body of a task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "number",
          description: "The ID of the task",
        },
        body: {
          type: "string",
          description: "Task description body",
        },
      },
      required: ["task_id", "body"],
    },
  },
  {
    name: "change_task_board",
    description: "Move a task to a different board in Runrun.it.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "number",
          description: "The ID of the task",
        },
        board_id: {
          type: "number",
          description: "The ID of the board to move the task to",
        },
      },
      required: ["task_id", "board_id"],
    },
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function simplifyTask(task: RunrunitTask) {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "No description",
    status: task.task_status_name ?? task.board_stage_name ?? task.state,
    responsible: task.responsible_name,
    responsible_id: task.responsible_id,
    project: task.project_name ?? "No project",
    project_id: task.project_id,
    team: task.team_name,
    team_id: task.team_id,
    overdue: task.overdue === "on_schedule" ? "On schedule" : task.overdue,
    created_at: task.created_at,
    estimated_delivery: task.estimated_delivery_date,
    desired_date: task.desired_date,
    time_worked: `${(task.time_worked / 3600).toFixed(2)}h`,
    time_total: `${(task.time_total / 3600).toFixed(2)}h`,
    estimate: task.current_estimate_seconds !== undefined
      ? `${(task.current_estimate_seconds / 3600).toFixed(2)}h`
      : undefined,
    priority: task.priority,
    is_closed: task.is_closed,
    is_urgent: task.is_urgent,
    parent_task_id: task.parent_task_id,
    subtask_ids: task.subtask_ids,
    board_id: task.board_id,
    board_stage_id: task.board_stage_id,
    type_id: task.type_id,
    custom_fields: task.custom_fields,
    link: `https://runrun.it/pt-BR/tasks/${task.id}`,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown> | undefined;

// GET /tasks?parent_task_id=X silently ignores the filter on the real Runrun.it API
// (confirmed against production: it returns unrelated tasks from unrelated projects,
// not the task's actual descendants) despite being documented. subtask_ids on the
// task resource itself is reliable, so walk that tree instead and apply the other
// filters client-side.
async function fetchDescendantTasks(rootId: number): Promise<RunrunitTask[]> {
  const root = (await runrunitFetch(`/tasks/${rootId}`)) as RunrunitTask;
  const queue = [...(root.subtask_ids ?? [])];
  const results: RunrunitTask[] = [];
  const seen = new Set<number>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);

    const task = (await runrunitFetch(`/tasks/${id}`)) as RunrunitTask;
    results.push(task);
    if (task.subtask_ids?.length) queue.push(...task.subtask_ids);
  }

  return results;
}

function matchesTaskFilters(task: RunrunitTask, args: ToolArgs): boolean {
  if (args?.["project_id"] !== undefined && task.project_id !== args["project_id"]) return false;
  if (args?.["team_id"] !== undefined && task.team_id !== args["team_id"]) return false;
  if (args?.["board_stage_id"] !== undefined && task.board_stage_id !== args["board_stage_id"]) return false;
  if (args?.["is_closed"] !== undefined && task.is_closed !== args["is_closed"]) return false;
  if (args?.["responsible_id"] !== undefined && task.responsible_id !== args["responsible_id"]) return false;
  if (args?.["overdue"] !== undefined) {
    const isOverdue = task.overdue !== undefined && task.overdue !== "on_schedule";
    if (isOverdue !== args["overdue"]) return false;
  }
  return true;
}

export async function handleTaskTool(name: string, args: ToolArgs) {
  switch (name) {
    case "get_task": {
      const id = args?.["id"] as number | undefined;
      if (!id) throw new Error("Task ID is required");

      const [task, descData] = await Promise.all([
        runrunitFetch(`/tasks/${id}`) as Promise<RunrunitTask>,
        (runrunitFetch(`/tasks/${id}/description`) as Promise<RunrunitTaskDescription>).catch(
          (err: unknown) => {
            console.error(`Failed to fetch description for task ${id}:`, err);
            return { description: "Could not fetch description", body: undefined } as RunrunitTaskDescription;
          },
        ),
      ]);

      const updatedDesc = descData.body || descData.description;
      if (updatedDesc) {
        task.description = updatedDesc;
      }

      return {
        content: [
          { type: "text", text: JSON.stringify(simplifyTask(task), null, 2) },
        ],
      };
    }

    case "get_task_details": {
      const id = args?.["id"] as number | undefined;
      if (!id) throw new Error("Task ID is required");
      const task = await runrunitFetch(`/tasks/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
      };
    }

    case "list_tasks": {
      const parentTaskId = args?.["parent_task_id"] as number | undefined;
      let taskList: RunrunitTask[];

      if (parentTaskId !== undefined) {
        const descendants = await fetchDescendantTasks(parentTaskId);
        taskList = descendants.filter((task) => matchesTaskFilters(task, args));
        const limit = args?.["limit"] as number | undefined;
        if (limit !== undefined) taskList = taskList.slice(0, limit);
      } else {
        const params = new URLSearchParams();
        if (args) {
          Object.entries(args).forEach(([key, value]) => {
            if (value !== undefined) params.append(key, String(value));
          });
        }
        const tasks = (await runrunitFetch(`/tasks?${params.toString()}`)) ?? [];
        taskList = Array.isArray(tasks) ? (tasks as RunrunitTask[]) : [];
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(taskList.map(simplifyTask), null, 2),
          },
        ],
      };
    }

    case "create_task": {
      const title = args?.["title"] as string | undefined;
      const project_id = args?.["project_id"] as number | undefined;
      if (!title) throw new Error("Task title is required");
      if (!project_id) throw new Error("project_id is required");

      const body: Record<string, unknown> = { title, project_id };
      const optionalFields = [
        "responsible_id", "team_id", "desired_date",
        "current_estimate_seconds", "is_urgent", "parent_task_id",
        "board_stage_id", "type_id", "custom_fields",
      ] as const;
      for (const field of optionalFields) {
        if (args?.[field] !== undefined) body[field] = args[field];
      }

      const task = await runrunitFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({ task: body }),
      }) as RunrunitTask;

      return {
        content: [
          { type: "text", text: JSON.stringify(simplifyTask(task), null, 2) },
        ],
      };
    }

    case "update_task": {
      const id = args?.["id"] as number | undefined;
      if (!id) throw new Error("Task ID is required");

      const body: Record<string, unknown> = {};
      const updatableFields = [
        "title", "responsible_id", "team_id", "board_stage_id", "type_id", "custom_fields",
        "desired_date", "current_estimate_seconds",
        "is_closed", "is_urgent", "points",
      ] as const;
      for (const field of updatableFields) {
        if (args?.[field] !== undefined) body[field] = args[field];
      }

      const task = await runrunitFetch(`/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify({ task: body }),
      }) as RunrunitTask;

      return {
        content: [
          { type: "text", text: JSON.stringify(simplifyTask(task), null, 2) },
        ],
      };
    }

    case "assign_task_user": {
      const task_id = args?.["task_id"] as number | undefined;
      const assignee_id = args?.["assignee_id"] as string | undefined;
      if (!task_id) throw new Error("task_id is required");
      if (!assignee_id) throw new Error("assignee_id is required");

      const team_id = args?.["team_id"] as number | undefined;
      const assignment: Record<string, unknown> = { assignee_id };
      if (team_id !== undefined) assignment["team_id"] = team_id;

      const data = await runrunitFetch(`/tasks/${task_id}/create_assignments`, {
        method: "POST",
        body: JSON.stringify({ assignments: [assignment] }),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    case "get_task_description": {
      const task_id = args?.["task_id"] as number | undefined;
      if (!task_id) throw new Error("Task ID is required");

      const descData = await runrunitFetch(`/tasks/${task_id}/description`);

      return {
        content: [{ type: "text", text: JSON.stringify(descData, null, 2) }],
      };
    }

    case "update_task_description": {
      const task_id = args?.["task_id"] as number | undefined;
      const body = args?.["body"] as string | undefined;

      if (!task_id) throw new Error("Task ID is required");
      if (body === undefined) throw new Error("Description body is required");

      const descData = await runrunitFetch(`/tasks/${task_id}/description`, {
        method: "PUT",
        body: JSON.stringify({ description: body }),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(descData, null, 2) }],
      };
    }

    case "change_task_board": {
      const task_id = args?.["task_id"] as number | undefined;
      const board_id = args?.["board_id"] as number | undefined;
      if (!task_id) throw new Error("task_id is required");
      if (!board_id) throw new Error("board_id is required");

      const data = await runrunitFetch(`/tasks/${task_id}/change_board`, {
        method: "POST",
        body: JSON.stringify({ board_id }),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    default:
      throw new Error(`Unknown task tool: ${name}`);
  }
}
