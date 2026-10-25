import { z } from "zod";

const person = z.object({ id: z.string(), name: z.string() });
// Also sanitize existing snapshots, which may contain full historical User records.
export const publicSnapshot = z.object({
  attemptId: z.string(), groupId: z.string(), code: z.string(), title: z.string(),
  stage: z.string(), term: z.string(), program: z.string(), section: z.string(),
  start: z.string(), end: z.string(), roomId: z.string(),
  students: z.array(person), adviser: z.array(person), panel: z.array(person), chair: z.array(person),
  room: z.object({ id: z.string(), name: z.string(), building: z.string(), location: z.string() }),
});
export type PublicSnapshot = z.infer<typeof publicSnapshot>;
export function snapshotIncludes(snapshot: PublicSnapshot, userId: string) {
  return [...snapshot.students, ...snapshot.adviser, ...snapshot.panel, ...snapshot.chair].some((p) => p.id === userId);
}
