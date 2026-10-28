import type { Tx } from "./context";
import { classWindows } from "./class-timetable-rules";

// Both saved and published revisions protect teaching time until replacement publication.
export async function protectedClassWindows(tx: Tx) {
  const tables = await tx.classTimetable.findMany({
    include: { faculty: { select: { userId: true } }, revisions: { where: { status: { in: ["DRAFT", "SUBMITTED", "PUBLISHED"] } }, include: { meetings: true } } },
  });
  return tables.flatMap((t) => t.revisions.flatMap((r) => classWindows(t.faculty.userId, r)));
}
