import {readFile,readdir,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
if (!process.argv.includes('--restore-to-new-local-database')) throw Error('Pass --restore-to-new-local-database; this only creates a separate local scratch database.');
import pg from 'pg';
const names=(await readdir('tmp/private-backups')).filter(n=>n.startsWith('retired-demo-')&&n.endsWith('.json')&&!n.includes('.manifest.'));
const source=process.env.SNAPSHOT_FILE ?? names.filter(n=>n.includes(process.env.BACKUP_HOST??'localhost')).sort().at(-1);
if(!source || !/^retired-demo-[A-Za-z0-9_.-]+\.json$/.test(source))throw Error('Backup not found or invalid name');
const bytes=await readFile('tmp/private-backups/'+source);
const manifest=JSON.parse(await readFile('tmp/private-backups/'+source+'.manifest.json','utf8'));
if(createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('Backup checksum mismatch');
const backup=JSON.parse(bytes);
if(backup.format!=='scheduler-private-snapshot-v1')throw Error('Unknown snapshot format');
if(!Object.keys(backup.tables).every(t=>/^[A-Za-z][A-Za-z0-9_]*$/.test(t)))throw Error('Invalid table names');
const env=parseEnv(await readFile('.env','utf8'));const url=new URL(env.DATABASE_URL);
if(url.hostname!=='localhost')throw Error('Local restore only');const name='thesis_scheduler_test_restore_'+Date.now();
const root=new pg.Client({connectionString:url.href});await root.connect();await root.query('CREATE DATABASE "'+name+'"');await root.end();url.pathname='/'+name;
const client=new pg.Client({connectionString:url.href});await client.connect();
try{
 for(const key of backup.appliedMigrations??[Object.keys(backup.migrations).sort()[0]])await client.query(backup.migrations[key]);
 const foreign=(await client.query(`SELECT child.relname AS child,parent.relname AS parent FROM pg_constraint con JOIN pg_class child ON con.conrelid=child.oid JOIN pg_class parent ON con.confrelid=parent.oid WHERE con.contype='f'`)).rows;
 const pending=new Set(Object.keys(backup.tables)),done=new Set();await client.query('BEGIN');
 while(pending.size){const ready=[...pending].filter(t=>foreign.filter(f=>f.child===t&&f.parent!==t).every(f=>done.has(f.parent)||!pending.has(f.parent)));if(!ready.length)throw Error('Cyclic dependency');
  for(const table of ready){const rows=backup.tables[table].map(r=>r.row);if(rows.length)await client.query('INSERT INTO "'+table+'" SELECT * FROM json_populate_recordset(NULL::"'+table+'",$1::json)',[JSON.stringify(rows)]);done.add(table);pending.delete(table);}
 }
 await client.query('COMMIT');const counts={};for(const t of Object.keys(backup.tables))counts[t]=Number((await client.query('SELECT count(*) FROM "'+t+'"')).rows[0].count);
 for(const [t,count]of Object.entries(backup.counts))if(counts[t]!==count)throw Error('Restore count mismatch '+t);
 await writeFile('tmp/private-backups/'+source+'.restore-check.json',JSON.stringify({result:'PASS',source,database:name,counts},null,2));
 console.log('PASS actual snapshot restore and all table row counts:',source);
}finally{await client.end();}
