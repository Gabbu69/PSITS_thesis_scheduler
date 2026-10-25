import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { apiError } from "../src/lib/api-errors";
import { calendarDate, clockTime, draftSelection, studentNumber, validateReportFilters, PublicError } from "../src/lib/validation";
import { publicSnapshot, snapshotIncludes } from "../src/lib/snapshots";
import { realEmail } from "../src/lib/accounts";

test("account emails normalize pasted spaces and case while rejecting reserved addresses", () => {
  assert.equal(realEmail.parse(" Student@College.edu "), "student@college.edu");
  for (const email of ["fake@example.com", "person@demo.psits.test", "person@localhost", "not-email"])
    assert.equal(realEmail.safeParse(email).success, false, email);
});

test("calendar dates reject rollover, invalid leap days, and malformed times", () => {
  for (const value of ["2026-02-29", "2026-02-31", "2026-04-31", "2026-13-01", "2026-1-1", "no-date"])
    assert.equal(calendarDate.safeParse(value).success, false, value);
  assert.equal(calendarDate.parse("2028-02-29"), "2028-02-29");
  for (const value of ["24:00", "12:60", "9:00"]) assert.equal(clockTime.safeParse(value).success, false);
  assert.equal(clockTime.parse("23:59"), "23:59");
  assert.equal(draftSelection.safeParse({termId:"term", stageId:"stage", from:"2026-02-31", to:"2026-03-01", rooms:["room"]}).success, false);
  assert.equal(studentNumber.safeParse("   ").success, false);
  assert.equal(studentNumber.parse(" 2026-01 "), "2026-01");
});

test("reports reject reversed dates, impossible dates, and invalid versions", () => {
  for (const query of ["from=2026-02-31", "from=2026-11-02&to=2026-11-01", "version=-1", "version=1.5", "version=Infinity", "format=html"])
    assert.throws(() => validateReportFilters(new URLSearchParams(query)), query);
  validateReportFilters(new URLSearchParams("from=2026-11-01&to=2026-11-02&version=2&format=csv"));
});

test("API errors retain useful validation and permission messages without leaking database internals", () => {
  assert.equal(apiError(new PublicError("UNAUTHORIZED")).status, 401);
  assert.equal(apiError(new PublicError("FORBIDDEN")).status, 403);
  assert.equal(apiError(new PublicError("End time must be after start time")).status, 400);
  for (const error of [new Error("postgres://private-secret@server"), new Prisma.PrismaClientValidationError("Query with private email", { clientVersion: "6.19.0" })]) {
    assert.equal(apiError(error).status, 500);
    assert(!apiError(error).error.includes("private"));
  }
  const duplicate = new Prisma.PrismaClientKnownRequestError("private query", { code: "P2002", clientVersion: "6.19.0" });
  assert.equal(apiError(duplicate).status, 409);
  assert(!apiError(duplicate).error.includes("private"));
});

test("legacy schedule snapshots expose only schedule fields and named participants", () => {
  const snapshot = publicSnapshot.parse({
    attemptId:"a", groupId:"g", code:"G1", title:"Thesis", stage:"Proposal", term:"2026", program:"BSIT", section:"4A",
    start:"2026-11-02T00:00:00.000Z", end:"2026-11-02T00:45:00.000Z", roomId:"r", buffer:15,
    students:[{id:"s",name:"Student",email:"private@college.edu",mustChangePassword:true}],
    adviser:[{id:"f",name:"Teacher",faculty:{capacity:8},twoFactorEnabled:true}], panel:[],chair:[],
    room:{id:"r",name:"Room",building:"Building",location:"Floor",capacity:100}, priority:90,
  });
  assert.deepEqual(snapshot.students, [{id:"s",name:"Student"}]);
  assert.deepEqual(snapshot.adviser, [{id:"f",name:"Teacher"}]);
  assert(!JSON.stringify(snapshot).includes("private"));
  assert(snapshotIncludes(snapshot,"s"));
  assert(!snapshotIncludes(snapshot,"unrelated-person"));
});
