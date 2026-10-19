import { runrunitFetch, type RunrunitProject } from "../client.js";
import { withCache } from "../cache.js";
import {
  getPreferredProject,
  setPreferredProject,
  clearPreferredProject,
} from "../preferences.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const projectToolDefinitions = [
  {
    name: "list_projects",
    description:
      "List available projects in Runrun.it with progress and time metrics, " +
      "including each project's board_id and type_id (needed to pick the right " +
      "board_stage_id when creating a task with create_task — otherwise Runrun.it " +
      "defaults new tasks to the account's default board, not the project's own board). " +
      "Reference data — cached for 1h; pass force_refresh to bypass.",
    inputSchema: {
      type: "object",
      properties: {
        is_closed: {
          type: "boolean",
          description: "Filter by open (false) or closed (true) projects",
        },
        limit: {
          type: "number",
          description: "Number of projects to return",
        },
        page: {
          type: "number",
          description: "Page number for pagination (default: 1)",
        },
        force_refresh: {
          type: "boolean",
          description: "Bypass the 1h cache and fetch fresh data from the API",
        },
      },
    },
  },
  {
    name: "get_preferred_project",
    description:
      "Return the project this user has pinned as their default for `rr plan` " +
      "via set_preferred_project, or null if none is set. Per-user — keyed by this " +
      "user's own Runrun.it credentials, so teammates sharing the same account each " +
      "keep their own preferred project.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_preferred_project",
    description:
      "Pin a project (and optionally its board) as this user's default for `rr plan`, " +
      "so future planning sessions can skip asking which project/board to use. " +
      "Per-user — does not affect other Runrun.it users sharing the same account. " +
      "Re-pinning the same project_id without board_id/board_name keeps the " +
      "previously pinned board; pinning a different project_id drops it.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project's id" },
        project_name: { type: "string", description: "The project's name, for display" },
        board_id: {
          type: "number",
          description: "This project's preferred board id, if pinning one",
        },
        board_name: {
          type: "string",
          description: "This project's preferred board name, for display",
        },
      },
      required: ["project_id", "project_name"],
    },
  },
  {
    name: "clear_preferred_project",
    description: "Unset this user's preferred project.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function simplifyProject(project: RunrunitProject) {
  const totalTasks = project.total_tasks ?? 0;
  const closedTasks = project.total_closed_tasks ?? 0;
  const progress = totalTasks > 0 ? Math.round((closedTasks / totalTasks) * 100) : 0;
  const timeWorkedH = project.time_worked !== undefined
    ? `${(project.time_worked / 3600).toFixed(1)}h`
    : undefined;
  const estimatedH = project.estimated_time !== undefined
    ? `${(project.estimated_time / 3600).toFixed(1)}h`
    : undefined;

  return {
    id: project.id,
    name: project.name,
    client_name: project.client_name ?? "Sem cliente",
    is_closed: project.is_closed ?? false,
    total_tasks: totalTasks,
    closed_tasks: closedTasks,
    progress_pct: `${progress}%`,
    time_worked: timeWorkedH,
    estimated_time: estimatedH,
    desired_date: project.desired_date ?? null,
    board_id: project.board_id,
    type_id: project.type_id,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown> | undefined;

export async function handleProjectTool(name: string, args: ToolArgs) {
  switch (name) {
    case "list_projects": {
      const projectList = await withCache("list_projects", args, async () => {
        const params = new URLSearchParams();
        if (args) {
          Object.entries(args).forEach(([key, value]) => {
            if (key !== "force_refresh" && value !== undefined) {
              params.append(key, String(value));
            }
          });
        }
        const projects =
          (await runrunitFetch(`/projects?${params.toString()}`)) ?? [];
        const list = Array.isArray(projects) ? (projects as RunrunitProject[]) : [];
        return list.map(simplifyProject);
      });

      return {
        content: [{ type: "text", text: JSON.stringify(projectList, null, 2) }],
      };
    }

    case "get_preferred_project": {
      const preferred = await getPreferredProject();
      return {
        content: [{ type: "text", text: JSON.stringify(preferred, null, 2) }],
      };
    }

    case "set_preferred_project": {
      const projectId = args?.["project_id"];
      const projectName = args?.["project_name"];
      const boardId = args?.["board_id"];
      const boardName = args?.["board_name"];
      if (typeof projectId !== "number" || typeof projectName !== "string") {
        throw new Error(
          "set_preferred_project requires project_id (number) and project_name (string)",
        );
      }
      if (
        (boardId !== undefined || boardName !== undefined) &&
        (typeof boardId !== "number" || typeof boardName !== "string")
      ) {
        throw new Error(
          "set_preferred_project requires both board_id (number) and board_name (string) when pinning a board",
        );
      }
      const board = typeof boardId === "number" && typeof boardName === "string"
        ? { id: boardId, name: boardName }
        : undefined;
      const entry = await setPreferredProject(projectId, projectName, board);
      return {
        content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
      };
    }

    case "clear_preferred_project": {
      await clearPreferredProject();
      return {
        content: [{ type: "text", text: "Preferred project cleared." }],
      };
    }

    default:
      throw new Error(`Unknown project tool: ${name}`);
  }
}
