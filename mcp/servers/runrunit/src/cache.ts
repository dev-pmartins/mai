import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.js";

// Disk cache for reference data only (projects, users, teams) — never tasks,
// which change status/time constantly. Anchored to this file's own location
// like env.ts, one level up from src/ or build/, so both dev and build reach
// the same mcp/servers/runrunit/.cache/ directory regardless of Claude
// Code's cwd. process.env.RUNRUNIT_CACHE_DIR overrides it, read fresh on
// every call (not cached at module load) so tests can isolate each run.

export const ONE_HOUR_MS = 60 * 60 * 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function cacheBaseDir(): string {
  return process.env["RUNRUNIT_CACHE_DIR"] ?? path.join(__dirname, "..", ".cache");
}

export function shortHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

// Namespaced by a hash of the App-Key so switching Runrun.it accounts in
// .env can't silently serve another account's cached projects/users.
export function getCacheFilePath(
  toolName: string,
  args: Record<string, unknown> | undefined,
): string {
  const cacheArgs: Record<string, unknown> = { ...args };
  delete cacheArgs["force_refresh"];

  const appKeyHash = shortHash(env.RUNRUNIT_APP_KEY);
  const argsHash = shortHash(stableStringify(cacheArgs));
  return path.join(cacheBaseDir(), appKeyHash, `${toolName}-${argsHash}.json`);
}

interface CacheEntry<T> {
  cachedAt: number;
  data: T;
}

export async function withCache<T>(
  toolName: string,
  args: Record<string, unknown> | undefined,
  fetcher: () => Promise<T>,
  ttlMs: number = ONE_HOUR_MS,
): Promise<T> {
  const forceRefresh = args?.["force_refresh"] === true;
  const filePath = getCacheFilePath(toolName, args);

  if (!forceRefresh) {
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() - entry.cachedAt < ttlMs) {
        return entry.data;
      }
    } catch {
      // Cache miss, or file missing/corrupt — fall through and fetch fresh.
    }
  }

  const data = await fetcher();
  const entry: CacheEntry<T> = { cachedAt: Date.now(), data };
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(entry), "utf-8");
  return data;
}
