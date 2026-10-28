import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor } from "@/lib/access";
import { managedClassTimetables, mutateClassTimetable, TimetableConflict } from "@/lib/class-timetables";
import { apiError } from "@/lib/api-errors";
import { PublicError } from "@/lib/validation";
function failure(e: unknown) {
  const { error, status } = apiError(e);
  return NextResponse.json({ error }, { status: e instanceof TimetableConflict ? 409 : status, headers: { "Cache-Control": "no-store" } });
}
export async function GET() {
  try { return NextResponse.json(await managedClassTimetables(await actor()), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return failure(e); }
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin) throw new PublicError("FORBIDDEN");
    const user = await actor();
    const { op, data } = z.object({ op: z.enum(["save", "submit", "publish"]), data: z.unknown() }).parse(await req.json());
    return NextResponse.json({ ok: true, result: await mutateClassTimetable(user, op, data) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return failure(e); }
}
