import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("../src/env.js", () => ({
  env: { RUNRUNIT_APP_KEY: "app-key-a", RUNRUNIT_USER_TOKEN: "token-a" },
}));

const { getPreferredProject, setPreferredProject, clearPreferredProject } =
  await import("../src/preferences.js");
const { env } = await import("../src/env.js");

describe("preferences", () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-preferences-test-"));
    process.env["RUNRUNIT_CACHE_DIR"] = cacheDir;
    env.RUNRUNIT_APP_KEY = "app-key-a";
    env.RUNRUNIT_USER_TOKEN = "token-a";
  });

  afterEach(() => {
    delete process.env["RUNRUNIT_CACHE_DIR"];
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("returns null when nothing has been set", async () => {
    expect(await getPreferredProject()).toBeNull();
  });

  it("persists and returns the preferred project", async () => {
    await setPreferredProject(1001001, "[TI] Projeto Alfa");

    const result = await getPreferredProject();
    expect(result?.id).toBe(1001001);
    expect(result?.name).toBe("[TI] Projeto Alfa");
    expect(result?.setAt).toBeTypeOf("number");
  });

  it("overwrites a previously set preferred project", async () => {
    await setPreferredProject(1, "Old Project");
    await setPreferredProject(2, "New Project");

    const result = await getPreferredProject();
    expect(result?.id).toBe(2);
    expect(result?.name).toBe("New Project");
  });

  it("pins a board alongside the preferred project", async () => {
    await setPreferredProject(1001001, "[TI] Projeto Alfa", {
      id: 2002,
      name: "[TI] Board Alfa",
    });

    const result = await getPreferredProject();
    expect(result?.boardId).toBe(2002);
    expect(result?.boardName).toBe("[TI] Board Alfa");
  });

  it("carries the pinned board forward when re-pinning the same project without one", async () => {
    await setPreferredProject(1001001, "[TI] Projeto Alfa", {
      id: 2002,
      name: "[TI] Board Alfa",
    });
    await setPreferredProject(1001001, "[TI] Projeto Alfa");

    const result = await getPreferredProject();
    expect(result?.boardId).toBe(2002);
    expect(result?.boardName).toBe("[TI] Board Alfa");
  });

  it("drops the pinned board when pinning a different project", async () => {
    await setPreferredProject(1001001, "[TI] Projeto Alfa", {
      id: 2002,
      name: "[TI] Board Alfa",
    });
    await setPreferredProject(999, "Other Project");

    const result = await getPreferredProject();
    expect(result?.boardId).toBeUndefined();
    expect(result?.boardName).toBeUndefined();
  });

  it("clears the preferred project", async () => {
    await setPreferredProject(1, "Project");
    await clearPreferredProject();

    expect(await getPreferredProject()).toBeNull();
  });

  it("does not throw when clearing with nothing set", async () => {
    await expect(clearPreferredProject()).resolves.not.toThrow();
  });

  it("namespaces by User-Token so different users keep separate preferences", async () => {
    await setPreferredProject(1, "User A's project");

    env.RUNRUNIT_USER_TOKEN = "token-b";
    expect(await getPreferredProject()).toBeNull();

    await setPreferredProject(2, "User B's project");
    expect((await getPreferredProject())?.id).toBe(2);

    env.RUNRUNIT_USER_TOKEN = "token-a";
    expect((await getPreferredProject())?.id).toBe(1);
  });

  it("namespaces by App-Key so switching accounts can't leak the preference", async () => {
    await setPreferredProject(1, "Account A's project");

    env.RUNRUNIT_APP_KEY = "app-key-b";
    expect(await getPreferredProject()).toBeNull();
  });
});
