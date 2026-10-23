import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
export const TZ = "Asia/Manila";
export const local = (date: Date | string, pattern = "yyyy-MM-dd") =>
  formatInTimeZone(date, TZ, pattern);
export const instant = (date: string, time: string) =>
  fromZonedTime(`${date}T${time}:00`, TZ);
export type Window = {
  userId: string | null;
  roomId: string | null;
  kind: string;
  date: string | null;
  weekday: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  startTime: string;
  endTime: string;
  label: string;
};
export type Person = {
  id: string;
  name: string;
  faculty?: { dailyLimit: number; weeklyLimit: number | null } | null;
};
export type Candidate = {
  attemptId: string;
  groupId: string;
  code: string;
  title: string;
  readiness: string;
  priority: number;
  readyAt: Date | null;
  stage: string;
  duration: number;
  term: string;
  program: string;
  section: string;
  students: Person[];
  adviser: Person[];
  panel: Person[];
  chair: Person[];
  attendees: number;
};
export type Booking = {
  id: string;
  attemptId: string;
  roomId: string;
  start: Date;
  end: Date;
  status: string;
  people: string[];
};
export type Policy = {
  startDate: string;
  endDate: string;
  openTime: string;
  closeTime: string;
  buffer: number;
  panelists: number;
  chairRequired: boolean;
  adviserRequired: boolean;
  adviserAsPanelist: boolean;
};
export type Venue = {
  id: string;
  name: string;
  building: string;
  location: string;
  capacity: number;
  active: boolean;
};
export type Context = {
  rules: Policy;
  windows: Window[];
  bookings: Booking[];
  rooms: Venue[];
};
export type Proposal = {
  attemptId: string;
  roomId: string;
  start: Date;
  end: Date;
};
export function required(c: Candidate, r: Policy): Person[] {
  return [
    ...new Map(
      [
        ...c.students,
        ...(r.adviserRequired ? c.adviser : []),
        ...c.panel,
        ...c.chair,
      ].map((p) => [p.id, p]),
    ).values(),
  ];
}
const overlaps = (a: Date, b: Date, c: Date, d: Date) => a < d && c < b;
export function availability(
  windows: Window[],
  date: string,
  start: string,
  end: string,
): string | null {
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const specific = windows.filter((w) => w.date === date);
  const weekly = windows.filter(
    (w) =>
      w.date === null &&
      w.weekday === weekday &&
      (!w.effectiveFrom || w.effectiveFrom <= date) &&
      (!w.effectiveTo || w.effectiveTo >= date),
  );
  const blocked = [...specific, ...weekly].filter((w) => w.kind === "BLOCK");
  if (blocked.some((w) => start < w.endTime && w.startTime < end))
    return "Unavailable period or class conflict (including buffer)";
  const positives = specific.some((w) => w.kind === "AVAILABLE")
    ? specific.filter((w) => w.kind === "AVAILABLE")
    : weekly.filter((w) => w.kind === "AVAILABLE");
  if (!windows.some((w) => w.kind === "AVAILABLE"))
    return "Availability not submitted";
  // Merge adjacent available ranges before testing containment.
  const ranges = positives
    .map((w) => [w.startTime, w.endTime])
    .sort((a, b) => a[0].localeCompare(b[0]));
  const merged: string[][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1])
      last[1] = last[1] > range[1] ? last[1] : range[1];
    else merged.push([...range]);
  }
  return merged.some((w) => w[0] <= start && w[1] >= end)
    ? null
    : "No common availability during the selected interval";
}
export function validate(
  c: Candidate,
  p: Proposal,
  ctx: Context,
  ignoreId?: string,
): string[] {
  const { rules: r } = ctx;
  const errors: string[] = [];
  const date = local(p.start),
    start = local(p.start, "HH:mm");
  const bufferedEnd = new Date(p.end.getTime() + r.buffer * 60000),
    end = local(bufferedEnd, "HH:mm");
  if (c.readiness !== "READY")
    errors.push("Group not yet approved for defense");
  if (c.students.length === 0)
    errors.push("Group has no active student members");
  if (c.adviser.length !== 1)
    errors.push("Exactly one adviser must be assigned");
  if (
    !r.adviserAsPanelist &&
    c.panel.some((p) => c.adviser.some((a) => a.id === p.id))
  )
    errors.push("Adviser must be separate from the panel");
  if (new Set(c.panel.map((p) => p.id)).size !== r.panelists)
    errors.push(
      `Required panelists not assigned: ${r.panelists} distinct panelists needed`,
    );
  if (
    r.chairRequired &&
    (c.chair.length !== 1 || !c.panel.some((p) => p.id === c.chair[0]?.id))
  )
    errors.push("One panel chair must be selected from assigned panelists");
  if (p.end.getTime() - p.start.getTime() !== c.duration * 60000)
    errors.push("Defense duration does not match stage rules");
  if (
    date < r.startDate ||
    date > r.endDate ||
    start < r.openTime ||
    end > r.closeTime ||
    local(bufferedEnd) !== date
  )
    errors.push("Outside permitted college dates or hours (including buffer)");
  const collegeBlock = ctx.windows.filter(
    (w) => !w.userId && !w.roomId && w.kind === "BLOCK",
  );
  if (
    collegeBlock.some(
      (w) =>
        (w.date === date ||
          (w.date === null &&
            w.weekday === new Date(date + "T12:00Z").getUTCDay() &&
            (!w.effectiveFrom || w.effectiveFrom <= date) &&
            (!w.effectiveTo || w.effectiveTo >= date))) &&
        start < w.endTime &&
        w.startTime < end,
    )
  )
    errors.push("College holiday or blocked period");
  const room = ctx.rooms.find((v) => v.id === p.roomId);
  const people = required(c, r);
  if (!room?.active) errors.push("Room is unavailable");
  else {
    if (room.capacity < people.length + c.attendees)
      errors.push("Room seating capacity is insufficient");
    const issue = availability(
      ctx.windows.filter((w) => w.roomId === room.id),
      date,
      start,
      end,
    );
    if (issue) errors.push(`Room ${room.name}: ${issue}`);
  }
  const bookings = ctx.bookings.filter(
    (b) => b.id !== ignoreId && b.status !== "CANCELLED",
  );
  if (bookings.some((b) => b.attemptId === c.attemptId))
    errors.push("Group already has an active booking for this defense attempt");
  if (
    bookings.some(
      (b) =>
        b.roomId === p.roomId &&
        overlaps(
          p.start,
          bufferedEnd,
          b.start,
          new Date(b.end.getTime() + r.buffer * 60000),
        ),
    )
  )
    errors.push("Room booking overlaps (including buffer)");
  for (const person of people) {
    const issue = availability(
      ctx.windows.filter((w) => w.userId === person.id),
      date,
      start,
      end,
    );
    if (issue) errors.push(`${person.name}: ${issue}`);
    const assigned = bookings.filter((b) => b.people.includes(person.id));
    if (
      assigned.some((b) =>
        overlaps(
          p.start,
          bufferedEnd,
          b.start,
          new Date(b.end.getTime() + r.buffer * 60000),
        ),
      )
    )
      errors.push(`${person.name}: overlapping defense across committee roles`);
    if (person.faculty) {
      if (
        assigned.filter((b) => local(b.start) === date).length >=
        person.faculty.dailyLimit
      )
        errors.push(`${person.name}: Faculty daily limit reached`);
      if (
        person.faculty.weeklyLimit !== null &&
        assigned.filter(
          (b) => local(b.start, "RRRR-'W'II") === local(p.start, "RRRR-'W'II"),
        ).length >= person.faculty.weeklyLimit
      )
        errors.push(`${person.name}: Faculty weekly limit reached`);
    }
  }
  return [...new Set(errors)];
}
export function generate(
  candidates: Candidate[],
  ctx: Context,
  roomIds: string[],
  from: string,
  to: string,
  maxChecks = 20000,
) {
  const proposals: Proposal[] = [],
    waiting: { attemptId: string; code: string; reason: string }[] = [];
  let checks = 0;
  const bookings = [...ctx.bookings];
  const sorted = [...candidates].sort(
    (a, b) =>
      b.priority - a.priority ||
      (a.readyAt?.getTime() ?? Infinity) - (b.readyAt?.getTime() ?? Infinity) ||
      a.code.localeCompare(b.code) ||
      a.attemptId.localeCompare(b.attemptId),
  );
  for (const c of sorted) {
    if (bookings.some((b) => b.attemptId === c.attemptId)) continue;
    const reasons = new Map<string, number>();
    let found = false;
    outer: for (
      let day = new Date(from + "T00:00:00Z");
      day <= new Date(to + "T00:00:00Z");
      day = new Date(day.getTime() + 86400000)
    ) {
      const date = day.toISOString().slice(0, 10);
      for (
        let t = instant(date, ctx.rules.openTime);
        t < instant(date, ctx.rules.closeTime);
        t = new Date(t.getTime() + 15 * 60000)
      ) {
        for (const roomId of [...roomIds].sort()) {
          if (++checks > maxChecks) break outer;
          const p = {
            attemptId: c.attemptId,
            roomId,
            start: t,
            end: new Date(t.getTime() + c.duration * 60000),
          };
          const errors = validate(c, p, { ...ctx, bookings });
          if (!errors.length) {
            proposals.push(p);
            bookings.push({
              ...p,
              id: `proposed-${c.attemptId}`,
              status: "DRAFT",
              people: required(c, ctx.rules).map((p) => p.id),
            });
            found = true;
            break outer;
          }
          errors.forEach((e) => reasons.set(e, (reasons.get(e) ?? 0) + 1));
        }
      }
    }
    if (!found)
      waiting.push({
        attemptId: c.attemptId,
        code: c.code,
        reason:
          checks > maxChecks
            ? "No valid slot found within the search limit. Expand the dates or run a smaller batch."
            : [...reasons.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([s]) => s)
                .join("; ") +
              " — Request additional availability, expand dates, or review assignments.",
      });
  }
  return {
    proposals,
    waiting,
    checks,
    students: proposals.reduce(
      (n, p) =>
        n +
        (candidates.find((c) => c.attemptId === p.attemptId)?.students.length ??
          0),
      0,
    ),
  };
}
export function advisingIssue(
  load: number,
  limit: number,
  increment: number,
  accepting: boolean,
) {
  return !accepting
    ? "Faculty is not accepting new advisees"
    : load + increment > limit
      ? `Advising capacity exceeded: ${load} of ${limit}`
      : null;
}
