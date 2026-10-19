import { runrunitFetch, type RunrunitUser, type RunrunitTeam } from "../client.js";
import { withCache } from "../cache.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const userToolDefinitions = [
  {
    name: "get_me",
    description:
      "Get information about the current authenticated user. " +
      "Reference data — cached for 1h; pass force_refresh to bypass.",
    inputSchema: {
      type: "object",
      properties: {
        force_refresh: {
          type: "boolean",
          description: "Bypass the 1h cache and fetch fresh data from the API",
        },
      },
    },
  },
  {
    name: "list_users",
    description:
      "List users in the organization, optionally filtered by team. " +
      "Reference data — cached for 1h; pass force_refresh to bypass.",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "number",
          description: "Filter users by team ID",
        },
        limit: {
          type: "number",
          description: "Number of users to return",
        },
        force_refresh: {
          type: "boolean",
          description: "Bypass the 1h cache and fetch fresh data from the API",
        },
      },
    },
  },
  {
    name: "list_teams",
    description:
      "List all teams in the organization, including their members and board. " +
      "Reference data — cached for 1h; pass force_refresh to bypass.",
    inputSchema: {
      type: "object",
      properties: {
        force_refresh: {
          type: "boolean",
          description: "Bypass the 1h cache and fetch fresh data from the API",
        },
      },
    },
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simplifyUser(user: RunrunitUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    position: user.position,
    is_manager: user.is_manager,
    team_ids: user.team_ids,
    on_vacation: user.on_vacation,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown> | undefined;

export async function handleUserTool(name: string, args: ToolArgs) {
  switch (name) {
    case "get_me": {
      const user = await withCache("get_me", args, () =>
        runrunitFetch("/users/me") as Promise<RunrunitUser>,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(user, null, 2) }],
      };
    }

    case "list_users": {
      const userList = await withCache("list_users", args, async () => {
        const params = new URLSearchParams();
        if (args) {
          Object.entries(args).forEach(([key, value]) => {
            if (key !== "force_refresh" && value !== undefined) {
              params.append(key, String(value));
            }
          });
        }
        const users = (await runrunitFetch(`/users?${params.toString()}`)) ?? [];
        const list = Array.isArray(users) ? (users as RunrunitUser[]) : [];
        return list.map(simplifyUser);
      });

      return {
        content: [{ type: "text", text: JSON.stringify(userList, null, 2) }],
      };
    }

    case "list_teams": {
      const teamList = await withCache("list_teams", args, async () => {
        const teams = (await runrunitFetch("/teams")) ?? [];
        const list = Array.isArray(teams) ? (teams as RunrunitTeam[]) : [];
        return list.map((t) => ({
          id: t.id,
          name: t.name,
          leader_id: t.leader_id,
          board_id: t.board_id,
          member_ids: t.user_ids ?? [],
        }));
      });

      return {
        content: [{ type: "text", text: JSON.stringify(teamList, null, 2) }],
      };
    }

    default:
      throw new Error(`Unknown user tool: ${name}`);
  }
}
