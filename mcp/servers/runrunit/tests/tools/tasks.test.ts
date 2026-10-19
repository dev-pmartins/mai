import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RunrunitTask } from "../../src/client.js";

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

const { simplifyTask, handleTaskTool } = await import(
  "../../src/tools/tasks.js"
);
const { runrunitFetch } = await import("../../src/client.js");
const mockFetch = vi.mocked(runrunitFetch);

// ─── simplifyTask ─────────────────────────────────────────────────────────────

describe("simplifyTask", () => {
  const fullTask: RunrunitTask = {
    id: 42,
    title: "Fix the bug",
    description: "Detailed description",
    task_status_name: "In Progress",
    board_stage_name: "Doing",
    state: "opened",
    responsible_name: "Mario",
    project_name: "Acme Backend",
    team_name: "Engineering",
    overdue: "on_schedule",
    created_at: "2024-01-01T00:00:00Z",
    estimated_delivery_date: "2024-01-15",
    time_worked: 7200,
    time_total: 14400,
    priority: 1,
    is_closed: false,
  };

  it("maps all expected fields", () => {
    const result = simplifyTask(fullTask);
    expect(result.id).toBe(42);
    expect(result.title).toBe("Fix the bug");
    expect(result.description).toBe("Detailed description");
    expect(result.status).toBe("In Progress");
    expect(result.responsible).toBe("Mario");
    expect(result.project).toBe("Acme Backend");
    expect(result.team).toBe("Engineering");
    expect(result.overdue).toBe("On schedule");
    expect(result.created_at).toBe("2024-01-01T00:00:00Z");
    expect(result.estimated_delivery).toBe("2024-01-15");
    expect(result.time_worked).toBe("2.00h");
    expect(result.time_total).toBe("4.00h");
    expect(result.priority).toBe(1);
    expect(result.is_closed).toBe(false);
    expect(result.link).toBe("https://runrun.it/pt-BR/tasks/42");
  });

  it("uses board_stage_name when task_status_name is absent", () => {
    const task = { ...fullTask, task_status_name: undefined };
    expect(simplifyTask(task).status).toBe("Doing");
  });

  it("uses state when task_status_name and board_stage_name are absent", () => {
    const task = {
      ...fullTask,
      task_status_name: undefined,
      board_stage_name: undefined,
    };
    expect(simplifyTask(task).status).toBe("opened");
  });

  it("defaults description to 'No description' when absent", () => {
    const task = { ...fullTask, description: undefined };
    expect(simplifyTask(task).description).toBe("No description");
  });

  it("defaults project to 'No project' when absent", () => {
    const task = { ...fullTask, project_name: undefined };
    expect(simplifyTask(task).project).toBe("No project");
  });

  it("preserves non-on_schedule overdue value as-is", () => {
    const task = { ...fullTask, overdue: "overdue" };
    expect(simplifyTask(task).overdue).toBe("overdue");
  });

  it("converts time from seconds to hours string", () => {
    const task = { ...fullTask, time_worked: 3600, time_total: 18000 };
    expect(simplifyTask(task).time_worked).toBe("1.00h");
    expect(simplifyTask(task).time_total).toBe("5.00h");
  });

  it("handles zero time values", () => {
    const task = { ...fullTask, time_worked: 0, time_total: 0 };
    expect(simplifyTask(task).time_worked).toBe("0.00h");
    expect(simplifyTask(task).time_total).toBe("0.00h");
  });

  it("includes parent_task_id and subtask_ids when present", () => {
    const task = { ...fullTask, parent_task_id: 10, subtask_ids: [43, 44] };
    const result = simplifyTask(task);
    expect(result.parent_task_id).toBe(10);
    expect(result.subtask_ids).toEqual([43, 44]);
  });

  it("leaves parent_task_id and subtask_ids undefined when absent", () => {
    const result = simplifyTask(fullTask);
    expect(result.parent_task_id).toBeUndefined();
    expect(result.subtask_ids).toBeUndefined();
  });

  it("surfaces board_id, board_stage_id, type_id and custom_fields when present", () => {
    const task = {
      ...fullTask,
      board_id: 2002,
      board_stage_id: 2632667,
      type_id: 2093858,
      custom_fields: { custom_350: { id: "411262", label: "Tecnologia" } },
    };
    const result = simplifyTask(task);
    expect(result.board_id).toBe(2002);
    expect(result.board_stage_id).toBe(2632667);
    expect(result.type_id).toBe(2093858);
    expect(result.custom_fields).toEqual({
      custom_350: { id: "411262", label: "Tecnologia" },
    });
  });
});

