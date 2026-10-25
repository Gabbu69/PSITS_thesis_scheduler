import { z } from "zod";

// Reject impossible calendar dates instead of accepting Date.parse's rollover.
export const calendarDate = z.iso.date();
export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.");
export const studentNumber = z.string().trim().min(1, "Student identifier required").max(100);

export const draftSelection = z.object({
  termId: z.string().min(1),
  stageId: z.string().min(1),
  from: calendarDate,
  to: calendarDate,
  rooms: z.array(z.string().min(1)).min(1, "Choose at least one room.").max(100),
  attemptIds: z.array(z.string().min(1)).max(1000).optional(),
});

export function validateReportFilters(filters: URLSearchParams) {
  for (const key of ["from", "to"]) {
    const value = filters.get(key);
    if (value) calendarDate.parse(value);
  }
  if (filters.get("from") && filters.get("to") && filters.get("from")! > filters.get("to")!)
    throw new PublicError("From date must be on or before through date.");
  if (filters.get("version")) z.string().regex(/^[1-9]\d{0,8}$/, "Choose a valid published version.").parse(filters.get("version"));
  const format = filters.get("format");
  if (format) z.enum(["json", "csv", "pdf"]).parse(format);
}

// Only deliberately public application errors may be sent back to the browser.
export class PublicError extends Error {}
