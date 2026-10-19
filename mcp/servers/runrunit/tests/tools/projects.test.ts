import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { RunrunitProject } from "../../src/client.js";

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

const { simplifyProject, handleProjectTool } = await import(
  "../../src/tools/projects.js"
);
const { runrunitFetch } = await import("../../src/client.js");
const mockFetch = vi.mocked(runrunitFetch);

// ─── simplifyProject ──────────────────────────────────────────────────────────

describe("simplifyProject", () => {
  it("maps all expected fields", () => {
    const project: RunrunitProject = {
      id: 10,
      name: "[TI] Projeto Beta",
      client_name: "[TI]",
    };
    const result = simplifyProject(project);
    expect(result.id).toBe(10);
    expect(result.name).toBe("[TI] Projeto Beta");
    expect(result.client_name).toBe("[TI]");
  });

  it("defaults client_name to 'Sem cliente' when absent", () => {
    const project: RunrunitProject = { id: 1, name: "Projeto Interno" };
    expect(simplifyProject(project).client_name).toBe("Sem cliente");
  });

  it("surfaces board_id and type_id when present", () => {
    const project: RunrunitProject = {
      id: 1,
      name: "Projeto",
      board_id: 2002,
      type_id: 2093858,
    };
    const result = simplifyProject(project);
    expect(result.board_id).toBe(2002);
    expect(result.type_id).toBe(2093858);
  });

  it("leaves board_id and type_id undefined when absent", () => {
    const project: RunrunitProject = { id: 1, name: "Projeto" };
    const result = simplifyProject(project);
    expect(result.board_id).toBeUndefined();
    expect(result.type_id).toBeUndefined();
  });
});

// ─── handleProjectTool ────────────────────────────────────────────────────────

describe("handleProjectTool", () => {
  // list_projects is disk-cached (reference data) — isolate each test behind
  // its own fresh cache dir, otherwise the second {}-args test to run would
  // get the first test's cached result instead of calling the mocked fetch.
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

  describe("list_projects", () => {
    it("returns list of simplified projects", async () => {
      const projects: RunrunitProject[] = [
        { id: 1, name: "Project A", client_name: "Client A" },
        { id: 2, name: "Project B" },
      ];
      mockFetch.mockResolvedValueOnce(projects);

      const result = await handleProjectTool("list_projects", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      ) as Array<{ id: number; name: string; client_name: string }>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.id).toBe(1);
      expect(parsed[1]?.client_name).toBe("Sem cliente");
    });

    it("passes limit and page as query params", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleProjectTool("list_projects", { limit: 20, page: 2 });

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).toContain("limit=20");
      expect(endpoint).toContain("page=2");
    });

    it("calls /projects endpoint", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleProjectTool("list_projects", {});

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).toMatch(/^\/projects/);
    });

    it("returns empty array when API returns null", async () => {
      mockFetch.mockResolvedValueOnce(null);

      const result = await handleProjectTool("list_projects", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed).toEqual([]);
    });

    it("serves the second identical call from cache without refetching", async () => {
      mockFetch.mockResolvedValueOnce([{ id: 1, name: "Cached Project" }]);

      const first = await handleProjectTool("list_projects", { page: 1 });
      const second = await handleProjectTool("list_projects", { page: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
    });

    it("force_refresh bypasses the cache and refetches", async () => {
      mockFetch
        .mockResolvedValueOnce([{ id: 1, name: "First" }])
        .mockResolvedValueOnce([{ id: 2, name: "Second" }]);

      await handleProjectTool("list_projects", { page: 1 });
      await handleProjectTool("list_projects", { page: 1, force_refresh: true });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not send force_refresh as a query param", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleProjectTool("list_projects", { force_refresh: true });

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).not.toContain("force_refresh");
    });
  });

  describe("get_preferred_project", () => {
    it("returns null when nothing is set", async () => {
      const result = await handleProjectTool("get_preferred_project", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed).toBeNull();
    });

    it("returns the previously set preferred project", async () => {
      await handleProjectTool("set_preferred_project", {
        project_id: 1001001,
        project_name: "[TI] Projeto Alfa",
      });

      const result = await handleProjectTool("get_preferred_project", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed.id).toBe(1001001);
      expect(parsed.name).toBe("[TI] Projeto Alfa");
    });
  });

  describe("set_preferred_project", () => {
    it("throws when project_id or project_name is missing", async () => {
      await expect(
        handleProjectTool("set_preferred_project", { project_id: 1 }),
      ).rejects.toThrow("set_preferred_project requires");
    });

    it("pins a board alongside the project when both are given", async () => {
      const result = await handleProjectTool("set_preferred_project", {
        project_id: 1001001,
        project_name: "[TI] Projeto Alfa",
        board_id: 2002,
        board_name: "[TI] Board Alfa",
      });
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed.boardId).toBe(2002);
      expect(parsed.boardName).toBe("[TI] Board Alfa");
    });

    it("throws when only board_id or board_name is given", async () => {
      await expect(
        handleProjectTool("set_preferred_project", {
          project_id: 1,
          project_name: "Project",
          board_id: 2002,
        }),
      ).rejects.toThrow("both board_id");
    });
  });

  describe("clear_preferred_project", () => {
    it("unsets a previously set preferred project", async () => {
      await handleProjectTool("set_preferred_project", {
        project_id: 1,
        project_name: "Project",
      });

      await handleProjectTool("clear_preferred_project", {});

      const result = await handleProjectTool("get_preferred_project", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed).toBeNull();
    });
  });

  describe("unknown tool", () => {
    it("throws for unknown tool name", async () => {
      await expect(
        handleProjectTool("nonexistent_tool", {}),
      ).rejects.toThrow("Unknown project tool: nonexistent_tool");
    });
  });
});
