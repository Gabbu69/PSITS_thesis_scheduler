import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
async function login(email) {
  const response = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password: process.env.DEMO_PASSWORD }),
  });
  assert.equal(response.status, 200, await response.text());
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert(cookie);
  return cookie;
}
async function api(cookie, path, body) {
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
assert.equal((await fetch(base + "/api/data")).status, 401);
const student = await login("student@demo.psits.test");
const studentData = await (await api(student, "/api/data")).json();
assert.equal(studentData.groups.length, 1);
assert.equal(studentData.groups[0].id, "group-1");
assert.equal(
  (
    await api(student, "/api/data", {
      op: "publish",
      data: { ids: ["not-authorized"] },
    })
  ).status,
  403,
);
assert.equal((await api(student, "/api/reports?type=master")).status, 403);
const other = await (
  await api(student, "/api/reports?type=group&group=group-2&format=json")
).json();
assert.equal(other.length, 0);
const pdf = await api(student, "/api/reports?type=group&group=group-1");
assert.equal(pdf.status, 200);
assert.equal(pdf.headers.get("content-type"), "application/pdf");
const bytes = Buffer.from(await pdf.arrayBuffer());
assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
await writeFile("tmp/student-downloaded-schedule.pdf", bytes);
console.log(
  "PASS HTTP: credential login, cookie session, anonymous denial, student data scope, coordinator-action denial, restricted report denial, authorized PDF download",
);
const faculty = await login("faculty@demo.psits.test");
const facultyData = await (await api(faculty, "/api/data")).json();
assert.equal(facultyData.user.role, "FACULTY");
assert(facultyData.groups.length >= 8);
const coordinator = await login("coordinator@demo.psits.test");
const coordinatorData = await (await api(coordinator, "/api/data")).json();
assert.equal(coordinatorData.groups.length, 12);
const crossOrigin = await fetch(base + "/api/data", {
  method: "POST",
  headers: {
    Cookie: coordinator,
    Origin: "https://wrong.example",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ op: "publish", data: { ids: ["bad"] } }),
});
assert.equal(crossOrigin.status, 403);
console.log(
  "PASS HTTP: faculty/coordinator role sessions and same-origin mutation protection",
);
