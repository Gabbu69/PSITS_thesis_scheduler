import { z } from "zod";
import { calendarDate, clockTime, PublicError } from "./validation";
import type { Window } from "./constraints";

const text = z.string().trim().min(1).max(200);
export const classMeetingSchema = z.object({
  subjectCode: text, subjectName: text, section: text, location: text,
  weekday: z.number().int().min(0).max(6), startTime: clockTime, endTime: clockTime,
}).refine((m) => m.startTime < m.endTime, "End time must be after start time. Split overnight classes into separate days.");
export const timetableSaveSchema = z.object({
  facultyId: text, termId: text, version: z.number().int().min(0),
  effectiveFrom: calendarDate, effectiveTo: calendarDate,
  meetings: z.array(classMeetingSchema).max(150),
}).refine((r) => r.effectiveFrom <= r.effectiveTo, "Effective end must be on or after the start date.");
export type ClassMeetingInput = z.infer<typeof classMeetingSchema>;
export type ClassRevisionInput = { effectiveFrom: string; effectiveTo: string; meetings: ClassMeetingInput[] };
export const weekdayOrder = (day: number) => (day + 6) % 7;
export const sortMeetings = (a: ClassMeetingInput, b: ClassMeetingInput) => weekdayOrder(a.weekday) - weekdayOrder(b.weekday) || a.startTime.localeCompare(b.startTime) || a.subjectCode.localeCompare(b.subjectCode);
export function meetingKey(m: ClassMeetingInput) {
  return JSON.stringify([m.subjectCode, m.subjectName, m.section, m.location, m.weekday, m.startTime, m.endTime]);
}
export function classWindows(userId: string, revision: ClassRevisionInput): Window[] {
  return revision.meetings.map((m) => ({ userId, roomId: null, kind: "BLOCK", date: null,
    weekday: m.weekday, effectiveFrom: revision.effectiveFrom, effectiveTo: revision.effectiveTo,
    startTime: m.startTime, endTime: m.endTime, label: "Teaching class" }));
}
function sharedWeekday(a: ClassRevisionInput, b: ClassRevisionInput, weekday: number) {
  const from = a.effectiveFrom > b.effectiveFrom ? a.effectiveFrom : b.effectiveFrom;
  const to = a.effectiveTo < b.effectiveTo ? a.effectiveTo : b.effectiveTo;
  if (from > to) return false;
  const first = new Date(`${from}T12:00:00Z`);
  first.setUTCDate(first.getUTCDate() + (weekday - first.getUTCDay() + 7) % 7);
  return first.toISOString().slice(0, 10) <= to;
}
export function assertNoClassOverlap(proposed: ClassRevisionInput, others: ClassRevisionInput[] = []) {
  for (let i = 0; i < proposed.meetings.length; i++) {
    const a = proposed.meetings[i];
    const comparisons = [{ ...proposed, meetings: proposed.meetings.slice(i + 1) }, ...others];
    for (const r of comparisons) for (const b of r.meetings) {
      if (a.weekday === b.weekday && a.startTime < b.endTime && b.startTime < a.endTime && sharedWeekday(proposed, r, a.weekday))
        throw new PublicError(`Classes overlap: ${a.subjectCode} and ${b.subjectCode}. Review the day, time, and effective dates.`);
    }
  }
}
export type PublicTimetable = {
  id: string; faculty: { id: string; name: string }; term: { id: string; year: string; semester: string };
  effectiveFrom: string; effectiveTo: string; publishedAt: string; meetings: ClassMeetingInput[];
};
export function defaultTimetableTerm(rows: PublicTimetable[], today: string) {
  const current = rows.filter((r) => r.meetings.length && r.effectiveFrom <= today && r.effectiveTo >= today)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.publishedAt.localeCompare(a.publishedAt));
  return (current[0] ?? [...rows].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0])?.term.id ?? "";
}
