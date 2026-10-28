import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

// A dedicated local cluster: never load or reuse the application's DATABASE_URL.
const dir = resolve("tmp", `class-timetable-test-${Date.now()}`);
if (!dir.startsWith(resolve("tmp") + "\\") && !dir.startsWith(resolve("tmp") + "/")) throw new Error("Test cluster must be inside tmp.");
await mkdir(dir, { recursive: true });
const port = 55482;
const password = randomBytes(24).toString("hex");
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "timetable_test", password, port, persistent: true, postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {} });
const env = { ...process.env, DATABASE_URL: `postgresql://timetable_test:${password}@127.0.0.1:${port}/class_timetable_test`,
  NODE_OPTIONS: [process.env.NODE_OPTIONS ?? "", "--preserve-symlinks", "--preserve-symlinks-main"].join(" "),
  ALLOW_TEST_FIXTURES: "1", VERIFY_PDF_OUTPUT_DIR: resolve(dir, "reports"), DEMO_PASSWORD: "Timetable-test-only-2026!", BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), BETTER_AUTH_URL: "http://localhost:3108",
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
};
let runningChild;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true; runningChild?.kill(); await pg.stop(); process.exit(0);
}
process.on("SIGINT", stop); process.on("SIGTERM", stop);
function run(args) {
  return new Promise((ok, fail) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" }); runningChild = child;
    child.on("error", fail); child.on("exit", (code) => { runningChild = undefined; code === 0 || stopping ? ok() : fail(new Error(`Test command failed (${code}).`)); });
  });
}
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase("class_timetable_test");
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  await run(["--import", "tsx", "tests/fixtures/seed.ts"]);
  await run(["--import", "tsx", "scripts/verify-workflow.ts"]);
  await run(["--import", "tsx", "scripts/verify-class-timetables.ts"]);
  if (process.argv.includes("--serve")) {
    console.log("Isolated fictional timetable app: http://localhost:3108 (Ctrl+C to stop).");
    // Serve the production build to avoid a live compiler alongside browser checks.
    // Run npm run build first.
    await run(["node_modules/next/dist/bin/next", "start", "--port", "3108", "--hostname", "127.0.0.1"]);
  }
} finally { await pg.stop(); }
