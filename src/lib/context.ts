import { Prisma } from "@prisma/client";
import { db } from "./db";
import type { Candidate, Context } from "./constraints";
export type Tx = Prisma.TransactionClient;
export async function context(tx: Tx = db): Promise<Context> {
  const [rules, windows, rooms, sessions] = await Promise.all([
    tx.rules.findUniqueOrThrow({ where: { id: 1 } }),
    tx.availability.findMany(),
    tx.room.findMany(),
    tx.defenseSession.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { participants: true },
    }),
  ]);
  return {
    rules,
    windows,
    rooms,
    bookings: sessions.map((s) => ({
      ...s,
      people: s.participants.map((p) => p.userId),
    })),
  };
}
export const attemptInclude = {
  stage: true,
  group: {
    include: {
      term: true,
      section: { include: { program: true } },
      memberships: {
        where: { active: true },
        include: { student: { include: { user: true } } },
      },
      assignments: { include: { faculty: { include: { user: true } } } },
    },
  },
} satisfies Prisma.AttemptInclude;
export async function candidates(tx: Tx = db): Promise<Candidate[]> {
  const attempts = await tx.attempt.findMany({
    where: { group: { active: true } },
    include: attemptInclude,
  });
  return attempts.map((a) => {
    const g = a.group;
    const faculty = (role: string) =>
      g.assignments
        .filter((s) => s.role === role)
        .map((s) => ({ ...s.faculty.user, faculty: s.faculty }));
    return {
      attemptId: a.id,
      groupId: g.id,
      code: g.code,
      title: g.title,
      readiness: a.readiness,
      priority: a.priority,
      readyAt: a.readyAt,
      stage: a.stage.name,
      duration: a.stage.duration,
      term: `${g.term.year} · ${g.term.semester}`,
      program: g.section.program.name,
      section: g.section.name,
      students: g.memberships.map((m) => m.student.user),
      adviser: faculty("ADVISER"),
      panel: faculty("PANELIST"),
      chair: faculty("CHAIR"),
      attendees: g.attendees,
    };
  });
}
