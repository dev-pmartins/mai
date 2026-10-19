import fs from "fs";
import path from "path";
import { cacheBaseDir, shortHash } from "./cache.js";
import { env } from "./env.js";

// Per-user pinned preferences (currently just the preferred project — and,
// within it, that project's preferred board — for `rr plan`). Lives next to
// cache.ts's TTL reference-data cache but never expires — it's an explicit
// user choice, not a fetch cache.
//
// Namespaced by App-Key *and* User-Token: the App-Key identifies the
// Runrun.it account (shared by everyone at the company), but the User-Token
// is per-person, so two teammates on the same account each keep their own
// preferred project instead of overwriting each other's.

function preferencesFilePath(): string {
  const appKeyHash = shortHash(env.RUNRUNIT_APP_KEY);
  const userHash = shortHash(env.RUNRUNIT_USER_TOKEN);
  return path.join(cacheBaseDir(), appKeyHash, "users", userHash, "preferred-project.json");
}

export interface PreferredProject {
  id: number;
  name: string;
  boardId?: number;
  boardName?: string;
  setAt: number;
}

export async function getPreferredProject(): Promise<PreferredProject | null> {
  try {
    const raw = await fs.promises.readFile(preferencesFilePath(), "utf-8");
    return JSON.parse(raw) as PreferredProject;
  } catch {
    return null;
  }
}

export async function setPreferredProject(
  id: number,
  name: string,
  board?: { id: number; name: string },
): Promise<PreferredProject> {
  const existing = await getPreferredProject();
  // A pinned board belongs to the project it was pinned under — carry it
  // forward only when re-pinning the *same* project without a new board;
  // switching to a different project drops the stale board.
  const carriedBoard = existing?.id === id && !board
    ? { id: existing.boardId, name: existing.boardName }
    : {};

  const entry: PreferredProject = {
    id,
    name,
    boardId: board?.id ?? carriedBoard.id,
    boardName: board?.name ?? carriedBoard.name,
    setAt: Date.now(),
  };
  const filePath = preferencesFilePath();
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
  return entry;
}

export async function clearPreferredProject(): Promise<void> {
  try {
    await fs.promises.unlink(preferencesFilePath());
  } catch {
    // Already absent — nothing to clear.
  }
}
