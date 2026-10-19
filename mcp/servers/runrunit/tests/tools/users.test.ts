import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("../../src/env.js", () => ({
  env: {
    RUNRUNIT_APP_KEY: "test-app-key",
    RUNRUNIT_USER_TOKEN: "test-user-token",
  },
}));

vi.mock("../../src/client.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/client.js")>();
  return {
    ...original,
    runrunitFetch: vi.fn(),
  };
});

const { handleUserTool } = await import("../../src/tools/users.js");
const { runrunitFetch } = await import("../../src/client.js");
const mockFetch = vi.mocked(runrunitFetch);

describe("handleUserTool", () => {
  // get_me/list_users/list_teams are disk-cached (reference data) — isolate
  // each test behind its own fresh cache dir, otherwise the second {}-args
  // test to run would get a prior test's cached result instead of calling
  // the mocked fetch.
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-cache-test-"));
    process.env["RUNRUNIT_CACHE_DIR"] = cacheDir;
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env["RUNRUNIT_CACHE_DIR"];
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  describe("get_me", () => {
    it("returns current user data", async () => {
      const user = { id: 7, name: "Mario", email: "ana@example.com" };
      mockFetch.mockResolvedValueOnce(user);

      const result = await handleUserTool("get_me", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed.id).toBe(7);
      expect(parsed.name).toBe("Mario");
      expect(parsed.email).toBe("ana@example.com");
    });

    it("calls the /users/me endpoint", async () => {
      mockFetch.mockResolvedValueOnce({ id: 1, name: "Test" });

      await handleUserTool("get_me", {});

      expect(mockFetch).toHaveBeenCalledWith("/users/me");
    });
  });

  describe("list_users", () => {
    it("returns simplified list of users", async () => {
      const users = [
        { id: "ana-souza", name: "Ana Souza", email: "ana@example.com", position: "Dev", is_manager: true, team_ids: [1], on_vacation: false },
        { id: "joao-silva", name: "Joao Silva", email: "joao@example.com", position: "QA",  is_manager: false, team_ids: [1], on_vacation: false },
      ];
      mockFetch.mockResolvedValueOnce(users);

      const result = await handleUserTool("list_users", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      ) as Array<{ id: string; name: string }>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.id).toBe("ana-souza");
      expect(parsed[0]?.name).toBe("Ana Souza");
    });

    it("passes team_id and limit as query params", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleUserTool("list_users", { team_id: 481379, limit: 10 });

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).toContain("team_id=481379");
      expect(endpoint).toContain("limit=10");
    });

    it("returns empty array when API returns null", async () => {
      mockFetch.mockResolvedValueOnce(null);

      const result = await handleUserTool("list_users", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed).toEqual([]);
    });

    it("serves the second identical call from cache without refetching", async () => {
      mockFetch.mockResolvedValueOnce([
        { id: "ana-souza", name: "Ana Souza" },
      ]);

      const first = await handleUserTool("list_users", { team_id: 1 });
      const second = await handleUserTool("list_users", { team_id: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
    });

    it("force_refresh bypasses the cache and refetches", async () => {
      mockFetch.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await handleUserTool("list_users", { team_id: 1 });
      await handleUserTool("list_users", { team_id: 1, force_refresh: true });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("get_me caching", () => {
    it("serves the second call from cache without refetching", async () => {
      mockFetch.mockResolvedValueOnce({ id: 7, name: "Mario" });

      await handleUserTool("get_me", {});
      await handleUserTool("get_me", {});

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("list_teams", () => {
    it("returns simplified team list", async () => {
      const teams = [
        { id: 1, name: "Engineering", leader_id: "ana-souza", board_id: 9, user_ids: ["ana-souza", "joao-silva"] },
      ];
      mockFetch.mockResolvedValueOnce(teams);

      const result = await handleUserTool("list_teams", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      ) as Array<{ id: number; member_ids: string[] }>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.id).toBe(1);
      expect(parsed[0]?.member_ids).toEqual(["ana-souza", "joao-silva"]);
    });

    it("serves the second call from cache without refetching", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleUserTool("list_teams", {});
      await handleUserTool("list_teams", {});

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("unknown tool", () => {
    it("throws for unknown tool name", async () => {
      await expect(handleUserTool("nonexistent_tool", {})).rejects.toThrow(
        "Unknown user tool: nonexistent_tool",
      );
    });
  });
});
