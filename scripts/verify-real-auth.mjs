import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
const base = process.env.BETTER_AUTH_URL;
assert(new URL(base).hostname === "localhost" && /test/.test(new URL(process.env.DATABASE_URL).pathname), "Use an isolated localhost test database.");
const db = new PrismaClient();
const pass = () => `QA-${randomBytes(18).toString("base64url")}`;
const coordinator = { name: "QA Coordinator", email: "coordinator@scheduler-qa.ac", password: pass() };
function client() {
  const cookies = new Map();
  return {
    cookies,
    async request(path, body, retry = 0) {
      const r = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { Origin: base, "Content-Type": "application/json", Cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join("; ") }, ...(body === undefined ? {} : {body:JSON.stringify(body)}), redirect:"manual" });
      for (const cookie of r.headers.getSetCookie()) {
        const [pair] = cookie.split(";"); const i = pair.indexOf("="); cookies.set(pair.slice(0,i),pair.slice(i+1));
      }
      const type = r.headers.get("content-type") ?? "";
      const data = type.includes("json") ? await r.json() : await r.text();
      if (r.status === 429 && data.code !== "ACCOUNT_TEMPORARILY_LOCKED" && retry < 6) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(60000,Math.max(11000,Number(r.headers.get("retry-after") || 11)*1000))));
        return this.request(path,body,retry+1);
      }
      return { status:r.status, data, headers:r.headers };
    },
  };
}
export function totp(uri) {
  const secret=new URL(uri).searchParams.get("secret"); let bits="";
  for(const c of secret.toUpperCase().replace(/=/g,"")) bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5,"0");
  const key=Buffer.from(bits.match(/.{8}/g).map((b)=>parseInt(b,2)));
  const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const h=createHmac("sha1",key).update(counter).digest(), offset=h[h.length-1]&15;
  return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");
}
const success=(s)=>console.log("PASS "+s);
const mutate = async (c,op,data) => { const r=await c.request("/api/data",{op,data}); assert.equal(r.status,200,JSON.stringify(r.data)); return r.data.result; };
async function enroll(c, password) {
  const e=await c.request("/api/auth/two-factor/enable",{password}); assert.equal(e.status,200,JSON.stringify(e.data));
  assert(e.data.totpURI?.startsWith("otpauth://totp/")); assert.equal(e.data.backupCodes.length,10);
  const bad=await c.request("/api/auth/two-factor/verify-totp",{code:"not-a-code"}); assert.notEqual(bad.status,200);
  const v=await c.request("/api/auth/two-factor/verify-totp",{code:totp(e.data.totpURI)}); assert.equal(v.status,200,JSON.stringify(v.data));
  return e.data;
}
try {
  assert.equal(await db.user.count(),0,"Start with a fresh database; this verifier never resets a database.");
  const anonymous=client(); assert.equal((await anonymous.request("/api/data")).status,401);
  const key=process.env.SETUP_KEY;
  assert.equal((await anonymous.request("/api/setup",{...coordinator,college:"QA College",key:"wrong-key-with-at-least-32-characters"})).status,403);
  assert.equal((await anonymous.request("/api/setup",{...coordinator,email:"fake@example.com",college:"QA College",key})).status,400);
  assert.equal((await anonymous.request("/api/setup",{...coordinator,college:"QA College",key})).status,200);
  assert.equal((await anonymous.request("/api/setup",{...coordinator,college:"QA College",key})).status,400);
  success("private first-coordinator setup, reserved-email rejection, and one-time claim");
  const admin=client(); assert.equal((await admin.request("/api/auth/sign-in/email",coordinator)).status,200);
  assert.equal((await admin.request("/api/data")).data.error,"MFA_SETUP_REQUIRED");
  assert.equal((await admin.request("/api/reports")).status,403);
  const adminFactor=await enroll(admin,coordinator.password);
  assert.equal((await admin.request("/api/data")).status,200);
  const factors=await db.twoFactor.findMany();
  assert(!factors[0].secret.includes(new URL(adminFactor.totpURI).searchParams.get("secret")));
  assert(!factors[0].backupCodes.includes(adminFactor.backupCodes[0]));
  success("MFA enrollment, invalid code rejection, encrypted secrets, and server-side enrollment gate");
  const challenge=client(); const signIn=await challenge.request("/api/auth/sign-in/email",coordinator);
  assert.equal(signIn.data.twoFactorRedirect,true);
  assert.equal((await challenge.request("/api/data")).status,401);
  assert.equal((await challenge.request("/api/reports")).status,401);
  assert.equal((await challenge.request("/api/auth/two-factor/verify-totp",{code:totp(adminFactor.totpURI)})).status,200);
  assert.equal((await challenge.request("/api/data")).status,200);
  success("password-only challenge cannot access application data or reports; TOTP completes sign-in");
  const recovery=client(); await recovery.request("/api/auth/sign-in/email",coordinator);
  assert.equal((await recovery.request("/api/auth/two-factor/verify-backup-code",{code:adminFactor.backupCodes[0]})).status,200);
  const replay=client(); await replay.request("/api/auth/sign-in/email",coordinator);
  assert.notEqual((await replay.request("/api/auth/two-factor/verify-backup-code",{code:adminFactor.backupCodes[0]})).status,200);
  success("recovery codes work once and reused codes are rejected");
  assert.notEqual((await admin.request("/api/data",{op:"user",data:{name:"Rejected",email:"student@demo.psits.test",password:pass(),role:"STUDENT",number:"QA-0"}})).status,200);
  const people=[];
  for (const [role,label] of [["FACULTY","Teacher"],["STUDENT","Student"]]) {
    const temporary=pass(),password=pass(),email=`${role.toLowerCase()}@scheduler-qa.ac`;
    const person=await mutate(admin,"user",{name:`QA ${label}`,email,password:temporary,role,...(role==="STUDENT"?{number:"QA-001"}:{})});
    const c=client(); const initial=await c.request("/api/auth/sign-in/email",{email,password:temporary}); assert.equal(initial.status,200,JSON.stringify(initial.data));
    assert.equal((await c.request("/api/data")).data.error,"PASSWORD_CHANGE_REQUIRED");
    assert.equal((await c.request("/api/account/password",{current:temporary,password})).status,200);
    assert.equal((await c.request("/api/data")).status,401);
    const real=client(); await real.request("/api/auth/sign-in/email",{email,password});
    const factor=await enroll(real,password);
    const data=await real.request("/api/data"); assert.equal(data.status,200); assert.equal(data.data.user.role,role); assert.equal(data.data.users.length,0);
    assert.equal((await real.request("/api/data",{op:"program",data:{name:"Forbidden"}})).status,403);
    assert.equal((await real.request("/api/reports?type=master")).status,403);
    await mutate(real,"availabilityBatch",[1,3,5].map((weekday)=>({userId:person.id,kind:"AVAILABLE",weekday,startTime:"09:00",endTime:"12:00"})));
    assert.equal(await db.availability.count({where:{userId:person.id}}),3);
    const before=await db.availability.count();
    assert.notEqual((await real.request("/api/data",{op:"availabilityBatch",data:[{userId:person.id,kind:"AVAILABLE",weekday:2,startTime:"09:00",endTime:"12:00"},{userId:coordinator.id??"coordinator",kind:"AVAILABLE",weekday:3,startTime:"09:00",endTime:"12:00"}]})).status,200);
    assert.equal(await db.availability.count(),before);
    people.push({role,email,password,totpURI:factor.totpURI,userId:person.id});
  }
  success("teacher/student accounts, mandatory password replacement, own MFA, role permissions, and atomic multi-day availability");
  const wrongOrigin=await fetch(base+"/api/data",{method:"POST",headers:{Origin:"https://untrusted.invalid","Content-Type":"application/json"},body:JSON.stringify({op:"program",data:{name:"Forbidden"}})});
  assert.equal(wrongOrigin.status,403);
  const rollback=client(); await rollback.request("/api/auth/sign-in/email",coordinator);
  for(let i=0;i<5;i++) assert.notEqual((await rollback.request("/api/auth/two-factor/verify-totp",{code:"000000"})).status,200);
  assert.equal((await rollback.request("/api/auth/two-factor/verify-totp",{code:totp(adminFactor.totpURI)})).status,429);
  await db.twoFactor.updateMany({where:{userId:(await db.user.findUnique({where:{email:coordinator.email}})).id},data:{failedVerificationCount:0,lockedUntil:null}});
  success("cross-origin mutation rejection and persisted authenticator lockout after repeated bad codes");
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/real-auth-qa-accounts.json",JSON.stringify({coordinator:{...coordinator,totpURI:adminFactor.totpURI},people}));
  success("QA credentials saved only in ignored local test artifacts");
} finally { await db.$disconnect(); }
