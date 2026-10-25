import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { mutateRecord, viewData } from "../src/lib/records";
import { generateDraft, publish } from "../src/lib/scheduling";
import { reportRows } from "../src/lib/reports";

assert(new URL(process.env.DATABASE_URL!).hostname === "localhost" && /test_audit_/.test(new URL(process.env.DATABASE_URL!).pathname), "Use a dedicated local audit test database.");
try {
  const coordinator = await db.user.findUniqueOrThrow({ where: { email: "coordinator@scheduler-qa.ac" } });
  const student = await db.user.findUniqueOrThrow({ where: { email: "student@scheduler-qa.ac" }, include: { student: true } });
  const teacher = await db.user.findUniqueOrThrow({ where: { email: "faculty@scheduler-qa.ac" }, include: { faculty: true } });
  const admin = { id: coordinator.id, name: coordinator.name, role: coordinator.role };
  const learner = { id: student.id, name: student.name, role: student.role };
  const program = await db.program.create({ data: { name: "Audit program", sections: { create: { name: "Audit section" } } }, include: { sections: true } });
  const term = await db.term.create({ data: { year: "2026–2027", semester: "Audit semester" } });
  const stage = await db.stage.create({ data: { name: "Audit defense", duration: 45 } });
  const room = await db.room.create({ data: { name: "Audit room", building: "Test building", location: "Test floor", capacity: 20 } });
  await db.rules.update({ where: { id: 1 }, data: { startDate: "2026-11-02", endDate: "2026-11-06", panelists: 1, adviserAsPanelist: true } });
  const group = await db.thesisGroup.create({ data: {
    code: "AUDIT-1", title: "Fictional security regression defense", sectionId: program.sections[0].id, termId: term.id,
    memberships: { create: { studentId: student.student!.id, termId: term.id, course: "THESIS" } },
    assignments: { create: ["ADVISER", "PANELIST", "CHAIR"].map((role) => ({ role, facultyId: teacher.faculty!.id })) },
    attempts: { create: { stageId: stage.id, readiness: "READY" } },
  } });
  for (const resource of [{ userId: student.id }, { userId: teacher.id }, { roomId: room.id }]) {
    await mutateRecord(admin, "availability", { ...resource, kind: "AVAILABLE", date: "2026-11-02", startTime: "08:00", endTime: "17:00" });
  }
  const selection = { termId: term.id, stageId: stage.id, from: "2026-11-02", to: "2026-11-02", rooms: [room.id] };
  const draft = await generateDraft(admin, selection);
  assert.equal(draft.proposals.length, 1);
  const session = await db.defenseSession.findFirstOrThrow({ where: { attempt: { groupId: group.id } } });
  await publish(admin, [session.id]);
  assert(!JSON.stringify((await viewData(learner)).sessions).includes(student.email));
  console.log("PASS generated and published snapshots omit account email and security fields");

  const block = { userId: student.id, kind: "BLOCK", date: "2026-11-02", startTime: "08:00", endTime: "09:00", label: "Audit conflict" };
  const before = await db.notification.count({ where: { userId: admin.id } });
  await mutateRecord(learner, "availability", block);
  assert.equal((await db.defenseSession.findUniqueOrThrow({ where: { id: session.id } })).attention, true);
  assert.equal(await db.notification.count({ where: { userId: admin.id } }), before + 1);
  await mutateRecord(learner, "availability", block);
  assert.equal(await db.notification.count({ where: { userId: admin.id } }), before + 1, "Repeated rechecks must not spam coordinators");
  const savedBlock = await db.availability.findFirstOrThrow({ where: { userId: student.id, label: "Audit conflict" } });
  await mutateRecord(learner, "removeAvailability", { id: savedBlock.id });
  assert.equal((await db.defenseSession.findUniqueOrThrow({ where: { id: session.id } })).attention, false);
  console.log("PASS conflict notifications occur once, retain reservations, and clear attention after repair");

  // Simulate a legacy snapshot from before this privacy fix and an older roster.
  const legacy = JSON.parse(JSON.stringify(session.snapshot));
  legacy.students[0].email = "private-sentinel@college.edu";
  legacy.students[0].twoFactorEnabled = true;
  const unrelated = { ...legacy, students: [{ id: "old-member", name: "Former member", email: "private-sentinel@college.edu" }] };
  await db.defenseSession.update({ where: { id: session.id }, data: { snapshot: legacy, version: 2 } });
  await db.scheduleVersion.updateMany({ where: { sessionId: session.id }, data: { snapshot: unrelated } });
  await db.scheduleVersion.create({ data: { sessionId: session.id, version: 2, snapshot: legacy, actorId: admin.id, reason: "Audit history" } });
  const current = (await viewData(learner)).sessions[0];
  assert.equal(current.history.length, 1);
  assert.equal(current.history[0].version, 2);
  assert(!JSON.stringify(current).includes("private-sentinel"));
  assert(!JSON.stringify(await viewData(admin)).includes("private-sentinel"));
  assert(!JSON.stringify(await reportRows(learner, new URLSearchParams({ type: "group" }))).includes("private-sentinel"));
  assert.equal((await reportRows(learner, new URLSearchParams({ type: "group", version: "1" }))).length, 0);
  console.log("PASS legacy snapshots are sanitized in workspace and exports; unrelated historical membership stays private");

  await assert.rejects(() => mutateRecord(learner, "availability", { ...block, date: "2026-02-31" }));
  await assert.rejects(() => generateDraft(admin, { ...selection, from: "2026-02-31" }));
  await assert.rejects(() => reportRows(learner, new URLSearchParams({ type: "group", from: "2026-11-02", to: "2026-11-01" })));
  console.log("PASS server mutations and report filters reject invalid dates");

  // A second fictional group gives the browser a real, unpublished draft to review.
  const second = await db.thesisGroup.create({ data: { code: "AUDIT-2", title: "Fictional draft for confirmation checks", sectionId: program.sections[0].id, termId: term.id, attempts: { create: { stageId: stage.id } } } });
  await db.defenseSession.create({ data: { attemptId: (await db.attempt.findFirstOrThrow({ where: { groupId: second.id } })).id, roomId: room.id, start: new Date("2026-11-02T02:00:00Z"), end: new Date("2026-11-02T02:45:00Z"), snapshot: { ...session.snapshot as object, code: "AUDIT-2", groupId: second.id } } });
  await writeFile("tmp/security-audit-workflow.json", JSON.stringify({ sessionId: session.id, groupId: group.id, selection }));
} finally { await db.$disconnect(); }
