import { createEnv } from "@t3-oss/env-core";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { z } from "zod";

// Anchored to this file's own location, not process.cwd() — Claude Code
// launches this as a subprocess from an arbitrary working directory, so the
// default dotenv/config (which reads cwd()/.env) would silently miss it.
// Both src/env.ts and the compiled build/env.js sit at the same depth under
// mcp/servers/runrunit/, so the same four "up" levels reach the mai repo root
// in dev and in the build.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", "..", "..", "..", ".env") });

export const env = createEnv({
  server: {
    RUNRUNIT_APP_KEY: z
      .string()
      .min(1)
      .transform((v) => v.trim()),
    RUNRUNIT_USER_TOKEN: z
      .string()
      .min(1)
      .transform((v) => v.trim()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