// ─── handleTaskTool ───────────────────────────────────────────────────────────

describe("handleTaskTool", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("get_task", () => {
    it("returns simplified task merging description", async () => {
      const task: RunrunitTask = {
        id: 1,
        title: "My Task",
        time_worked: 0,
        time_total: 0,
      };
      const desc = { description: "Full description from separate endpoint" };

      mockFetch
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(desc);

      const result = await handleTaskTool("get_task", { id: 1 });
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed.id).toBe(1);
      expect(parsed.description).toBe("Full description from separate endpoint");
    });

    it("throws when fetch fails (caller wraps in isError)", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      // handleTaskTool propagates the error — index.ts wraps it in isError: true
      await expect(handleTaskTool("get_task", { id: 999 })).rejects.toThrow(
        "Network error",
      );
    });

    it("throws when id is missing", async () => {
      await expect(handleTaskTool("get_task", {})).rejects.toThrow(
        "Task ID is required",
      );
    });
  });

  describe("get_task_details", () => {
    it("returns raw API response", async () => {
      const rawTask = { id: 5, title: "Raw", custom_field: "value" };
      mockFetch.mockResolvedValueOnce(rawTask);

      const result = await handleTaskTool("get_task_details", { id: 5 });
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed.custom_field).toBe("value");
    });

    it("throws when id is missing", async () => {
      await expect(handleTaskTool("get_task_details", {})).rejects.toThrow(
        "Task ID is required",
      );
    });
  });

  describe("list_tasks", () => {
    it("returns list of simplified tasks", async () => {
      const tasks: RunrunitTask[] = [
        { id: 1, title: "Task A", time_worked: 0, time_total: 0 },
        { id: 2, title: "Task B", time_worked: 3600, time_total: 7200 },
      ];
      mockFetch.mockResolvedValueOnce(tasks);

      const result = await handleTaskTool("list_tasks", { limit: 2 });
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      ) as Array<{ id: number }>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.id).toBe(1);
    });

    it("builds correct URLSearchParams from args", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleTaskTool("list_tasks", {
        responsible_id: "123",
        is_closed: false,
        limit: 10,
      });

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).toContain("responsible_id=123");
      expect(endpoint).toContain("limit=10");
    });

    it("returns empty array when API returns null", async () => {
      mockFetch.mockResolvedValueOnce(null);

      const result = await handleTaskTool("list_tasks", {});
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed).toEqual([]);
    });
  });

  describe("create_task", () => {
    it("sends POST with correct body", async () => {
      const createdTask: RunrunitTask = {
        id: 99,
        title: "New Task",
        time_worked: 0,
        time_total: 0,
        project_id: 100,
        responsible_id: "ana-souza",
      };
      mockFetch.mockResolvedValueOnce(createdTask);

      const result = await handleTaskTool("create_task", {
        title: "New Task",
        project_id: 100,
        responsible_id: "ana-souza",
      });

      const [endpoint, options] = mockFetch.mock.calls[0]!;
      expect(endpoint).toBe("/tasks");
      expect((options as RequestInit).method).toBe("POST");
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.task.title).toBe("New Task");
      expect(body.task.project_id).toBe(100);
      expect(body.task.responsible_id).toBe("ana-souza");

      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed.id).toBe(99);
    });



    it("throws when title is missing", async () => {
      await expect(
        handleTaskTool("create_task", { project_id: 1 }),
      ).rejects.toThrow("Task title is required");
    });

    it("throws when project_id is missing", async () => {
      await expect(
        handleTaskTool("create_task", { title: "Test" }),
      ).rejects.toThrow("project_id is required");
    });

    it("passes parent_task_id through to create a real subtask", async () => {
      const subtask: RunrunitTask = {
        id: 101,
        title: "Subtask",
        time_worked: 0,
        time_total: 0,
        project_id: 100,
        parent_task_id: 42,
      };
      mockFetch.mockResolvedValueOnce(subtask);

      const result = await handleTaskTool("create_task", {
        title: "Subtask",
        project_id: 100,
        parent_task_id: 42,
      });

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.task.parent_task_id).toBe(42);

      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed.parent_task_id).toBe(42);
    });

    it("passes board_stage_id, type_id and custom_fields through to the API", async () => {
      const createdTask: RunrunitTask = {
        id: 102,
        title: "New Task",
        time_worked: 0,
        time_total: 0,
        project_id: 100,
        board_stage_id: 2632667,
        type_id: 2093858,
      };
      mockFetch.mockResolvedValueOnce(createdTask);

      await handleTaskTool("create_task", {
        title: "New Task",
        project_id: 100,
        board_stage_id: 2632667,
        type_id: 2093858,
        custom_fields: { custom_350: { id: "411262", label: "Tecnologia" } },
      });

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.task.board_stage_id).toBe(2632667);
      expect(body.task.type_id).toBe(2093858);
      expect(body.task.custom_fields).toEqual({
        custom_350: { id: "411262", label: "Tecnologia" },
      });
    });
  });

  describe("update_task", () => {
    it("sends PUT to correct endpoint with body", async () => {
      const updatedTask: RunrunitTask = {
        id: 42,
        title: "Updated Title",
        time_worked: 0,
        time_total: 0,
        is_closed: true,
      };
      mockFetch.mockResolvedValueOnce(updatedTask);

      await handleTaskTool("update_task", {
        id: 42,
        title: "Updated Title",
        is_closed: true,
      });

      const [endpoint, options] = mockFetch.mock.calls[0]!;
      expect(endpoint).toBe("/tasks/42");
      expect((options as RequestInit).method).toBe("PUT");
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.task.title).toBe("Updated Title");
      expect(body.task.is_closed).toBe(true);
    });

    it("does not include undefined fields in body", async () => {
      mockFetch.mockResolvedValueOnce({
        id: 1, title: "T", time_worked: 0, time_total: 0,
      } as RunrunitTask);

      await handleTaskTool("update_task", { id: 1, is_urgent: true });

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.task).toEqual({ is_urgent: true });
    });



    it("throws when id is missing", async () => {
      await expect(handleTaskTool("update_task", {})).rejects.toThrow(
        "Task ID is required",
      );
    });

    it("passes custom_fields through to the API", async () => {
      mockFetch.mockResolvedValueOnce({
        id: 1, title: "T", time_worked: 0, time_total: 0,
      } as RunrunitTask);

      await handleTaskTool("update_task", {
        id: 1,
        custom_fields: { custom_350: { id: "411262", label: "Tecnologia" } },
      });

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.task.custom_fields).toEqual({
        custom_350: { id: "411262", label: "Tecnologia" },
      });
    });

    it("passes type_id through to the API", async () => {
      mockFetch.mockResolvedValueOnce({
        id: 1, title: "T", time_worked: 0, time_total: 0,
      } as RunrunitTask);

      await handleTaskTool("update_task", { id: 1, type_id: 2093858 });

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.task.type_id).toBe(2093858);
    });
  });

  describe("get_task_description", () => {
    it("returns task description data", async () => {
      const mockDesc = { body: "This is a description", user: { name: "Mario" } };
      mockFetch.mockResolvedValueOnce(mockDesc);

      const result = await handleTaskTool("get_task_description", { task_id: 123 });

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).toBe("/tasks/123/description");

      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed.body).toBe("This is a description");
    });

    it("throws when task_id is missing", async () => {
      await expect(handleTaskTool("get_task_description", {})).rejects.toThrow(
        "Task ID is required",
      );
    });
  });

  describe("update_task_description", () => {
    it("sends PUT to correct endpoint with body", async () => {
      const updatedDesc = { description: "Updated desc body" };
      mockFetch.mockResolvedValueOnce(updatedDesc);

      const result = await handleTaskTool("update_task_description", {
        task_id: 123,
        body: "Updated desc body",
      });

      const [endpoint, options] = mockFetch.mock.calls[0]!;
      expect(endpoint).toBe("/tasks/123/description");
      expect((options as RequestInit).method).toBe("PUT");
      const requestBody = JSON.parse((options as RequestInit).body as string);
      // The Runrun.it API expects description as a flat string, not { body }
      // (the API docs incorrectly document description[body] as the shape).
      expect(requestBody.description).toBe("Updated desc body");

      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      );
      expect(parsed.description).toBe("Updated desc body");
    });

    it("throws when task_id is missing", async () => {
      await expect(
        handleTaskTool("update_task_description", { body: "desc" }),
      ).rejects.toThrow("Task ID is required");
    });

    it("throws when body is missing", async () => {
      await expect(
        handleTaskTool("update_task_description", { task_id: 1 }),
      ).rejects.toThrow("Description body is required");
    });
  });

  describe("list_tasks with new filters", () => {
    it("includes team_id, sort_by and page in URLSearchParams", async () => {
      mockFetch.mockResolvedValueOnce([]);

      await handleTaskTool("list_tasks", {
        team_id: 481379,
        sort_by: "created_at",
        page: 2,
      });

      const [endpoint] = mockFetch.mock.calls[0]!;
      expect(endpoint).toContain("team_id=481379");
      expect(endpoint).toContain("sort_by=created_at");
      expect(endpoint).toContain("page=2");
    });

  });

  // The real Runrun.it API silently ignores GET /tasks?parent_task_id=X (it returns
  // unrelated tasks, not the task's actual descendants), despite being documented.
  // list_tasks works around this by walking subtask_ids instead — see below.
  describe("list_tasks with parent_task_id (descendant walk workaround)", () => {
    it("walks the subtask_ids tree instead of relying on the API filter", async () => {
      const root: RunrunitTask = {
        id: 1, title: "Root", time_worked: 0, time_total: 0, subtask_ids: [2, 3],
      };
      const child2: RunrunitTask = {
        id: 2, title: "Child 2", time_worked: 0, time_total: 0, subtask_ids: [4],
      };
      const child3: RunrunitTask = { id: 3, title: "Child 3", time_worked: 0, time_total: 0 };
      const grandchild4: RunrunitTask = { id: 4, title: "Grandchild 4", time_worked: 0, time_total: 0 };

      mockFetch
        .mockResolvedValueOnce(root)
        .mockResolvedValueOnce(child2)
        .mockResolvedValueOnce(child3)
        .mockResolvedValueOnce(grandchild4);

      const result = await handleTaskTool("list_tasks", { parent_task_id: 1 });

      expect(mockFetch.mock.calls.map((call) => call[0])).toEqual([
        "/tasks/1", "/tasks/2", "/tasks/3", "/tasks/4",
      ]);

      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      ) as Array<{ id: number }>;
      expect(parsed.map((t) => t.id).sort()).toEqual([2, 3, 4]);
    });

    it("applies other filters client-side against the resolved descendants", async () => {
      const root: RunrunitTask = {
        id: 1, title: "Root", time_worked: 0, time_total: 0, subtask_ids: [2, 3],
      };
      const child2: RunrunitTask = {
        id: 2, title: "Child 2", time_worked: 0, time_total: 0, board_stage_id: 100,
      };
      const child3: RunrunitTask = {
        id: 3, title: "Child 3", time_worked: 0, time_total: 0, board_stage_id: 200,
      };

      mockFetch
        .mockResolvedValueOnce(root)
        .mockResolvedValueOnce(child2)
        .mockResolvedValueOnce(child3);

      const result = await handleTaskTool("list_tasks", {
        parent_task_id: 1,
        board_stage_id: 100,
      });

      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      ) as Array<{ id: number }>;
      expect(parsed.map((t) => t.id)).toEqual([2]);
    });

    it("does not revisit a task reachable through more than one branch", async () => {
      const root: RunrunitTask = {
        id: 1, title: "Root", time_worked: 0, time_total: 0, subtask_ids: [2, 3],
      };
      const child2: RunrunitTask = {
        id: 2, title: "Child 2", time_worked: 0, time_total: 0, subtask_ids: [4],
      };
      const child3: RunrunitTask = {
        id: 3, title: "Child 3", time_worked: 0, time_total: 0, subtask_ids: [4],
      };
      const grandchild4: RunrunitTask = { id: 4, title: "Grandchild 4", time_worked: 0, time_total: 0 };

      mockFetch
        .mockResolvedValueOnce(root)
        .mockResolvedValueOnce(child2)
        .mockResolvedValueOnce(child3)
        .mockResolvedValueOnce(grandchild4);

      const result = await handleTaskTool("list_tasks", { parent_task_id: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(4);
      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      ) as Array<{ id: number }>;
      expect(parsed.map((t) => t.id).sort()).toEqual([2, 3, 4]);
    });

    it("respects limit after client-side filtering", async () => {
      const root: RunrunitTask = {
        id: 1, title: "Root", time_worked: 0, time_total: 0, subtask_ids: [2, 3],
      };
      const child2: RunrunitTask = { id: 2, title: "Child 2", time_worked: 0, time_total: 0 };
      const child3: RunrunitTask = { id: 3, title: "Child 3", time_worked: 0, time_total: 0 };

      mockFetch
        .mockResolvedValueOnce(root)
        .mockResolvedValueOnce(child2)
        .mockResolvedValueOnce(child3);

      const result = await handleTaskTool("list_tasks", { parent_task_id: 1, limit: 1 });

      const parsed = JSON.parse(
        (result.content[0] as { type: string; text: string }).text,
      ) as Array<{ id: number }>;
      expect(parsed).toHaveLength(1);
    });
  });

  describe("unknown tool", () => {
    it("throws for unknown tool name", async () => {
      await expect(handleTaskTool("nonexistent_tool", {})).rejects.toThrow(
        "Unknown task tool: nonexistent_tool",
      );
    });
  });
});
