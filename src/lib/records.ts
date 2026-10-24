import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { coordinator, type Actor } from "./access";
import { serialized, audit, flagAffected } from "./scheduling";
import { advisingIssue } from "./constraints";
import type { Tx } from "./context";
import { realEmail, passwordSchema } from "./accounts";
const text = z.string().trim().min(1).max(500);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !isNaN(Date.parse(s)));
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const integer = (min = 0, max = 10000) =>
  z.coerce.number().int().min(min).max(max);
const windowSchema = z.object({
  userId: z.string().nullable().optional(),
  roomId: z.string().nullable().optional(),
  kind: z.enum(["AVAILABLE", "BLOCK"]),
  date: date.nullable().optional(),
  weekday: integer(0, 6).nullable().optional(),
  effectiveFrom: date.nullable().optional(),
  effectiveTo: date.nullable().optional(),
  startTime: time,
  endTime: time,
  label: z.string().max(200).default(""),
});
async function ownGroup(tx: Tx, u: Actor, id: string) {
  const g = await tx.thesisGroup.findUniqueOrThrow({
    where: { id },
    include: {
      memberships: { include: { student: true } },
      assignments: { include: { faculty: true } },
    },
  });
  if (
    u.role !== "COORDINATOR" &&
    !g.memberships.some((m) => m.active && m.student.userId === u.id) &&
    !g.assignments.some((a) => a.faculty.userId === u.id)
  )
    throw new Error("FORBIDDEN");
  return g;
}
async function checkCapacity(
  tx: Tx,
  facultyId: string,
  increment: number,
  ignoreGroup?: string,
  checkPreference = true,
) {
  const f = await tx.faculty.findUniqueOrThrow({
    where: { id: facultyId },
    include: {
      assignments: {
        where: {
          role: "ADVISER",
          group: { active: true },
          ...(ignoreGroup ? { groupId: { not: ignoreGroup } } : {}),
        },
        include: {
          group: { include: { memberships: { where: { active: true } } } },
        },
      },
    },
  });
  const load = f.assignments.reduce(
    (n, a) =>
      n + (f.capacityUnit === "GROUPS" ? 1 : a.group.memberships.length),
    0,
  );
  const issue = advisingIssue(
    load,
    f.capacity,
    increment,
    checkPreference ? f.accepting : true,
  );
  if (issue) throw new Error(issue);
}
export async function mutateRecord(u: Actor, op: string, input: unknown) {
  return serialized(async (tx) => {
    if (op === "availability" || op === "availabilityBatch") {
      const entries = op === "availabilityBatch"
        ? z.array(windowSchema).min(1).max(7).parse(input)
        : [windowSchema.parse(input)];
      for (const d of entries) {
      if (u.role !== "COORDINATOR") {
        if (d.roomId || d.userId !== u.id) throw new Error("FORBIDDEN");
      }
      if (d.userId && d.roomId) throw new Error("Choose a person or a room");
      if (
        !d.userId &&
        !d.roomId &&
        (u.role !== "COORDINATOR" || d.kind !== "BLOCK")
      )
        throw new Error("Only coordinators create college-wide blocks");
      if (d.startTime >= d.endTime)
        throw new Error("End time must be after start time");
      if (!d.date && d.weekday == null)
        throw new Error("Choose a date or a recurring weekday");
      if (d.date && d.weekday != null)
        throw new Error("Choose either a date or recurring weekday");
      if (d.effectiveFrom && d.effectiveTo && d.effectiveFrom > d.effectiveTo)
        throw new Error("Invalid effective date range");
      if (d.userId && !await tx.user.count({ where: { id: d.userId } }))
        throw new Error("Choose an existing person.");
      const duplicate = await tx.availability.findFirst({ where: {
        userId: d.userId ?? null, roomId: d.roomId ?? null, kind: d.kind,
        date: d.date ?? null, weekday: d.weekday ?? null,
        effectiveFrom: d.effectiveFrom ?? null, effectiveTo: d.effectiveTo ?? null,
        startTime: d.startTime, endTime: d.endTime,
      } });
      if (!duplicate) await tx.availability.create({ data: d });
      }
      await flagAffected(tx, u);
      await audit(tx, u, "AVAILABILITY", `${entries.length} time ranges saved`);
      return { ok: true };
    }
    if (op === "removeAvailability") {
      const { id } = z.object({ id: text }).parse(input);
      const w = await tx.availability.findUniqueOrThrow({ where: { id } });
      if (u.role !== "COORDINATOR" && w.userId !== u.id)
        throw new Error("FORBIDDEN");
      await tx.availability.delete({ where: { id } });
      await flagAffected(tx, u);
      return { ok: true };
    }
    if (op === "request") {
      const d = z
        .object({
          kind: z.enum([
            "CAPACITY",
            "SCHEDULE_CHANGE",
            "PREFERRED_SLOT",
            "DETAILS",
          ]),
          details: text,
        })
        .parse(input);
      await audit(tx, u, "REQUEST", d.kind);
      return tx.changeRequest.create({ data: { ...d, userId: u.id } });
    }
    if (op === "readNotification") {
      const d = z.object({ id: text }).parse(input);
      return tx.notification.updateMany({
        where: { id: d.id, userId: u.id },
        data: { read: true },
      });
    }
    if (op === "accepting") {
      if (u.role !== "FACULTY") throw new Error("FORBIDDEN");
      const d = z.object({ accepting: z.boolean() }).parse(input);
      await audit(tx, u, op, JSON.stringify(d));
      return tx.faculty.update({ where: { userId: u.id }, data: d });
    }
    if (op === "readiness") {
      const d = z
        .object({
          attemptId: text,
          status: z.enum(["REQUESTED", "READY", "PENDING"]),
        })
        .parse(input);
      const attempt = await tx.attempt.findUniqueOrThrow({
          where: { id: d.attemptId },
        }),
        g = await ownGroup(tx, u, attempt.groupId);
      if (d.status === "REQUESTED" && attempt.readiness !== "PENDING")
        throw new Error("This defense has already been submitted for review.");
      if (d.status === "READY" || d.status === "PENDING") {
        const rules = await tx.rules.findUniqueOrThrow({ where: { id: 1 } });
        if (
          u.role !== "COORDINATOR" &&
          !(
            u.role === "FACULTY" &&
            rules.facultyCanApprove &&
            g.assignments.some(
              (a) => a.role === "ADVISER" && a.faculty.userId === u.id,
            )
          )
        )
          throw new Error("FORBIDDEN");
      }
      await audit(tx, u, op, JSON.stringify(d));
      const updated = await tx.attempt.update({
        where: { id: d.attemptId },
        data: {
          readiness: d.status,
          readyAt: d.status === "READY" ? new Date() : null,
          ...(d.status === "REQUESTED" ? { requestedAt: new Date() } : {}),
        },
      });
      await flagAffected(tx, u);
      return updated;
    }
    coordinator(u);
    let result: unknown;
    if (op === "user") {
      const d = z
        .object({
          name: text,
          email: realEmail,
          password: passwordSchema,
          role: z.enum(["COORDINATOR", "FACULTY", "STUDENT"]),
          number: z.string().optional(),
        })
        .parse(input);
      if (d.role === "STUDENT" && !d.number)
        throw new Error("Student identifier required");
      const id = randomUUID();
      result = await tx.user.create({
        data: {
          id,
          name: d.name,
          email: d.email,
          role: d.role,
          mustChangePassword: true,
          accounts: {
            create: {
              id: randomUUID(),
              accountId: id,
              providerId: "credential",
              password: await hashPassword(d.password),
            },
          },
          ...(d.role === "FACULTY"
            ? { faculty: { create: {} } }
            : d.role === "STUDENT"
              ? { student: { create: { number: d.number! } } }
              : {}),
        },
      });
    } else if (op === "editUser") {
      const d = z
        .object({
          id: text,
          name: text,
          email: realEmail,
          number: z.string().optional(),
          password: z.string().max(128).optional(),
        })
        .parse(input);
      result = await tx.user.update({
        where: { id: d.id },
        data: { name: d.name, email: d.email },
      });
      if (d.number)
        await tx.student.update({
          where: { userId: d.id },
          data: { number: d.number },
        });
      if (d.password) {
        if (d.password.length < 12)
          throw new Error("Password must contain at least 12 characters");
        await tx.account.updateMany({
          where: { userId: d.id, providerId: "credential" },
          data: { password: await hashPassword(d.password) },
        });
        await tx.authSession.deleteMany({ where: { userId: d.id } });
        await tx.user.update({ where: { id: d.id }, data: { mustChangePassword: true } });
      }
    } else if (op === "groupDetails") {
      const d = z
        .object({
          id: text,
          title: text,
          sectionId: text,
          attendees: integer(0, 500),
        })
        .parse(input);
      const { id, ...data } = d;
      result = await tx.thesisGroup.update({ where: { id }, data });
      await flagAffected(tx, u);
    } else if (op === "removeMember") {
      const d = z.object({ membershipId: text, reason: text }).parse(input);
      const m = await tx.membership.findUniqueOrThrow({
        where: { id: d.membershipId },
      });
      if (
        (await tx.membership.count({
          where: { groupId: m.groupId, active: true },
        })) <= 1
      )
        throw new Error("An active group must retain at least one student");
      result = await tx.membership.update({
        where: { id: m.id },
        data: { active: false },
      });
      await flagAffected(tx, u);
    } else if (op === "program")
      result = await tx.program.create({
        data: z.object({ name: text }).parse(input),
      });
    else if (op === "section")
      result = await tx.section.create({
        data: z.object({ name: text, programId: text }).parse(input),
      });
    else if (op === "term")
      result = await tx.term.create({
        data: z.object({ year: text, semester: text }).parse(input),
      });
    else if (op === "stage")
      result = await tx.stage.create({
        data: z.object({ name: text, duration: integer(15, 240) }).parse(input),
      });
    else if (op === "room") {
      const d = z
        .object({
          id: z.string().optional(),
          name: text,
          building: text,
          location: text,
          capacity: integer(1, 1000),
          active: z.boolean().default(true),
        })
        .parse(input);
      const { id, ...data } = d;
      result = id
        ? await tx.room.update({ where: { id }, data })
        : await tx.room.create({ data });
      await flagAffected(tx, u);
    } else if (op === "facultyLimits") {
      const d = z
        .object({
          id: text,
          capacity: integer(1, 1000),
          capacityUnit: z.enum(["GROUPS", "STUDENTS"]),
          dailyLimit: integer(1, 50),
          weeklyLimit: integer(1, 250).nullable(),
        })
        .parse(input);
      const { id, ...data } = d;
      result = await tx.faculty.update({ where: { id }, data });
      await flagAffected(tx, u);
    } else if (op === "group") {
      const d = z
        .object({
          code: text,
          title: text,
          sectionId: text,
          termId: text,
          course: text,
          attendees: integer(0, 500),
          studentIds: z.array(text).min(1),
          stageId: text,
        })
        .parse(input);
      const { studentIds, stageId, ...data } = d;
      result = await tx.thesisGroup.create({
        data: {
          ...data,
          memberships: {
            create: [...new Set(studentIds)].map((studentId) => ({
              studentId,
              termId: data.termId,
              course: data.course,
            })),
          },
          attempts: { create: { stageId } },
        },
      });
    } else if (op === "member") {
      const d = z.object({ groupId: text, studentId: text }).parse(input);
      const g = await tx.thesisGroup.findUniqueOrThrow({
        where: { id: d.groupId },
        include: {
          assignments: {
            where: { role: "ADVISER" },
            include: { faculty: true },
          },
          memberships: { where: { active: true } },
        },
      });
      if (!g.active) throw new Error("Group is archived");
      if (g.memberships.some((m) => m.studentId === d.studentId))
        throw new Error("Student is already an active member of this group");
      for (const a of g.assignments)
        if (a.faculty.capacityUnit === "STUDENTS")
          await checkCapacity(
            tx,
            a.facultyId,
            g.memberships.length + 1,
            g.id,
            false,
          );
      result = await tx.membership.upsert({
        where: { groupId_studentId: { groupId: g.id, studentId: d.studentId } },
        create: { ...d, termId: g.termId, course: g.course },
        update: { active: true },
      });
      await flagAffected(tx, u);
    } else if (op === "assign") {
      const d = z
        .object({
          groupId: text,
          adviserId: text,
          panelIds: z.array(text),
          chairId: text,
        })
        .parse(input);
      const g = await tx.thesisGroup.findUniqueOrThrow({
        where: { id: d.groupId },
        include: {
          memberships: { where: { active: true } },
          assignments: true,
        },
      });
      if (!g.active) throw new Error("Group is archived");
      const r = await tx.rules.findUniqueOrThrow({ where: { id: 1 } });
      if (
        new Set(d.panelIds).size !== r.panelists ||
        (r.chairRequired && !d.panelIds.includes(d.chairId)) ||
        (!r.adviserAsPanelist && d.panelIds.includes(d.adviserId))
      )
        throw new Error(
          "Committee must match panel count, chair and adviser rules",
        );
      const f = await tx.faculty.findUniqueOrThrow({
        where: { id: d.adviserId },
      });
      if (
        !g.assignments.some((a) => a.role === "ADVISER" && a.facultyId === f.id)
      )
        await checkCapacity(
          tx,
          f.id,
          f.capacityUnit === "GROUPS" ? 1 : g.memberships.length,
          g.id,
        );
      await tx.assignment.deleteMany({ where: { groupId: g.id } });
      result = await tx.assignment.createMany({
        data: [
          { groupId: g.id, facultyId: d.adviserId, role: "ADVISER" },
          ...d.panelIds.map((facultyId) => ({
            groupId: g.id,
            facultyId,
            role: "PANELIST",
          })),
          ...(d.chairId
            ? [{ groupId: g.id, facultyId: d.chairId, role: "CHAIR" }]
            : []),
        ],
      });
      await flagAffected(tx, u);
    } else if (op === "attempt") {
      const d = z.object({ groupId: text, stageId: text }).parse(input);
      const previous = await tx.attempt.findMany({
        where: d,
        include: { sessions: true },
        orderBy: { number: "desc" },
      });
      if (
        previous.some(
          (a) =>
            !a.sessions.length ||
            a.sessions.some(
              (s) => s.status !== "COMPLETED" && s.status !== "CANCELLED",
            ),
        )
      )
        throw new Error(
          "Resolve the previous attempt before creating a repeat defense",
        );
      result = await tx.attempt.create({
        data: { ...d, number: (previous[0]?.number ?? 0) + 1 },
      });
    } else if (op === "priority") {
      const d = z
        .object({ attemptId: text, priority: integer(0, 100) })
        .parse(input);
      result = await tx.attempt.update({
        where: { id: d.attemptId },
        data: { priority: d.priority },
      });
    } else if (op === "archiveGroup") {
      const d = z.object({ groupId: text, reason: text }).parse(input);
      if (
        await tx.defenseSession.count({
          where: {
            attempt: { groupId: d.groupId },
            status: { in: ["DRAFT", "PUBLISHED"] },
          },
        })
      )
        throw new Error("Resolve active defense bookings before archiving");
      await tx.membership.updateMany({
        where: { groupId: d.groupId },
        data: { active: false },
      });
      result = await tx.thesisGroup.update({
        where: { id: d.groupId },
        data: { active: false },
      });
    } else if (op === "settings") {
      const d = z
        .object({
          name: text,
          logo: z.string().regex(/^\/[\w./-]+$/),
          startDate: date,
          endDate: date,
          openTime: time,
          closeTime: time,
          buffer: integer(0, 120),
          panelists: integer(1, 10),
          chairRequired: z.boolean(),
          adviserRequired: z.boolean(),
          adviserAsPanelist: z.boolean(),
          facultyCanApprove: z.boolean(),
        })
        .parse(input);
      if (d.startDate > d.endDate || d.openTime >= d.closeTime)
        throw new Error("Invalid scheduling date range or college hours");
      const { name, logo, ...rules } = d;
      await tx.college.update({ where: { id: 1 }, data: { name, logo } });
      result = await tx.rules.update({ where: { id: 1 }, data: rules });
      await flagAffected(tx, u);
    } else if (op === "stageDuration") {
      const d = z.object({ id: text, duration: integer(15, 240) }).parse(input);
      result = await tx.stage.update({
        where: { id: d.id },
        data: { duration: d.duration },
      });
      await flagAffected(tx, u);
    } else if (op === "resolveRequest") {
      const d = z
        .object({ id: text, status: z.enum(["RESOLVED", "DECLINED"]) })
        .parse(input);
      result = await tx.changeRequest.update({
        where: { id: d.id },
        data: { status: d.status },
      });
    } else throw new Error("Unknown action");
    // Passwords and private request details are never put in the audit log.
    await audit(
      tx,
      u,
      op,
      ["user", "editUser"].includes(op)
        ? "Account updated (credentials omitted)"
        : JSON.stringify(input),
    );
    return result;
  });
}
export async function viewData(u: Actor) {
  const admin = u.role === "COORDINATOR";
  const groupScope = admin
    ? {}
    : {
        OR: [
          {
            memberships: { some: { active: true, student: { userId: u.id } } },
          },
          { assignments: { some: { faculty: { userId: u.id } } } },
        ],
      };
  const assigned = admin
    ? []
    : await db.assignment.findMany({
        where: { group: groupScope },
        select: { faculty: { select: { userId: true } } },
      });
  const facultyUserIds = [
    ...new Set([u.id, ...assigned.map((a) => a.faculty.userId)]),
  ];
  const [
    college,
    rules,
    programs,
    sections,
    terms,
    stages,
    rooms,
    groups,
    faculty,
    students,
    sessions,
    windows,
    notifications,
    requests,
    events,
    users,
  ] = await Promise.all([
    db.college.findUnique({ where: { id: 1 } }),
    db.rules.findUnique({ where: { id: 1 } }),
    db.program.findMany(),
    db.section.findMany({ include: { program: true } }),
    db.term.findMany(),
    db.stage.findMany(),
    db.room.findMany(),
    db.thesisGroup.findMany({
      where: groupScope,
      include: {
        term: true,
        section: { include: { program: true } },
        memberships: {
          include: {
            student: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        assignments: {
          include: {
            faculty: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
        attempts: true,
      },
      orderBy: { code: "asc" },
    }),
    db.faculty.findMany({
      where: admin ? {} : { userId: { in: facultyUserIds } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignments: {
          where: { role: "ADVISER", group: { active: true } },
          include: {
            group: { include: { memberships: { where: { active: true } } } },
          },
        },
      },
    }),
    db.student.findMany({
      where: admin ? {} : { userId: u.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    db.defenseSession.findMany({
      where: admin
        ? {}
        : {
            status: { not: "DRAFT" },
            participants: { some: { userId: u.id } },
          },
      include: { participants: true, history: true },
      orderBy: { start: "asc" },
    }),
    db.availability.findMany({
      where: admin ? {} : { userId: { in: facultyUserIds } },
      orderBy: { startTime: "asc" },
    }),
    db.notification.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.changeRequest.findMany({
      where: admin ? {} : { userId: u.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    admin
      ? db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
      : Promise.resolve([]),
    admin ? db.user.findMany({
      select: { id: true, name: true, email: true, role: true, mustChangePassword: true, twoFactorEnabled: true, student: { select: { number: true } } },
      orderBy: { name: "asc" },
    }) : Promise.resolve([]),
  ]);
  const publicFaculty = faculty.map((f) => ({
    ...f,
    load: f.assignments.reduce(
      (n, a) =>
        n + (f.capacityUnit === "GROUPS" ? 1 : a.group.memberships.length),
      0,
    ),
    assignments: admin || f.userId === u.id ? f.assignments : [],
  }));
  return {
    user: u,
    college,
    rules,
    programs,
    sections,
    terms,
    stages,
    rooms,
    groups,
    faculty: publicFaculty,
    students,
    sessions,
    windows,
    notifications,
    requests,
    events,
    users,
  };
}
