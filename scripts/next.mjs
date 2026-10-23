import { spawn } from "node:child_process";
import { resolve } from "node:path";
// This also supports a node_modules junction on a different Windows drive.
const child = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS ?? "",
        "--preserve-symlinks",
        "--preserve-symlinks-main",
      ].join(" "),
    },
  },
);
child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
