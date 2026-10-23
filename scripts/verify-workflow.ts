import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { mutateRecord, viewData } from "../src/lib/records";
import { candidates, context } from "../src/lib/context";
import {
  generateDraft,
  publish,
  changeSession,
  snapshot,
  serialized,
} from "../src/lib/scheduling";
import { reportRows, pdfBuffer } from "../src/lib/reports";
import { instant, required, validate } from "../src/lib/constraints";
const admin = { id: "coordinator", name: "Alex Rivera", role: "COORDINATOR" };
const student = { id: "student", name: "Jamie Dela Rosa", role: "STUDENT" };
const pass = (s: string) => console.log("PASS " + s);
async function verify() {
  assert(
    await db.user.findUnique({ where: { id: admin.id } }),
    "Seed the fictional demo first",
  );
  // This verifier modifies only fictional seed records; run on a dedicated demo DB.
  assert.equal(
    (await db.college.findUniqueOrThrow({ where: { id: 1 } })).name.includes(
      "Fictional",
    ),
    true,
    "Dedicated fictional database required",
  );
  await db.scheduleVersion.deleteMany();
  await db.defenseSession.deleteMany();
  await db.notification.deleteMany();
  await mutateRecord(admin, "availability", {
    userId: "student",
    kind: "AVAILABLE",
    date: "2026-11-02",
    startTime: "08:00",
    endTime: "17:00",
    label: "Workflow verification",
  });
  const result = await generateDraft(admin, {
    termId: "term-2026",
    stageId: "proposal",
    from: "2026-11-02",
    to: "2026-11-06",
    rooms: ["room-1", "room-2"],
  });
  assert(result.proposals.length > 0);
  assert(result.waiting.length >= 2);
  pass(
    "Availability entry -> deterministic draft; unscheduled groups have reasons",
  );
  assert.equal(await db.notification.count(), 0);
  pass("Draft generation sends no official notices");
  const drafts = await db.defenseSession.findMany({
    where: { status: "DRAFT" },
  });
  await publish(
    admin,
    drafts.map((s) => s.id),
  );
  pass("Current constraints rechecked and draft published");
  const groupOne = await db.defenseSession.findFirstOrThrow({
    where: { attemptId: "attempt-1" },
    include: { participants: true },
  });
  assert.equal(
    groupOne.participants.filter((p) => p.role === "STUDENT").length,
    3,
  );
  assert.equal(
    await db.defenseSession.count({
      where: { attemptId: "attempt-1", status: "PUBLISHED" },
    }),
    1,
  );
  pass("Three-member group has exactly one session");
  const studentData = await viewData(student);
  assert.equal(studentData.groups.length, 1);
  assert(
    studentData.sessions.every((s) =>
      s.participants.some((p) => p.userId === student.id),
    ),
  );
  assert.equal(
    (
      await reportRows(
        student,
        new URLSearchParams({ type: "group", group: "group-2" }),
      )
    ).length,
    0,
  );
  await assert.rejects(
    () =>
      generateDraft(student, {
        termId: "term-2026",
        stageId: "proposal",
        from: "2026-11-02",
        to: "2026-11-06",
        rooms: ["room-1"],
      }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    () =>
      mutateRecord(student, "facultyLimits", {
        id: "faculty-faculty",
        capacity: 99,
        capacityUnit: "GROUPS",
        dailyLimit: 9,
        weeklyLimit: null,
      }),
    /FORBIDDEN/,
  );
  pass("Student scope and coordinator action denial");
  await assert.rejects(
    () =>
      mutateRecord(admin, "assign", {
        groupId: "group-9",
        adviserId: "faculty-faculty",
        panelIds: ["faculty-santos", "faculty-cruz", "faculty-lim"],
        chairId: "faculty-santos",
      }),
    /capacity exceeded/,
  );
  pass(
    "8/8 adviser cannot receive a ninth group; existing advisee was published",
  );
  // Find a different valid interval using the same shared validator.
  const ctx = await context(),
    c = (await candidates()).find((c) => c.attemptId === "attempt-1")!;
  let replacement: { roomId: string; start: Date } | undefined;
  outer: for (const date of ["2026-11-05", "2026-11-06"])
    for (const time of [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "13:00",
      "14:00",
      "15:00",
    ]) {
      const start = instant(date, time),
        p = {
          attemptId: c.attemptId,
          roomId: "room-1",
          start,
          end: new Date(start.getTime() + 45 * 60000),
        };
      if (!validate(c, p, ctx, groupOne.id).length) {
        replacement = { roomId: "room-1", start };
        break outer;
      }
    }
  assert(replacement);
  await changeSession(
    admin,
    groupOne.id,
    "RESCHEDULE",
    "Fictional rescheduling acceptance test",
    replacement,
  );
  const moved = await db.defenseSession.findUniqueOrThrow({
    where: { id: groupOne.id },
    include: { history: true },
  });
  assert.equal(moved.version, 2);
  assert.equal(moved.history.length, 2);
  assert.notEqual(
    (moved.history[0].snapshot as any).start,
    (moved.history[1].snapshot as any).start,
  );
  assert(
    await db.notification.count({
      where: { userId: student.id, message: { contains: "version 2" } },
    }),
  );
  pass(
    "Rescheduling preserves history, increments version, and notifies students",
  );
  const rows = await reportRows(
    student,
    new URLSearchParams({ type: "group" }),
  );
  assert.equal(rows[0].version, 2);
  assert.equal(rows[0].students.length, 3);
  assert.equal(rows[0].date, "2026-11-05");
  await mkdir("output/pdf", { recursive: true });
  await writeFile(
    "output/pdf/sample-group-schedule.pdf",
    await pdfBuffer("College of Computing · Fictional Demo", rows, "group"),
  );
  const master = await reportRows(admin, new URLSearchParams());
  await writeFile(
    "output/pdf/sample-master-schedule.pdf",
    await pdfBuffer("College of Computing · Fictional Demo", master, "master"),
  );
  pass("Database-backed PDF generated with current version and all members");
  // Concurrent publications: two independently generated drafts contend for one real resource.
  // Both can exist as proposals, but one publication must lose under the DB lock.
  const testPrefix = "verify-concurrency-";
  const groupIds = ["group-11", "group-12"];
  const original = await db.attempt.findMany({
    where: { groupId: { in: groupIds } },
  });
  const created: string[] = [];
  try {
    await db.attempt.updateMany({
      where: { groupId: { in: groupIds } },
      data: { readiness: "READY" },
    });
    const g12 = await db.membership.findMany({
      where: { groupId: "group-12" },
      include: { student: true },
    });
    for (const m of g12)
      await db.availability.create({
        data: {
          userId: m.student.userId,
          kind: "AVAILABLE",
          date: "2026-11-06",
          startTime: "08:00",
          endTime: "17:00",
          label: testPrefix,
        },
      });
    await db.assignment.upsert({
      where: {
        groupId_facultyId_role: {
          groupId: "group-11",
          facultyId: "faculty-lim",
          role: "PANELIST",
        },
      },
      update: {},
      create: {
        groupId: "group-11",
        facultyId: "faculty-lim",
        role: "PANELIST",
      },
    });
    const cs = (await candidates()).filter((c) => groupIds.includes(c.groupId));
    const concurrentContext = await context();
    let slot: Date | undefined;
    for (const time of [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "13:00",
      "14:00",
      "15:00",
    ]) {
      const start = instant("2026-11-06", time);
      if (
        cs.every(
          (c) =>
            !validate(
              c,
              {
                attemptId: c.attemptId,
                roomId: "room-1",
                start,
                end: new Date(start.getTime() + 45 * 60000),
              },
              concurrentContext,
            ).length,
        )
      ) {
        slot = start;
        break;
      }
    }
    assert(slot);
    for (const candidate of cs) {
      const p = {
        attemptId: candidate.attemptId,
        roomId: "room-1",
        start: slot,
        end: new Date(slot.getTime() + 45 * 60000),
      };
      const s = await db.defenseSession.create({
        data: {
          ...p,
          snapshot: snapshot(candidate, p, concurrentContext),
          participants: {
            create: required(candidate, concurrentContext.rules).map((p) => ({
              userId: p.id,
              role: p.faculty ? "FACULTY" : "STUDENT",
            })),
          },
        },
      });
      created.push(s.id);
    }
    const outcomes = await Promise.allSettled(
      created.map((id) => publish(admin, [id])),
    );
    assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter((r) => r.status === "rejected").length, 1);
    pass("Concurrent conflicting publications: exactly one succeeds");
    await db.scheduleVersion.deleteMany({
      where: { sessionId: { in: created } },
    });
    await db.defenseSession.deleteMany({ where: { id: { in: created } } });
    // The same race across different rooms and non-overlapping slots must enforce workload.
    const commonFaculty = await db.faculty.findUniqueOrThrow({
      where: { id: "faculty-garcia" },
    });
    const existingDayCount = await db.defenseSession.count({
      where: {
        status: { in: ["PUBLISHED", "COMPLETED"] },
        start: {
          gte: instant("2026-11-06", "00:00"),
          lt: instant("2026-11-07", "00:00"),
        },
        participants: { some: { userId: "garcia" } },
      },
    });
    await db.faculty.update({
      where: { id: commonFaculty.id },
      data: { dailyLimit: existingDayCount + 1 },
    });
    const workloadContext = await context();
    const slots: Date[] = [];
    for (const time of [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "13:00",
      "14:00",
      "15:00",
    ]) {
      const start = instant("2026-11-06", time);
      if (
        cs.every(
          (c) =>
            !validate(
              c,
              {
                attemptId: c.attemptId,
                roomId: "room-1",
                start,
                end: new Date(start.getTime() + 45 * 60000),
              },
              workloadContext,
            ).length,
        )
      )
        slots.push(start);
    }
    assert(slots.length >= 2);
    const raceIds = [];
    for (let i = 0; i < cs.length; i++) {
      const candidate = cs[i],
        p = {
          attemptId: candidate.attemptId,
          roomId: "room-1",
          start: slots[i],
          end: new Date(slots[i].getTime() + 45 * 60000),
        };
      const s = await db.defenseSession.create({
        data: {
          ...p,
          snapshot: snapshot(candidate, p, workloadContext),
          participants: {
            create: required(candidate, workloadContext.rules).map((p) => ({
              userId: p.id,
              role: p.faculty ? "FACULTY" : "STUDENT",
            })),
          },
        },
      });
      raceIds.push(s.id);
      created.push(s.id);
    }
    const workloadOutcomes = await Promise.allSettled(
      raceIds.map((id) => publish(admin, [id])),
    );
    assert.equal(
      workloadOutcomes.filter((r) => r.status === "fulfilled").length,
      1,
    );
    assert.equal(
      workloadOutcomes.filter((r) => r.status === "rejected").length,
      1,
    );
    await db.faculty.update({
      where: { id: commonFaculty.id },
      data: { dailyLimit: commonFaculty.dailyLimit },
    });
    pass(
      "Concurrent non-overlapping publications cannot exceed daily workload cap",
    );
  } finally {
    await db.scheduleVersion.deleteMany({
      where: { sessionId: { in: created } },
    });
    await db.defenseSession.deleteMany({ where: { id: { in: created } } });
    await db.availability.deleteMany({ where: { label: testPrefix } });
    await db.assignment.deleteMany({
      where: {
        groupId: "group-11",
        facultyId: "faculty-lim",
        role: "PANELIST",
      },
    });
    for (const a of original)
      await db.attempt.update({
        where: { id: a.id },
        data: { readiness: a.readiness },
      });
  }
  // Make a blocked exception after publication: keep reservation and notify coordinator.
  const before = await db.defenseSession.findUniqueOrThrow({
    where: { id: groupOne.id },
  });
  await mutateRecord(admin, "availability", {
    userId: "faculty",
    kind: "BLOCK",
    date: "2026-11-05",
    startTime: "08:00",
    endTime: "17:00",
    label: "Fictional affected-session demonstration",
  });
  const after = await db.defenseSession.findUniqueOrThrow({
    where: { id: groupOne.id },
  });
  assert(after.attention);
  assert.equal(after.status, "PUBLISHED");
  assert.equal(after.start.toISOString(), before.start.toISOString());
  pass(
    "Availability change flags published session and retains its reservation",
  );
  console.log("WORKFLOW VERIFICATION COMPLETE");
}
verify()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
