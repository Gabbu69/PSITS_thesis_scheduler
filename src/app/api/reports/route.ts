import { NextRequest, NextResponse } from "next/server";
import { actor } from "@/lib/access";
import { db } from "@/lib/db";
import { reportRows, pdfBuffer, csvText } from "@/lib/reports";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const u = await actor(),
      q = req.nextUrl.searchParams,
      rows = await reportRows(u, q);
    if (q.get("format") === "json") return NextResponse.json(rows);
    if (q.get("format") === "csv")
      return new Response(csvText(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="student-roster.csv"',
          "Cache-Control": "no-store",
        },
      });
    const college = await db.college.findUniqueOrThrow({ where: { id: 1 } });
    return new Response(
      new Uint8Array(
        await pdfBuffer(
          college.name,
          rows,
          q.get("type") ?? "master",
          q.get("draft") === "true",
        ),
      ),
      {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="defense-schedule.pdf"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Report failed";
    return NextResponse.json(
      { error: message },
      {
        status:
          message === "UNAUTHORIZED"
            ? 401
            : message === "FORBIDDEN"
              ? 403
              : 400,
      },
    );
  }
}
