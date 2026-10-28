// Optional local sample data only. Never invoked by builds, migrations, or production seeding.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {hashPassword,verifyPassword} from 'better-auth/crypto';
import {db} from '../src/lib/db';
import {mutateClassTimetable,publishedClassTimetables} from '../src/lib/class-timetables';
assert(process.argv.includes('--confirm-local-demo'),'Pass --confirm-local-demo to explicitly create the local sample account and publish its provisional timetable');
const url=new URL(process.env.DATABASE_URL!);
assert(['localhost','127.0.0.1'].includes(url.hostname),'Local database only');
const email='ryan.gonzaga.placeholder@example.invalid';
try {
 assert.equal(await db.user.count({where:{OR:[{email},{name:{equals:'Ryan Gonzaga',mode:'insensitive'}}]}}),0,'Ryan already exists; refusing duplicate');
 const admin=await db.user.findFirstOrThrow({where:{role:'COORDINATOR'},orderBy:{createdAt:'asc'},select:{id:true,name:true,role:true}});
 const password=randomBytes(24).toString('base64url');
 const hash=await hashPassword(password);
 const userId=randomUUID();
 await mkdir('tmp',{recursive:true});
 const user=await db.$transaction(async tx=>{
  const user=await tx.user.create({data:{id:userId,name:'Ryan Gonzaga',email,emailVerified:false,role:'FACULTY',mustChangePassword:true,accounts:{create:{id:randomUUID(),accountId:userId,providerId:'credential',password:hash}},faculty:{create:{}}},include:{faculty:true}});
  await tx.auditEvent.create({data:{actorId:admin.id,action:'LOCAL_PLACEHOLDER_CREATED',details:'User-requested temporary Ryan Gonzaga faculty account. Replace placeholder email before real use; provisional timetable transcribed from supplied image.'}});
  return user;
 });
 await writeFile('tmp/Ryan_Gonzaga_Local_Account_PRIVATE.txt',`LOCAL DEVELOPMENT ONLY\nFaculty: Ryan Gonzaga\nPlaceholder email: ${email}\nTemporary password: ${password}\nReplace placeholder email through coordinator Accounts > Manage and issue a fresh temporary password before real use. Password change and recovery-authenticator enrollment remain required.\n`,{encoding:'utf8',mode:0o600});
 const term=await db.term.upsert({where:{year_semester:{year:'2026-2027 (Provisional)',semester:'Sample timetable - confirm academic term'}},create:{year:'2026-2027 (Provisional)',semester:'Sample timetable - confirm academic term'},update:{}});
 const meetings=[
 [1,'Application Development','11:00','14:00'],[1,'Database Management Systems','14:00','17:00'],
 [2,'Database Management Systems','07:00','08:00'],[2,'Database Management Systems','10:00','11:00'],[2,'Database Management Systems','11:00','14:00'],
 [4,'Database Management Systems','07:00','08:00'],[4,'Database Management Systems','10:00','11:00'],[5,'Application Development','13:00','15:00']
 ].map(([weekday,subjectName,startTime,endTime])=>({weekday:Number(weekday),subjectName:String(subjectName),startTime:String(startTime),endTime:String(endTime),subjectCode:'Unconfirmed code',section:'To be confirmed',location:'To be confirmed'}));
 const {id}=await mutateClassTimetable(admin,'save',{facultyId:user.faculty!.id,termId:term.id,version:0,effectiveFrom:'2026-10-28',effectiveTo:'2026-12-31',meetings});
 await mutateClassTimetable(admin,'submit',{id,version:1});
 await mutateClassTimetable(admin,'publish',{id,version:2});
 const rows=await publishedClassTimetables();
 const row=rows.timetables.find(t=>t.id===id)!;assert(row);assert.equal(row.meetings.length,8);
 const credential=await db.account.findFirstOrThrow({where:{userId:user.id,providerId:'credential'}});
 assert(await verifyPassword({hash:credential.password!,password}));assert.equal(user.mustChangePassword,true);assert.equal(user.twoFactorEnabled,false);
 console.log('PASS Created ordinary editable faculty account with hashed credentials and required first-use security; published 8 provisional local timetable entries.');
 console.log('Credentials saved to ignored private local file; no credentials printed.');
}finally{await db.$disconnect()}
