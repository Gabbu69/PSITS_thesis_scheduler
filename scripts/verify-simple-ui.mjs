import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base=process.env.BETTER_AUTH_URL;
assert(new URL(base).hostname === "localhost", "This mutating UI verifier is localhost-only.");
assert(/test/.test(new URL(process.env.DATABASE_URL).pathname), "Use an isolated test database.");
const users=JSON.parse(await readFile("tmp/real-auth-qa-accounts.json","utf8"));
const otp=(uri)=>{
  let bits="";for(const c of new URL(uri).searchParams.get("secret").replace(/=/g,""))bits+="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5,"0");
  const key=Buffer.from(bits.match(/.{8}/g).map((b)=>parseInt(b,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const h=createHmac("sha1",key).update(counter).digest(),i=h[h.length-1]&15;return String((h.readUInt32BE(i)&0x7fffffff)%1000000).padStart(6,"0");
};
await mkdir("output/playwright",{recursive:true});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL??"msedge",headless:true,args:["--disable-gpu"]});
const errors=[],results=[];
const check=(s)=>{results.push(s);console.log("PASS "+s);};
async function login(u){
  const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:"reduce"});
  context.setDefaultNavigationTimeout(120000);context.setDefaultTimeout(30000);
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/login",{waitUntil:"domcontentloaded"});
  await page.getByLabel("Email",{exact:true}).fill(u.email);
  await page.getByLabel("Password",{exact:true}).fill(u.password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await page.getByLabel("Six-digit code",{exact:true}).waitFor();
  await page.getByLabel("Six-digit code",{exact:true}).fill(otp(u.totpURI));
  await page.getByRole("button",{name:"Verify and sign in"}).click();
  await page.locator("#main-content").waitFor();
  return {page,context};
}
async function dialog(page,button,fields){
  await page.getByRole("button",{name:button,exact:true}).click();
  const d=page.getByRole("dialog");
  for(const [label,value] of Object.entries(fields)){
    const f=d.getByLabel(label,{exact:true});
    if(await f.evaluate(el=>el.tagName==="SELECT"))await f.selectOption({label:value});else await f.fill(value);
  }
  await d.getByRole("button",{name:"Save",exact:true}).click();await d.waitFor({state:"hidden"});
}
async function noOverflow(page,label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+" overflow");}
try{
  const admin=await login(users.coordinator),page=admin.page;
  assert.equal(await page.locator('.sidebar nav > a').count(),6);
  assert.equal(await page.locator('.hero-panel').count(),0);
  await page.screenshot({path:"output/playwright/simple-coordinator-empty.png",fullPage:true});
  await page.goto(base+"/settings");
  await dialog(page,"Add program",{"Program name":"QA Program"});
  await dialog(page,"Add section",{"Section name":"QA Section","Program":"QA Program"});
  await dialog(page,"Add term",{"Academic year":"2026–2027","Semester":"QA Semester"});
  await dialog(page,"Add defense stage",{"Stage name":"QA Defense","Duration in minutes":"45"});
  await dialog(page,"Edit college and dates",{"College name":"QA College","First defense date":"2026-11-02","Last defense date":"2026-11-02","Start time":"08:00","End time":"17:00"});
  await page.getByRole("button",{name:"Defense requirements",exact:true}).click();
  const rules=page.getByRole("dialog");await rules.getByLabel("Number of panelists",{exact:true}).fill("1");await rules.getByLabel("Allow the adviser as a panelist",{exact:true}).check();await rules.getByRole("button",{name:"Save",exact:true}).click();await rules.waitFor({state:"hidden"});
  await page.goto(base+"/rooms");
  await dialog(page,"Add room",{"Room name / number":"QA Room","Building":"QA Building","Floor and directions":"Ground floor","Seating capacity":"10"});
  await page.goto(base+"/availability");
  await page.getByLabel("For",{exact:true}).selectOption("room");await page.getByLabel("Room",{exact:true}).selectOption({label:"QA Room"});
  await page.getByRole("button",{name:"Add time",exact:true}).click();
  await page.locator('input[name="weekdays"][value="1"]').check();await page.getByRole("button",{name:"Save times",exact:true}).click();await page.getByRole("button",{name:"Add time",exact:true}).waitFor();
  await page.goto(base+"/groups");await page.getByRole("button",{name:"New group",exact:true}).click();
  const group=page.getByRole("dialog");
  await group.getByLabel("Group identifier",{exact:true}).fill("QA-001");await group.getByLabel("Thesis title",{exact:true}).fill("QA Defense Workflow");
  await group.getByRole("button",{name:"Next: members",exact:true}).click();
  await group.getByLabel(/QA-001 · QA Student/).check();
  await group.getByRole("button",{name:"Back",exact:true}).click();assert.equal(await group.getByLabel("Group identifier",{exact:true}).inputValue(),"QA-001");
  await group.getByRole("button",{name:"Next: members",exact:true}).click();await group.getByRole("button",{name:"Save",exact:true}).click();await group.waitFor({state:"hidden"});
  await page.getByText("Manage group",{exact:true}).click();await page.getByRole("button",{name:"Assign faculty",exact:true}).click();
  const committee=page.getByRole("dialog");await committee.getByLabel("Adviser",{exact:true}).selectOption({label:"QA Teacher"});await committee.getByLabel("QA Teacher",{exact:true}).check();await committee.getByLabel("Panel chair",{exact:true}).selectOption({label:"QA Teacher"});await committee.getByRole("button",{name:"Save",exact:true}).click();await committee.waitFor({state:"hidden"});
  check("coordinator configures college, room availability, two-step group with retained input, and committee using checkboxes");
  await new Promise(resolve=>setTimeout(resolve,11000));
  const student=await login(users.people.find(u=>u.role==="STUDENT"));
  assert.equal(await student.page.locator('.sidebar nav > a').count(),4);
  await student.page.goto(base+"/groups");await student.page.getByRole("button",{name:"Submit for review",exact:true}).click();await student.page.getByText("Awaiting review",{exact:true}).waitFor();
  await student.page.goto(base+"/availability");await student.page.getByRole("button",{name:"Add time",exact:true}).click();await student.page.locator('input[name="weekdays"][value="1"]').check();await student.page.locator('input[name="weekdays"][value="2"]').check();await student.page.getByRole("button",{name:"Save times",exact:true}).click();await student.page.getByText("Every Tuesday",{exact:true}).waitFor();
  await student.page.goto(base+"/");await student.page.screenshot({path:"output/playwright/simple-student-desktop.png",fullPage:true});
  check("student has four main pages, submits readiness, and saves availability through the UI");
  await new Promise(resolve=>setTimeout(resolve,11000));
  const faculty=await login(users.people.find(u=>u.role==="FACULTY"));
  assert.equal(await faculty.page.locator('.sidebar nav > a').count(),5);
  await faculty.page.goto(base+"/availability");await faculty.page.getByRole("button",{name:"Add time",exact:true}).click();await faculty.page.locator('input[name="weekdays"][value="1"]').check();await faculty.page.getByRole("button",{name:"Save times",exact:true}).click();await faculty.page.getByText("Every Monday",{exact:true}).waitFor();
  await faculty.page.goto(base+"/groups");await faculty.page.getByRole("button",{name:"Approve ready",exact:true}).click();await faculty.page.getByText("Ready to schedule",{exact:true}).waitFor();
  await faculty.page.goto(base+"/");await faculty.page.screenshot({path:"output/playwright/simple-teacher-desktop.png",fullPage:true});
  check("teacher sees personal navigation and approves an assigned advisee’s readiness");
  await page.goto(base+"/drafts");await page.getByRole("button",{name:"Generate proposed schedule",exact:true}).click();await page.getByText(/Draft generated: 1 groups/).waitFor();
  await page.getByRole("button",{name:"Publish all draft sessions",exact:true}).click();await page.getByText("Saved successfully.",{exact:true}).waitFor();
  await student.page.goto(base+"/calendar");await student.page.getByText("QA Room",{exact:true}).first().waitFor();
  const pdf=await student.context.request.get(base+"/api/reports?type=group");assert.equal(pdf.status(),200);assert((await pdf.body()).subarray(0,4).toString()==="%PDF");
  check("approved group generates, publishes, appears to student, and produces a real authorized PDF");
  for(const [name,target] of [["coordinator",page],["teacher",faculty.page],["student",student.page]]){
    for(const path of ["/","/groups","/availability","/calendar",...(name==="coordinator"?["/accounts","/settings","/drafts","/rooms","/faculty","/reports","/waiting"]:[])]){
      await target.goto(base+path);await target.locator("#main-content").waitFor();await noOverflow(target,`${name}${path}`);
    }
    await target.goto(base+"/");
    for(const viewport of [{width:375,height:667},{width:390,height:568},{width:668,height:318},{width:1024,height:768}]){
      await target.setViewportSize(viewport);await noOverflow(target,`${name} ${viewport.width}`);
      if(viewport.width===375){
        await target.getByRole("button",{name:"Open navigation",exact:true}).click();await target.getByRole("button",{name:"Close navigation",exact:true}).waitFor();await target.keyboard.press("Escape");assert(await target.getByRole("button",{name:"Open navigation",exact:true}).evaluate(el=>el===document.activeElement));
        await target.screenshot({path:`output/playwright/simple-${name}-phone.png`,fullPage:true});
      }
    }
    await target.setViewportSize({width:1366,height:768});
    await target.getByRole("button",{name:"dark theme",exact:true}).click();await noOverflow(target,name+" dark");await target.screenshot({path:`output/playwright/simple-${name}-dark.png`,fullPage:true});
    await target.evaluate(()=>document.documentElement.style.fontSize="200%");await noOverflow(target,name+" enlarged");await target.evaluate(()=>document.documentElement.style.fontSize="");
    await target.getByRole("button",{name:"light theme",exact:true}).click();
  }
  assert.deepEqual(errors,[]);check("all role pages, phone/tablet/landscape layouts, drawer Escape/focus, dark theme, 200% text, and browser runtime checks");
  await writeFile("output/playwright/simple-ui-results.json",JSON.stringify({results,errors},null,2));
}catch(e){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:"output/playwright/simple-ui-failure.png",fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
