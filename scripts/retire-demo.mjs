// Explicit one-time conversion of the original, identified fictional workspace.
// A verified private snapshot (rows plus migration SQL) is required before removal.
import { PrismaClient } from "@prisma/client";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");
const backupOnly = process.argv.includes("--backup-only");
try {
  const tables = (await db.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`)).map((r) => r.tablename);
  const readState = async (tx) => {
    const parts = tables.map((name) => `'${name}',(SELECT coalesce(json_agg(json_build_object('row',row_to_json(t)) ORDER BY id),'[]'::json) FROM "${name}" t)`);
    for(let attempt=0;attempt<3;attempt++) {
      try { return (await tx.$queryRawUnsafe(`SELECT json_build_object(${parts.join(",")}) AS snapshot`))[0].snapshot; }
      catch(e) { if (attempt === 2 || !["P1017","P1001","P2024"].includes(e.code)) throw e; await new Promise(resolve=>setTimeout(resolve,1000)); }
    }
  };
  const hash = (s) => createHash("sha256").update(s).digest("hex");
  const state = await readState(db);
  const counts = Object.fromEntries(Object.entries(state).map(([k,v]) => [k,v.length]));
  const users = state.User.map((r) => r.row);
  const demo = users.filter((u) => /^\w+@demo\.psits\.test$/.test(u.email));
  console.log(JSON.stringify({ host: new URL(process.env.DATABASE_URL).hostname, counts, demoAccounts: demo.length, otherAccounts: users.length-demo.length }));
  if (!apply && !backupOnly) process.exitCode = 0;
  else {
    if (!users.length) throw new Error("Workspace already has no accounts. Nothing to retire.");
    if (users.length !== demo.length || !state.College.some((r) => r.row.name === "College of Computing · Fictional Demo") || !state.AuditEvent.some((r) => r.row.action === "DEMO_SEED"))
      throw new Error("This is not the original all-fictional workspace. No data was removed.");
    const allowed = {
      ThesisGroup: Array.from({length:12},(_,i)=>`group-${i+1}`),
      Program: ["bsit","bscs"], Section: ["bsit-4a","bscs-4a"],
      Term: ["term-2026"], Stage: ["title","proposal","final"], Room: ["room-1","room-2","room-3"],
    };
    for (const [table, ids] of Object.entries(allowed))
      if (state[table].some((r) => !ids.includes(r.row.id))) throw new Error(`Unrecognized ${table} records found. No data was removed.`);
    const dir = resolve("tmp/private-backups"); await mkdir(dir, {recursive:true});
    const stamp = new Date().toISOString().replace(/[:.]/g,"-");
    const connection = new URL(process.env.DATABASE_URL);
    const file = resolve(dir, `retired-demo-${connection.hostname.split(".")[0]}-${stamp}.json`);
    const migrations = {};
    for (const name of await readdir("prisma/migrations")) {
      if (name.startsWith("20")) migrations[name] = await readFile(resolve("prisma/migrations",name,"migration.sql"),"utf8");
    }
    const appliedMigrations = (await db.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name')).map((r)=>r.migration_name);
    const snapshot = { appliedMigrations, format:"scheduler-private-snapshot-v1", createdAt:new Date().toISOString(), databaseHost:connection.hostname, counts, tables:state, migrations };
    const buffer = Buffer.from(JSON.stringify(snapshot,null,2));
    await writeFile(file,buffer,{flag:"wx"});
    const saved = await readFile(file);
    if(hash(saved) !== hash(buffer) || JSON.stringify(JSON.parse(saved).tables) !== JSON.stringify(state)) throw new Error("Snapshot verification failed. No records were removed.");
    if (backupOnly) {
      await writeFile(file+".manifest.json", JSON.stringify({ createdAt:new Date().toISOString(), sha256:hash(buffer), bytes:buffer.length, countsBefore:counts, databaseHost:connection.hostname, status:"backup-only" },null,2));
      console.log(JSON.stringify({result:"BACKUP_VERIFIED",backup:file,bytes:buffer.length,sha256:hash(buffer)}));
      await db.$disconnect();
      process.exit(0);
    }
    const fingerprint = hash(JSON.stringify(state));
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(724501)");
      await tx.$executeRawUnsafe(`LOCK TABLE ${tables.map((t)=>`"${t}"`).join(",")} IN ACCESS EXCLUSIVE MODE`);
      if (hash(JSON.stringify(await readState(tx))) !== fingerprint) throw new Error("Records changed during backup. No data was removed. Run again.");
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t)=>`"${t}"`).join(",")}`);
    }, {timeout:60000});
    const after = await readState(db);
    if (Object.values(after).some((rows)=>rows.length)) throw new Error("Post-conversion verification failed.");
    await writeFile(file+".manifest.json", JSON.stringify({ createdAt:new Date().toISOString(), sha256:hash(buffer), bytes:buffer.length, countsBefore:counts, countsAfter:Object.fromEntries(tables.map((t)=>[t,0])), databaseHost:connection.hostname }, null,2));
    console.log(JSON.stringify({ result:"PASS", backup:file, bytes:buffer.length, sha256:hash(buffer), remainingAccounts:0 }));
  }
} finally { await db.$disconnect(); }
