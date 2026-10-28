import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { managedClassTimetables, mutateClassTimetable, protectedClassWindows, publishedClassTimetables, TimetableConflict } from "../src/lib/class-timetables";
import { context, candidates } from "../src/lib/context";
import { availability, local, validate } from "../src/lib/constraints";
import { generateDraft, publish, changeSession } from "../src/lib/scheduling";
import type { ClassMeetingInput } from "../src/lib/class-timetable-rules";

const admin = { id: "coordinator", name: "Alex Rivera", role: "COORDINATOR" };
const faculty = { id: "faculty", name: "Dr. Elena Reyes", role: "FACULTY" };
const other = { id: "santos", name: "Prof. Marco Santos", role: "FACULTY" };
const student = { id: "student", name: "Jamie Dela Rosa", role: "STUDENT" };
const pass = (message: string) => console.log(`PASS ${message}`);
async function verify() {
  assert(process.env.ALLOW_TEST_FIXTURES === "1" && new URL(process.env.DATABASE_URL!).hostname === "127.0.0.1" && /test/.test(new URL(process.env.DATABASE_URL!).pathname), "Use only the isolated local test database.");
  assert((await db.college.findUniqueOrThrow({ where: { id: 1 } })).name.includes("Fictional"));
  assert.equal(await db.classTimetable.count(), 0);
  assert.equal((await publishedClassTimetables()).timetables.length, 0);
  await db.scheduleVersion.deleteMany(); await db.defenseSession.deleteMany();
  await db.availability.deleteMany({ where: { label: "Fictional affected-session demonstration" } });
  await db.user.updateMany({ data: { twoFactorEnabled: true } });
  await generateDraft(admin, { termId: "term-2026", stageId: "proposal", from: "2026-11-02", to: "2026-11-06", rooms: ["room-1", "room-2"] });
  const booked = await db.defenseSession.findFirstOrThrow({ where: { status: "DRAFT", participants: { some: { userId: faculty.id } } }, orderBy: { start: "asc" }, include: { participants: true } });
  await publish(admin, [booked.id]);
  const weekday = new Date(`${local(booked.start)}T12:00Z`).getUTCDay();
  const meeting: ClassMeetingInput = { subjectCode: "IT 101", subjectName: "Introduction to Computing", section: "1A", location: "Computing Room 101", weekday, startTime: local(booked.start, "HH:mm"), endTime: local(booked.end, "HH:mm") };
  const input = { facultyId: "faculty-faculty", termId: "term-2026", version: 0, effectiveFrom: "2026-10-01", effectiveTo: "2026-12-31", meetings: [meeting] };
  await assert.rejects(() => mutateClassTimetable(other, "save", input), /FORBIDDEN/);
  await assert.rejects(() => mutateClassTimetable(student, "save", input), /FORBIDDEN/);
  await assert.rejects(() => managedClassTimetables(student), /FORBIDDEN/);
  const { id } = await mutateClassTimetable(faculty, "save", input);
  const get = () => db.classTimetable.findUniqueOrThrow({ where: { id }, include: { revisions: { include: { meetings: true }, orderBy: { number: "desc" } } } });
  assert.equal((await publishedClassTimetables()).timetables.length, 0);
  const flagged = await db.defenseSession.findUniqueOrThrow({ where: { id: booked.id } });
  assert(flagged.attention); assert.equal(flagged.status, "PUBLISHED"); assert.equal(flagged.start.toISOString(), booked.start.toISOString());
  for (const p of booked.participants) assert(await db.notification.count({ where: { userId: p.userId, message: { contains: "requires review" } } }));
  assert((await managedClassTimetables(faculty)).timetables[0].revisions[0].affectedDefenses.some((s) => s.id === booked.id));
  pass("Drafts remain private; saved classes flag conflicts, notify participants, and retain reservations");
  const cs = await candidates(), ctx = await context(), c = cs.find((c) => c.attemptId === booked.attemptId)!;
  assert(validate(c, booked, ctx, booked.id).some((e) => e.includes("class conflict")));
  await assert.rejects(() => changeSession(admin, booked.id, "RESCHEDULE", "Test class protection", { roomId: booked.roomId, start: booked.start }), /class conflict/);
  const conflictingDraft = await db.defenseSession.findFirst({ where: { status: "DRAFT", participants: { some: { userId: faculty.id } } }, orderBy: { start: "asc" } });
  if (conflictingDraft) {
    await db.defenseSession.update({ where: { id: conflictingDraft.id }, data: { start: booked.start, end: booked.end } });
    await assert.rejects(() => publish(admin, [conflictingDraft.id]), /class conflict/);
    await assert.rejects(() => changeSession(admin, conflictingDraft.id, "EDIT", "Test class protection", { roomId: conflictingDraft.roomId, start: booked.start }), /class conflict/);
  }
  await assert.rejects(() => mutateClassTimetable(admin, "publish", { id, version: 1 }), /Submit/);
  await mutateClassTimetable(faculty, "submit", { id, version: 1 });
  await assert.rejects(() => mutateClassTimetable(faculty, "publish", { id, version: 2 }), /FORBIDDEN/);
  await mutateClassTimetable(admin, "publish", { id, version: 2 });
  const publicRows = (await publishedClassTimetables()).timetables;
  assert.equal(publicRows.length, 1); assert.equal(publicRows[0].meetings.length, 1);
  const json = JSON.stringify(publicRows);
  for (const privateField of ["@demo", "userId", "publisherId", "affectedDefenses", "revisions", "students", "password", "DRAFT"]) assert(!json.includes(privateField), privateField);
  assert.equal((await publishedClassTimetables(new URLSearchParams("faculty=other"))).timetables.length, 0);
  assert.equal((await publishedClassTimetables(new URLSearchParams(`weekday=${(weekday + 1) % 7}`))).timetables[0].meetings.length, 0);
  await assert.rejects(() => publishedClassTimetables(new URLSearchParams("weekday=9")));
  pass("Coordinator-only atomic publication exposes an allowlisted public timetable and validated filters");
  await db.term.create({ data: { id: "term-other", year: "2026–2027", semester: "Other Term" } });
  await assert.rejects(() => mutateClassTimetable(faculty, "save", { ...input, termId: "term-other" }), /overlap/);
  await mutateClassTimetable(faculty, "save", { ...input, termId: "term-other", effectiveFrom: "2027-01-01", effectiveTo: "2027-06-01" });
  const changes = await Promise.allSettled([
    mutateClassTimetable(faculty, "save", { ...input, version: 3, meetings: [] }),
    mutateClassTimetable(faculty, "save", { ...input, version: 3, meetings: [] }),
  ]);
  assert.equal(changes.filter((r) => r.status === "fulfilled").length, 1);
  assert(changes.some((r) => r.status === "rejected" && r.reason instanceof TimetableConflict));
  assert.equal((await publishedClassTimetables()).timetables[0].meetings.length, 1);
  const windows = await protectedClassWindows(db);
  assert.match(availability(windows.filter((w) => w.userId === faculty.id), local(booked.start), meeting.startTime, meeting.endTime)!, /class conflict/);
  assert.equal((await get()).revisions.find((r) => r.status === "PUBLISHED")!.meetings.length, 1);
  assert((await managedClassTimetables(faculty)).timetables.every((t) => t.facultyId === "faculty-faculty"));
  pass("Overlapping terms are rejected; concurrent saves cannot overwrite; pending deletions preserve published protection");
  await mutateClassTimetable(faculty, "submit", { id, version: 4 });
  // Editing a submitted revision resets its review status.
  await mutateClassTimetable(faculty, "save", { ...input, version: 5, meetings: [] });
  assert.equal((await get()).revisions[0].status, "DRAFT");
  await assert.rejects(() => mutateClassTimetable(admin, "publish", { id, version: 6, confirmEmpty: true }), /Submit/);
  await mutateClassTimetable(faculty, "submit", { id, version: 6 });
  await assert.rejects(() => mutateClassTimetable(admin, "publish", { id, version: 7 }), /Confirm retirement/);
  await mutateClassTimetable(admin, "publish", { id, version: 7, confirmEmpty: true });
  const retired = await get();
  assert.equal(retired.revisions.filter((r) => r.status === "PUBLISHED").length, 1);
  assert.equal(retired.revisions.find((r) => r.status === "SUPERSEDED")!.meetings.length, 1);
  assert.equal((await publishedClassTimetables()).timetables[0].meetings.length, 0);
  assert(!(await protectedClassWindows(db)).some((w) => w.userId === faculty.id && w.effectiveFrom === input.effectiveFrom));
  assert(!validate(c, booked, await context(), booked.id).some((e) => e.includes("class conflict")));
  pass("Submission resets after edits; confirmed retirement preserves history and releases only superseded class blocks");
  // Recreate realistic fictional publications for optional browser checks, only in this local test DB.
  const facultyRows = await db.faculty.findMany({ include: { user: true }, orderBy: { id: "asc" } });
  for (let index = 0; index < facultyRows.length; index++) {
    const f = facultyRows[index], t = await db.classTimetable.findUnique({ where: { facultyId_termId: { facultyId: f.id, termId: input.termId } } });
    const m = [1, 3, 5].map((weekday) => ({ ...meeting, weekday, startTime: `${10 + index}:00`, endTime: `${11 + index}:00`, subjectCode: `IT ${101 + index}`, subjectName: index === 2 ? "Advanced Systems Analysis and Collaborative Software Development" : "Introduction to Computing", location: index === 2 ? "Computing Building, second floor, Research Laboratory 201" : "Computing Room 101" }));
    const saved = await mutateClassTimetable(admin, "save", { ...input, facultyId: f.id, version: t?.version ?? 0, meetings: m });
    const v = t?.version ?? 0;
    await mutateClassTimetable(admin, "submit", { id: saved.id, version: v + 1 });
    await mutateClassTimetable(admin, "publish", { id: saved.id, version: v + 2 });
  }
  await generateDraft(admin, { termId: "term-2026", stageId: "proposal", from: "2026-11-02", to: "2026-11-06", rooms: ["room-1", "room-2"] });
  const finalCtx = await context(), finalCs = await candidates();
  for (const s of await db.defenseSession.findMany({ where: { status: "DRAFT" } })) {
    const errors = validate(finalCs.find((c) => c.attemptId === s.attemptId)!, s, finalCtx, s.id);
    assert(!errors.some((e) => e.includes("class conflict")));
  }
  pass("Defense generation avoids protected classes; complete fictional public board is ready for browser checks");
  console.log("CLASS TIMETABLE INTEGRATION VERIFICATION COMPLETE");
}
verify().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
