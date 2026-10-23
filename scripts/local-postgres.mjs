import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync } from "node:fs";
// Reads the same DATABASE_URL as Prisma; never prints credentials.
process.loadEnvFile(".env");
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Local launcher only supports localhost");
const pg = new EmbeddedPostgres({
  databaseDir: ".postgres",
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 5432),
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: console.error,
});
if (!existsSync(".postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const name = url.pathname.slice(1);
const found = await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [
  name,
]);
if (!found.rowCount) await pg.createDatabase(name);
await client.end();
console.log("Local PostgreSQL ready. Keep this terminal open.");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
