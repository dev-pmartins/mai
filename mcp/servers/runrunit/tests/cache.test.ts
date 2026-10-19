import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("../src/env.js", () => ({
  env: { RUNRUNIT_APP_KEY: "app-key-a", RUNRUNIT_USER_TOKEN: "token" },
}));

const { withCache, getCacheFilePath, ONE_HOUR_MS } = await import(
  "../src/cache.js"
);
const { env } = await import("../src/env.js");

describe("cache", () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-cache-test-"));
    process.env["RUNRUNIT_CACHE_DIR"] = cacheDir;
    env.RUNRUNIT_APP_KEY = "app-key-a";
  });

  afterEach(() => {
    delete process.env["RUNRUNIT_CACHE_DIR"];
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("fetches fresh data on a cache miss and writes a cache file", async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: "fresh" });

    const result = await withCache("some_tool", {}, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ value: "fresh" });
    expect(fs.existsSync(getCacheFilePath("some_tool", {}))).toBe(true);
  });

  it("serves from cache on a second call with the same args", async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: "fresh" });

    await withCache("some_tool", { a: 1 }, fetcher);
    const second = await withCache("some_tool", { a: 1 }, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ value: "fresh" });
  });

  it("treats different args as different cache entries", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ value: "a" })
      .mockResolvedValueOnce({ value: "b" });

    const a = await withCache("some_tool", { filter: "a" }, fetcher);
    const b = await withCache("some_tool", { filter: "b" }, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(a).toEqual({ value: "a" });
    expect(b).toEqual({ value: "b" });
  });

  it("ignores force_refresh when computing the cache key", () => {
    const withFlag = getCacheFilePath("some_tool", { a: 1, force_refresh: true });
    const withoutFlag = getCacheFilePath("some_tool", { a: 1 });
    expect(withFlag).toBe(withoutFlag);
  });

  it("bypasses a valid cache entry when force_refresh is true", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ value: "first" })
      .mockResolvedValueOnce({ value: "second" });

    await withCache("some_tool", { a: 1 }, fetcher);
    const result = await withCache(
      "some_tool",
      { a: 1, force_refresh: true },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ value: "second" });
  });

  it("refetches once the TTL has expired", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ value: "stale" })
      .mockResolvedValueOnce({ value: "renewed" });

    await withCache("some_tool", {}, fetcher, ONE_HOUR_MS);

    // Rewrite the cache file with a cachedAt far in the past to simulate expiry.
    const filePath = getCacheFilePath("some_tool", {});
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        cachedAt: Date.now() - ONE_HOUR_MS - 1000,
        data: { value: "stale" },
      }),
    );

    const result = await withCache("some_tool", {}, fetcher, ONE_HOUR_MS);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ value: "renewed" });
  });

  it("namespaces cache files by App-Key so switching accounts can't leak cached data", async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: "x" });

    await withCache("some_tool", {}, fetcher);
    const pathA = getCacheFilePath("some_tool", {});

    env.RUNRUNIT_APP_KEY = "app-key-b";
    const pathB = getCacheFilePath("some_tool", {});

    expect(pathA).not.toBe(pathB);
    expect(fs.existsSync(pathB)).toBe(false);
  });

  it("treats an unreadable/corrupt cache file as a miss", async () => {
    const filePath = getCacheFilePath("broken_tool", {});
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "not json");

    const fetcher = vi.fn().mockResolvedValue({ value: "recovered" });
    const result = await withCache("broken_tool", {}, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ value: "recovered" });
  });
});
