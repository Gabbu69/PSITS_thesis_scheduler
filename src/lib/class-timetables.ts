import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import type { Tx } from "./context";
import { coordinator, type Actor } from "./access";
import { audit, flagAffected, serialized } from "./scheduling";
import { local } from "./constraints";
import { PublicError } from "./validation";
import { assertNoClassOverlap, classMeetingSchema, sortMeetings, timetableSaveSchema, type ClassRevisionInput, type PublicTimetable } from "./class-timetable-rules";
export { protectedClassWindows } from "./class-timetable-windows";

const live = ["DRAFT", "SUBMITTED", "PUBLISHED"];
const include = {
  faculty: { select: { userId: true, user: { select: { name: true } } } },
  term: { select: { id: true, year: true, semester: true } },
  revisions: { include: { meetings: true, publisher: { select: { name: true } } }, orderBy: { number: "desc" as const } },
} satisfies Prisma.ClassTimetableInclude;
type Timetable = Prisma.ClassTimetableGetPayload<{ include: typeof include }>;
export class TimetableConflict extends PublicError {}
function checkVersion(table: { version: number } | null, version: number) {
  if ((table?.version ?? 0) !== version) throw new TimetableConflict("This timetable changed. Reload it before saving or publishing again.");
}
function authorize(user: Actor, table: { faculty: { userId: string } }) {
  if (user.role !== "COORDINATOR" && !(user.role === "FACULTY" && table.faculty.userId === user.id)) throw new PublicError("FORBIDDEN");
}
export function publicTimetable(table: Timetable): PublicTimetable | null {
  const r = table.revisions.find((r) => r.status === "PUBLISHED");
  if (!r?.publishedAt) return null;
  return {
    id: table.id, faculty: { id: table.facultyId, name: table.faculty.user.name }, term: table.term,
    effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo, publishedAt: r.publishedAt.toISOString(),
    meetings: r.meetings.map((m) => classMeetingSchema.parse(m)).sort(sortMeetings),
  };
}
export async function publishedClassTimetables(filters = new URLSearchParams()) {
  const termId = filters.get("term"), facultyId = filters.get("faculty"), weekday = filters.get("weekday");
  if (termId) z.string().max(200).parse(termId);
  if (facultyId) z.string().max(200).parse(facultyId);
  if (weekday !== null) z.string().regex(/^[0-6]$/, "Choose a valid weekday.").parse(weekday);
  const tables = await db.classTimetable.findMany({ where: { revisions: { some: { status: "PUBLISHED" } } }, include: { ...include, revisions: { ...include.revisions, where: { status: "PUBLISHED" } } } });
  const published = tables.flatMap((t) => { const row = publicTimetable(t); return row ? [row] : []; });
  const terms = [...new Map(published.map((r) => [r.term.id, r.term])).values()];
  const timetables = published.filter((r) => (!termId || r.term.id === termId) && (!facultyId || r.faculty.id === facultyId))
    .map((r) => ({ ...r, meetings: r.meetings.filter((m) => weekday === null || m.weekday === Number(weekday)) }))
    .sort((a, b) => a.faculty.name.localeCompare(b.faculty.name));
  return { terms, timetables };
}
type ReviewSession = { id: string; start: Date; end: Date; status: string; participants: { userId: string }[]; attempt: { group: { code: string } } };
function classDefenseConflicts(sessions: ReviewSession[], buffer: number, userId: string, revision: ClassRevisionInput) {
  return sessions.filter((s) => {
    if (!s.participants.some((p) => p.userId === userId)) return false;
    const date = local(s.start), start = local(s.start, "HH:mm"), end = local(new Date(s.end.getTime() + buffer * 60000), "HH:mm");
    const weekday = new Date(`${date}T12:00Z`).getUTCDay();
    return date >= revision.effectiveFrom && date <= revision.effectiveTo && revision.meetings.some((m) => m.weekday === weekday && start < m.endTime && m.startTime < end);
  }).map((s) => ({ id: s.id, code: s.attempt.group.code, start: s.start.toISOString(), status: s.status }));
}
export async function managedClassTimetables(user: Actor) {
  if (!["FACULTY", "COORDINATOR"].includes(user.role)) throw new PublicError("FORBIDDEN");
  // A repeatable read keeps the coordinator's review and revision counter consistent.
  return db.$transaction(async (tx) => {
    const tables = await tx.classTimetable.findMany({ where: user.role === "COORDINATOR" ? {} : { faculty: { userId: user.id } }, include });
    const faculty = await tx.faculty.findMany({ where: user.role === "COORDINATOR" ? {} : { userId: user.id }, select: { id: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } });
    const terms = await tx.term.findMany({ orderBy: [{ year: "desc" }, { semester: "asc" }] });
    const rules = await tx.rules.findUnique({ where: { id: 1 } });
    const sessions = await tx.defenseSession.findMany({
      where: { status: { in: ["DRAFT", "PUBLISHED"] }, ...(user.role === "COORDINATOR" ? {} : { participants: { some: { userId: user.id } } }) },
      select: { id: true, start: true, end: true, status: true, participants: { select: { userId: true } }, attempt: { select: { group: { select: { code: true } } } } },
    });
    return { faculty: faculty.map((f) => ({ id: f.id, name: f.user.name })), terms,
      timetables: tables.map((t) => ({ id: t.id, facultyId: t.facultyId, termId: t.termId, version: t.version,
        revisions: t.revisions.map((r) => ({ id: r.id, number: r.number, status: r.status,
          effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo, publishedAt: r.publishedAt?.toISOString() ?? null,
          publisherName: r.publisher?.name ?? null,
          meetings: r.meetings.map((m) => classMeetingSchema.parse(m)).sort(sortMeetings),
          affectedDefenses: live.includes(r.status) ? classDefenseConflicts(sessions, rules?.buffer ?? 0, t.faculty.userId, r) : [],
        })),
      })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
}
const transition = z.object({ id: z.string().min(1).max(200), version: z.number().int().min(1), confirmEmpty: z.boolean().optional() });
export async function mutateClassTimetable(user: Actor, op: "save" | "submit" | "publish", input: unknown) {
  if (!["FACULTY", "COORDINATOR"].includes(user.role)) throw new PublicError("FORBIDDEN");
  if (op === "publish") coordinator(user);
  return serialized(async (tx) => {
    if (op === "save") {
      const d = timetableSaveSchema.parse(input);
      const faculty = await tx.faculty.findUniqueOrThrow({ where: { id: d.facultyId }, select: { userId: true } });
      authorize(user, { faculty });
      await tx.term.findUniqueOrThrow({ where: { id: d.termId } });
      let table = await tx.classTimetable.findUnique({ where: { facultyId_termId: { facultyId: d.facultyId, termId: d.termId } }, include });
      checkVersion(table, d.version);
      const others = await tx.classTimetableRevision.findMany({ where: {
        status: { in: live }, timetable: { facultyId: d.facultyId, ...(table ? { id: { not: table.id } } : {}) },
      }, include: { meetings: true } });
      assertNoClassOverlap(d, others);
      if (!table) table = await tx.classTimetable.create({ data: { facultyId: d.facultyId, termId: d.termId }, include });
      const working = table.revisions.find((r) => ["DRAFT", "SUBMITTED"].includes(r.status));
      const data = { effectiveFrom: d.effectiveFrom, effectiveTo: d.effectiveTo, status: "DRAFT", meetings: { create: d.meetings } };
      if (working) {
        await tx.classMeeting.deleteMany({ where: { revisionId: working.id } });
        await tx.classTimetableRevision.update({ where: { id: working.id }, data });
      } else await tx.classTimetableRevision.create({ data: { ...data, timetableId: table.id, number: (table.revisions[0]?.number ?? 0) + 1 } });
      await tx.classTimetable.update({ where: { id: table.id }, data: { version: { increment: 1 } } });
      await audit(tx, user, "CLASS_TIMETABLE_SAVED", table.id);
      await flagAffected(tx, user);
      return { id: table.id };
    }
    const d = transition.parse(input);
    const table = await tx.classTimetable.findUniqueOrThrow({ where: { id: d.id }, include });
    authorize(user, table);
    checkVersion(table, d.version);
    const working = table.revisions.find((r) => ["DRAFT", "SUBMITTED"].includes(r.status));
    if (!working) throw new PublicError("Save a draft before submitting a timetable.");
    if (op === "submit") {
      if (working.status !== "DRAFT") throw new TimetableConflict("This timetable is already submitted. Reload to see its status.");
      await tx.classTimetableRevision.update({ where: { id: working.id }, data: { status: "SUBMITTED" } });
      const admins = await tx.user.findMany({ where: { role: "COORDINATOR" }, select: { id: true } });
      await tx.notification.createMany({ data: admins.map((a) => ({ userId: a.id, message: `${table.faculty.user.name} submitted a class timetable for ${table.term.year} · ${table.term.semester}. Review it in Class schedules.` })) });
    } else {
      if (working.status !== "SUBMITTED") throw new PublicError("Submit this draft for review before publication.");
      if (!working.meetings.length && !d.confirmEmpty) throw new PublicError("Confirm retirement of the published timetable before publishing an empty revision.");
      await tx.classTimetableRevision.updateMany({ where: { timetableId: table.id, status: "PUBLISHED" }, data: { status: "SUPERSEDED" } });
      await tx.classTimetableRevision.update({ where: { id: working.id }, data: { status: "PUBLISHED", publisherId: user.id, publishedAt: new Date() } });
      await tx.notification.create({ data: { userId: table.faculty.userId, message: `Your class timetable for ${table.term.year} · ${table.term.semester} was ${working.meetings.length ? "published on the login page" : "retired"}.` } });
      await flagAffected(tx, user);
    }
    await tx.classTimetable.update({ where: { id: table.id }, data: { version: { increment: 1 } } });
    await audit(tx, user, `CLASS_TIMETABLE_${op.toUpperCase()}`, `${table.id} revision ${working.number}`);
    return { id: table.id };
  });
}
