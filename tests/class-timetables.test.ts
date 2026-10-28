import { test } from "node:test";
import assert from "node:assert/strict";
import { assertNoClassOverlap, classWindows, defaultTimetableTerm, sortMeetings, timetableSaveSchema, type ClassMeetingInput, type PublicTimetable } from "../src/lib/class-timetable-rules";
import { availability } from "../src/lib/constraints";

const meeting: ClassMeetingInput = { subjectCode: "IT 101", subjectName: "Computing", section: "1A", location: "Room 101", weekday: 1, startTime: "09:00", endTime: "10:00" };
const revision = { effectiveFrom: "2026-11-02", effectiveTo: "2026-11-30", meetings: [meeting] };
test("class timetable validation rejects malformed, overnight, duplicate, and overlapping meetings", () => {
  const input = { facultyId: "f", termId: "t", version: 0, ...revision };
  assert(timetableSaveSchema.safeParse(input).success);
  for (const change of [{ effectiveFrom: "2026-02-31" }, { effectiveTo: "2026-10-01" }, { version: -1 }, { meetings: [{ ...meeting, weekday: 7 }] }, { meetings: [{ ...meeting, startTime: "23:00", endTime: "01:00" }] }, { meetings: [{ ...meeting, subjectName: " " }] }])
    assert(!timetableSaveSchema.safeParse({ ...input, ...change }).success);
  assert.throws(() => assertNoClassOverlap({ ...revision, meetings: [meeting, meeting] }), /overlap/);
  assert.throws(() => assertNoClassOverlap(revision, [{ ...revision, meetings: [{ ...meeting, startTime: "09:30", endTime: "11:00" }] }]), /overlap/);
  assert.doesNotThrow(() => assertNoClassOverlap(revision, [{ ...revision, meetings: [{ ...meeting, startTime: "10:00", endTime: "11:00" }] }]));
  assert.doesNotThrow(() => assertNoClassOverlap(revision, [{ ...revision, effectiveFrom: "2026-12-01", effectiveTo: "2026-12-31" }]));
  // Intersecting date ranges with no shared Monday are not a class collision.
  assert.doesNotThrow(() => assertNoClassOverlap({ ...revision, effectiveTo: "2026-11-03" }, [{ ...revision, effectiveFrom: "2026-11-03" }]));
});
test("class blocks honor weekday and effective dates and never establish availability", () => {
  const block = classWindows("f", revision);
  const free = { ...block[0], kind: "AVAILABLE", startTime: "08:00", endTime: "17:00", effectiveFrom: null, effectiveTo: null };
  assert.match(availability([...block, free], "2026-11-02", "08:30", "09:15")!, /class conflict/);
  assert.equal(availability([...block, free], "2026-11-02", "08:00", "09:00"), null);
  assert.equal(availability([...block, { ...free, weekday: 2 }], "2026-11-03", "09:00", "10:00"), null);
  assert.equal(availability([...block, free], "2026-12-07", "09:00", "10:00"), null);
  assert.equal(availability(block, "2026-11-02", "11:00", "12:00"), "Availability not submitted");
});
test("default public term prefers current effective dates then newest publication", () => {
  const row = (id: string, from: string, to: string, published: string): PublicTimetable => ({ id, faculty: { id: "f", name: "Professor" }, term: { id, year: "2026", semester: id }, effectiveFrom: from, effectiveTo: to, publishedAt: published, meetings: [meeting] });
  const rows = [row("old", "2026-06-01", "2026-10-01", "2026-06-01"), row("current", "2026-10-01", "2026-12-31", "2026-10-01"), row("new-current", "2026-10-15", "2026-12-31", "2026-10-16"), row("future", "2027-01-01", "2027-06-01", "2026-10-20")];
  assert.equal(defaultTimetableTerm(rows, "2026-10-28"), "new-current");
  assert.equal(defaultTimetableTerm(rows, "2028-01-01"), "future");
  assert.equal(defaultTimetableTerm([], "2026-10-28"), "");
  assert.deepEqual([0, 6, 1, 2].map((weekday) => ({ ...meeting, weekday })).sort(sortMeetings).map((m) => m.weekday), [1, 2, 6, 0]);
});
