import { NextRequest, NextResponse } from "next/server";
import { publishedClassTimetables } from "@/lib/class-timetables";
import { apiError } from "@/lib/api-errors";
export async function GET(req: NextRequest) {
  try { return NextResponse.json(await publishedClassTimetables(req.nextUrl.searchParams), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { const { error, status } = apiError(e); return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } }); }
}
