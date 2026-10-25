import { PublicError, draftSelection } from "./validation";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { candidates, context, type Tx } from "./context";
import {
  generate,
  required,
  validate,
  type Candidate,
  type Proposal,
  type Context,
} from "./constraints";
import { coordinator, type Actor } from "./access";
// Every scheduling, availability, roster, rule and assignment mutation shares this lock.
// READ COMMITTED obtains fresh records AFTER acquiring the lock. Do not use a stale snapshot.
export async function serialized<T>(fn: (tx: Tx) => Promise<T>) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(724501)`;
      return fn(tx);
    },
    {
      maxWait: 15000,
      timeout: 60000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );
}
export const audit = (tx: Tx, user: Actor, action: string, details: string) =>
  tx.auditEvent.create({ data: { actorId: user.id, action, details } });
export function snapshot(c: Candidate, p: Proposal, ctx: Context) {
  const names = (people: Candidate["students"]) => people.map(({ id, name }) => ({ id, name }));
  return JSON.parse(
    JSON.stringify({
      ...c,
      students: names(c.students),
      adviser: names(c.adviser),
      panel: names(c.panel),
      chair: names(c.chair),
      ...p,
      room: ctx.rooms.find((r) => r.id === p.roomId),
      buffer: ctx.rules.buffer,
    }),
  ) as Prisma.InputJsonValue;
}
async function notify(tx: Tx, userIds: string[], message: string) {
  await tx.notification.createMany({
    data: [...new Set(userIds)].map((userId) => ({ userId, message })),
  });
}
export async function generateDraft(
  user: Actor,
  selection: {
    termId: string;
    stageId: string;
    from: string;
    to: string;
    rooms: string[];
    attemptIds?: string[];
  },
) {
  coordinator(user);
  selection = draftSelection.parse(selection);
  return serialized(async (tx) => {
    if (
      selection.from > selection.to ||
      (new Date(selection.to).getTime() - new Date(selection.from).getTime()) /
        86400000 >
        93
    )
      throw new PublicError("Choose a valid date range of at most 94 days");
    const ctx = await context(tx);
    const eligible = await tx.attempt.findMany({
      where: {
        stageId: selection.stageId,
        group: { termId: selection.termId },
        ...(selection.attemptIds?.length
          ? { id: { in: selection.attemptIds } }
          : {}),
      },
    });
    const ids = eligible.map((a) => a.id);
    await tx.defenseSession.deleteMany({
      where: { attemptId: { in: ids }, status: "DRAFT", locked: false },
    });
    // Reload retained locked drafts after deletion.
    ctx.bookings = (await context(tx)).bookings;
    const cs = (await candidates(tx)).filter((c) => ids.includes(c.attemptId));
    const result = generate(
      cs,
      ctx,
      selection.rooms,
      selection.from,
      selection.to,
    );
    for (const p of result.proposals) {
      const c = cs.find((c) => c.attemptId === p.attemptId)!;
      await tx.defenseSession.create({
        data: {
          ...p,
          snapshot: snapshot(c, p, ctx),
          participants: {
            create: required(c, ctx.rules).map((p) => ({
              userId: p.id,
              role: p.faculty ? "FACULTY" : "STUDENT",
            })),
          },
        },
      });
      await tx.attempt.update({
        where: { id: p.attemptId },
        data: { waitingReason: null },
      });
    }
    for (const w of result.waiting)
      await tx.attempt.update({
        where: { id: w.attemptId },
        data: { waitingReason: w.reason },
      });
    await audit(
      tx,
      user,
      "GENERATE_DRAFT",
      `${result.proposals.length} groups; ${result.students} students; ${result.waiting.length} waiting`,
    );
    return result;
  });
}
export async function publish(user: Actor, ids: string[]) {
  coordinator(user);
  return serialized(async (tx) => {
    const ctx = await context(tx),
      cs = await candidates(tx);
    // Unrelated drafts reserve nothing. Validate this publication batch together
    // with real reservations; a later competing publication will see the winner.
    ctx.bookings = ctx.bookings.filter(
      (b) => b.status !== "DRAFT" || ids.includes(b.id),
    );
    const drafts = await tx.defenseSession.findMany({
      where: { id: { in: ids }, status: "DRAFT" },
    });
    if (drafts.length !== ids.length || !ids.length)
      throw new PublicError("Draft changed. Refresh the preview before publishing.");
    for (const s of drafts) {
      const c = cs.find((c) => c.attemptId === s.attemptId);
      if (!c) throw new PublicError("Group no longer active");
      const errors = validate(c, s, ctx, s.id);
      if (errors.length) throw new PublicError(`${c.code}: ${errors.join("; ")}`);
      const snap = snapshot(c, s, ctx);
      await tx.defenseSession.update({
        where: { id: s.id },
        data: {
          status: "PUBLISHED",
          version: 1,
          snapshot: snap,
          participants: {
            deleteMany: {},
            create: required(c, ctx.rules).map((p) => ({
              userId: p.id,
              role: p.faculty ? "FACULTY" : "STUDENT",
            })),
          },
          history: {
            create: {
              version: 1,
              snapshot: snap,
              reason: "Initial publication",
              actorId: user.id,
            },
          },
        },
      });
      await notify(
        tx,
        required(c, ctx.rules).map((p) => p.id),
        `${c.code}: defense published (version 1). View your schedule for time and location.`,
      );
    }
    await audit(tx, user, "PUBLISH", ids.join(", "));
    return { published: drafts.length };
  });
}
export async function changeSession(
  user: Actor,
  id: string,
  action: string,
  reason: string,
  replacement?: { roomId: string; start: Date },
) {
  coordinator(user);
  return serialized(async (tx) => {
    const s = await tx.defenseSession.findUniqueOrThrow({
      where: { id },
      include: { participants: true },
    });
    if (action === "LOCK") {
      if (s.status !== "DRAFT") throw new PublicError("Only drafts can be locked");
      await audit(tx, user, "LOCK_DRAFT", `${id}: ${!s.locked}`);
      return tx.defenseSession.update({
        where: { id },
        data: { locked: !s.locked },
      });
    }
    if (!reason.trim()) throw new PublicError("A reason is required");
    if (action === "RESCHEDULE" || action === "EDIT") {
      if (
        (action === "EDIT" && s.status !== "DRAFT") ||
        (action === "RESCHEDULE" && s.status !== "PUBLISHED")
      )
        throw new PublicError("Invalid schedule transition");
      if (!replacement) throw new PublicError("Replacement time and room required");
      const ctx = await context(tx),
        c = (await candidates(tx)).find((c) => c.attemptId === s.attemptId);
      if (!c) throw new PublicError("Group no longer active");
      if (action === "RESCHEDULE")
        ctx.bookings = ctx.bookings.filter((b) => b.status !== "DRAFT");
      const p = {
        attemptId: s.attemptId,
        ...replacement,
        end: new Date(replacement.start.getTime() + c.duration * 60000),
      };
      const errors = validate(c, p, ctx, id);
      if (errors.length) throw new PublicError(errors.join("; "));
      const snap = snapshot(c, p, ctx),
        version = s.status === "DRAFT" ? 0 : s.version + 1;
      const updated = await tx.defenseSession.update({
        where: { id },
        data: {
          ...p,
          snapshot: snap,
          version,
          attention: false,
          participants: {
            deleteMany: {},
            create: required(c, ctx.rules).map((p) => ({
              userId: p.id,
              role: p.faculty ? "FACULTY" : "STUDENT",
            })),
          },
          ...(version
            ? {
                history: {
                  create: { version, snapshot: snap, reason, actorId: user.id },
                },
              }
            : {}),
        },
      });
      if (version)
        await notify(
          tx,
          [
            ...s.participants.map((p) => p.userId),
            ...required(c, ctx.rules).map((p) => p.id),
          ],
          `${c.code}: schedule changed (version ${version}). ${reason}`,
        );
      await audit(tx, user, action, `${id}: ${reason}`);
      return updated;
    }
    if (!["CANCEL", "COMPLETE"].includes(action) || s.status !== "PUBLISHED")
      throw new PublicError("Only a published session can be completed or cancelled");
    if (action === "COMPLETE" && s.end > new Date())
      throw new PublicError("A future defense cannot be marked completed");
    const status = action === "CANCEL" ? "CANCELLED" : "COMPLETED",
      version = s.version + 1;
    const updated = await tx.defenseSession.update({
      where: { id },
      data: {
        status,
        version,
        attention: false,
        history: {
          create: {
            version,
            snapshot: s.snapshot as Prisma.InputJsonValue,
            reason,
            actorId: user.id,
          },
        },
      },
    });
    await notify(
      tx,
      s.participants.map((p) => p.userId),
      `Defense ${status.toLowerCase()} (version ${version}). ${reason}`,
    );
    await audit(tx, user, action, `${id}: ${reason}`);
    return updated;
  });
}
export async function flagAffected(tx: Tx, user: Actor) {
  const ctx = await context(tx),
    cs = await candidates(tx);
  ctx.bookings = ctx.bookings.filter((b) => b.status !== "DRAFT");
  const sessions = await tx.defenseSession.findMany({
    where: { status: "PUBLISHED" },
  });
  for (const s of sessions) {
    const c = cs.find((c) => c.attemptId === s.attemptId);
    const errors = c ? validate(c, s, ctx, s.id) : ["Group no longer active"];
    const attention = errors.length > 0;
    if (s.attention !== attention) {
      await tx.defenseSession.update({
        where: { id: s.id },
        data: { attention },
      });
    }
    // Notify once per transition into review, and clear the flag when repaired.
    if (attention && !s.attention) {
      const admins = await tx.user.findMany({ where: { role: "COORDINATOR" } });
      await notify(
        tx,
        admins.map((a) => a.id),
        `Defense ${c?.code ?? s.id} requires review: ${errors.join("; ")}. Reservation retained.`,
      );
    }
  }
  await audit(
    tx,
    user,
    "AVAILABILITY_OR_RULE_REVIEW",
    "Published sessions rechecked; reservations retained",
  );
}
