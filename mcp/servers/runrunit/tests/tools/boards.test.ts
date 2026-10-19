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

const { handleBoardTool } = await import("../../src/tools/boards.js");
const { runrunitFetch } = await import("../../src/client.js");
const mockFetch = vi.mocked(runrunitFetch);

describe("handleBoardTool", () => {
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

  describe("list_board_stages", () => {
    it("returns list of simplified board stages", async () => {
      mockFetch.mockResolvedValueOnce([
        { id: 1, name: "Backlog", stage_group: "opened", board_id: 2002, position: 1 },
        { id: 2, name: "Done", stage_group: "closed", board_id: 2002, position: 2 },
      ]);

      const result = await handleBoardTool("list_board_stages", { board_id: 2002 });
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      ) as Array<{ id: number; name: string }>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.name).toBe("Backlog");
    });

    it("calls the correct board endpoint", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleBoardTool("list_board_stages", { board_id: 2002 });

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).toMatch(/^\/boards\/2002\/stages/);
    });

    it("passes stage_group as a query param", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleBoardTool("list_board_stages", { board_id: 2002, stage_group: "opened" });

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).toContain("stage_group=opened");
    });

    it("does not send board_id or force_refresh as query params", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleBoardTool("list_board_stages", { board_id: 2002, force_refresh: true });

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).not.toContain("board_id");
      expect(endpoint).not.toContain("force_refresh");
    });

    it("returns empty array when API returns null", async () => {
      mockFetch.mockResolvedValueOnce(null);

      const result = await handleBoardTool("list_board_stages", { board_id: 2002 });
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed).toEqual([]);
    });

    it("throws when board_id is missing", async () => {
      await expect(handleBoardTool("list_board_stages", {})).rejects.toThrow(
        "board_id is required",
      );
    });

    it("serves the second identical call from cache without refetching", async () => {
      mockFetch.mockResolvedValueOnce([{ id: 1, name: "Backlog" }]);

      const first = await handleBoardTool("list_board_stages", { board_id: 2002 });
      const second = await handleBoardTool("list_board_stages", { board_id: 2002 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
    });

    it("force_refresh bypasses the cache and refetches", async () => {
      mockFetch
        .mockResolvedValueOnce([{ id: 1, name: "First" }])
        .mockResolvedValueOnce([{ id: 2, name: "Second" }]);

      await handleBoardTool("list_board_stages", { board_id: 2002 });
      await handleBoardTool("list_board_stages", { board_id: 2002, force_refresh: true });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("unknown tool", () => {
    it("throws for unknown tool name", async () => {
      await expect(
        handleBoardTool("nonexistent_tool", {}),
      ).rejects.toThrow("Unknown board tool: nonexistent_tool");
    });
  });
});
