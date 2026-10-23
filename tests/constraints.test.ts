import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validate,
  generate,
  advisingIssue,
  availability,
  instant,
  type Candidate,
  type Context,
  type Proposal,
  type Window,
} from "../src/lib/constraints";
const people = ["adviser", "p1", "p2", "p3"].map((id) => ({
  id,
  name: id,
  faculty: { dailyLimit: 4, weeklyLimit: 12 },
}));
const c: Candidate = {
  attemptId: "a",
  groupId: "g",
  code: "G01",
  title: "Fictional Research",
  readiness: "READY",
  priority: 0,
  readyAt: new Date(),
  stage: "Proposal",
  duration: 45,
  term: "2026",
  program: "BSIT",
  section: "4A",
  students: ["s1", "s2", "s3"].map((id) => ({ id, name: id })),
  adviser: [people[0]],
  panel: people.slice(1),
  chair: [people[1]],
  attendees: 0,
};
const p: Proposal = {
  attemptId: "a",
  roomId: "r",
  start: instant("2026-11-02", "08:00"),
  end: instant("2026-11-02", "08:45"),
};
const w = (userId: string | null, roomId: string | null): Window => ({
  userId,
  roomId,
  kind: "AVAILABLE",
  date: null,
  weekday: 1,
  effectiveFrom: null,
  effectiveTo: null,
  startTime: "08:00",
  endTime: "17:00",
  label: "",
});
function context(): Context {
  return {
    rules: {
      startDate: "2026-11-02",
      endDate: "2026-11-06",
      openTime: "08:00",
      closeTime: "17:00",
      buffer: 15,
      panelists: 3,
      chairRequired: true,
      adviserRequired: true,
      adviserAsPanelist: false,
    },
    rooms: [
      {
        id: "r",
        name: "201",
        building: "Computing",
        location: "2F",
        capacity: 10,
        active: true,
      },
    ],
    windows: [...c.students, ...people]
      .map((p) => w(p.id, null))
      .concat([w(null, "r")]),
    bookings: [],
  };
}
test("three members produce one proposed session and three accommodated students", () => {
  const result = generate([c], context(), ["r"], "2026-11-02", "2026-11-02");
  assert.equal(result.proposals.length, 1);
  assert.equal(result.students, 3);
});
test("8/8 adviser cannot get ninth group but existing defense validates", () => {
  assert.match(advisingIssue(8, 8, 1, true)!, /capacity exceeded/);
  assert.deepEqual(validate(c, p, context()), []);
});
test("adviser cannot attend overlapping panel service; person deduplicated across chair/panel", () => {
  const ctx = context();
  ctx.bookings.push({
    id: "other",
    attemptId: "other",
    roomId: "other",
    start: p.start,
    end: p.end,
    status: "PUBLISHED",
    people: ["adviser"],
  });
  assert(validate(c, p, ctx).some((s) => s.includes("overlapping defense")));
});
test("participant and room blocks include turnover buffer", () => {
  for (const target of ["s1", "r"]) {
    const ctx = context();
    ctx.windows.push({
      ...w(target === "r" ? null : target, target === "r" ? "r" : null),
      kind: "BLOCK",
      date: "2026-11-02",
      weekday: null,
      startTime: "08:45",
      endTime: "09:00",
    });
    assert(validate(c, p, ctx).some((s) => s.includes("including buffer")));
  }
});
test("fourth daily session allowed, fifth rejected, completed counts and cancelled releases", () => {
  const ctx = context();
  for (let i = 0; i < 3; i++)
    ctx.bookings.push({
      id: "old" + i,
      attemptId: "old" + i,
      roomId: "other",
      start: instant("2026-11-02", `${10 + i}:00`),
      end: instant("2026-11-02", `${10 + i}:45`),
      status: i === 0 ? "COMPLETED" : "PUBLISHED",
      people: ["adviser"],
    });
  assert.deepEqual(validate(c, p, ctx), []);
  ctx.bookings.push({
    ...ctx.bookings[0],
    id: "four",
    attemptId: "four",
    start: instant("2026-11-02", "14:00"),
    end: instant("2026-11-02", "14:45"),
  });
  assert(validate(c, p, ctx).some((s) => s.includes("daily limit")));
  ctx.bookings[3].status = "CANCELLED";
  assert.deepEqual(validate(c, p, ctx), []);
});
test("missing availability produces a useful waiting list reason", () => {
  const ctx = context();
  ctx.windows = ctx.windows.filter((w) => w.userId !== "s1");
  const result = generate([c], ctx, ["r"], "2026-11-02", "2026-11-02");
  assert.equal(result.proposals.length, 0);
  assert.match(result.waiting[0].reason, /Availability not submitted/);
});
test("specific availability replaces weekly windows and blocks override", () => {
  const windows = [
    w("s1", null),
    {
      ...w("s1", null),
      date: "2026-11-02",
      weekday: null,
      startTime: "10:00",
      endTime: "11:00",
    },
  ];
  assert.match(
    availability(windows, "2026-11-02", "08:00", "09:00")!,
    /No common/,
  );
  assert.equal(availability(windows, "2026-11-02", "10:00", "11:00"), null);
});
test("active attempt duplicate is blocked and room capacity includes distinct people", () => {
  const ctx = context();
  ctx.bookings.push({ ...p, id: "duplicate", status: "DRAFT", people: [] });
  assert(validate(c, p, ctx).some((s) => s.includes("active booking")));
  ctx.bookings = [];
  ctx.rooms[0].capacity = 6;
  assert(validate(c, p, ctx).some((s) => s.includes("seating")));
});
test("UTC persistence maps to correct Manila date and bounded search is explicit", () => {
  assert.equal(p.start.toISOString(), "2026-11-02T00:00:00.000Z");
  const ctx = context();
  ctx.windows = [];
  assert.match(
    generate([c], ctx, ["r"], "2026-11-02", "2026-11-02", 1).waiting[0].reason,
    /search limit/,
  );
});
test("buffer, college hours, weekly cap, and adviser separation are hard constraints", () => {
  const ctx = context();
  const late = {
    ...p,
    start: instant("2026-11-02", "16:15"),
    end: instant("2026-11-02", "17:00"),
  };
  assert(
    validate(c, late, ctx).some((s) => s.includes("college dates or hours")),
  );
  const bad = { ...c, panel: [people[0], ...people.slice(1, 3)] };
  assert(validate(bad, p, ctx).some((s) => s.includes("separate")));
});
test("weekly cap counts attendance on other days of the same Manila ISO week", () => {
  const ctx = context();
  for (let i = 0; i < 12; i++) {
    const date = `2026-11-0${3 + Math.floor(i / 4)}`,
      hour = String(8 + (i % 4)).padStart(2, "0");
    ctx.bookings.push({
      id: "week" + i,
      attemptId: "week" + i,
      roomId: "other",
      start: instant(date, hour + ":00"),
      end: instant(date, hour + ":45"),
      status: "COMPLETED",
      people: ["adviser"],
    });
  }
  assert(validate(c, p, ctx).some((s) => s.includes("weekly limit")));
  ctx.bookings[11].status = "CANCELLED";
  assert.deepEqual(validate(c, p, ctx), []);
});
