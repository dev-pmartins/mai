import { runrunitFetch } from "../client.js";
import { withCache } from "../cache.js";

// ─── API response interface ───────────────────────────────────────────────────

export interface RunrunitBoardStage {
  id: number;
  name: string;
  description?: string;
  stage_group?: "opened" | "closed";
  board_id?: number;
  position?: number;
  [key: string]: unknown;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const boardToolDefinitions = [
  {
    name: "list_board_stages",
    description:
      "List the stages (kanban columns) of a board. A project's tasks are only " +
      "placed on that project's own board when create_task is given a board_stage_id " +
      "from this list — get the board_id from list_projects first. Without it, " +
      "Runrun.it silently drops new tasks onto the account's default board instead of " +
      "the project's board. Reference data — cached for 1h; pass force_refresh to bypass.",
    inputSchema: {
      type: "object",
      properties: {
        board_id: {
          type: "number",
          description: "ID of the board (get it from list_projects' board_id field)",
        },
        stage_group: {
          type: "string",
          description: "Filter by stage group: 'opened' or 'closed'",
        },
        force_refresh: {
          type: "boolean",
          description: "Bypass the 1h cache and fetch fresh data from the API",
        },
      },
      required: ["board_id"],
    },
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simplifyBoardStage(stage: RunrunitBoardStage) {
  return {
    id: stage.id,
    name: stage.name,
    description: stage.description,
    stage_group: stage.stage_group,
    board_id: stage.board_id,
    position: stage.position,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown> | undefined;

export async function handleBoardTool(name: string, args: ToolArgs) {
  switch (name) {
    case "list_board_stages": {
      const board_id = args?.["board_id"] as number | undefined;
      if (!board_id) throw new Error("board_id is required");

      const stageList = await withCache("list_board_stages", args, async () => {
        const params = new URLSearchParams();
        if (args) {
          Object.entries(args).forEach(([key, value]) => {
            if (key !== "force_refresh" && key !== "board_id" && value !== undefined) {
              params.append(key, String(value));
            }
          });
        }
        const stages =
          (await runrunitFetch(`/boards/${board_id}/stages?${params.toString()}`)) ?? [];
        const list = Array.isArray(stages) ? (stages as RunrunitBoardStage[]) : [];
        return list.map(simplifyBoardStage);
      });

      return {
        content: [{ type: "text", text: JSON.stringify(stageList, null, 2) }],
      };
    }

    default:
      throw new Error(`Unknown board tool: ${name}`);
  }
}
