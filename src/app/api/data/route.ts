import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor } from "@/lib/access";
import { mutateRecord, viewData } from "@/lib/records";
import { generateDraft, publish, changeSession } from "@/lib/scheduling";
import { instant } from "@/lib/constraints";
import { apiError } from "@/lib/api-errors";
import { PublicError, calendarDate, clockTime, draftSelection } from "@/lib/validation";
function failure(e: unknown) {
  const { error, status } = apiError(e);
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET() {
  try {
    return NextResponse.json(await viewData(await actor()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      throw new PublicError("FORBIDDEN");
    const u = await actor();
    const { op, data } = z
      .object({ op: z.string(), data: z.unknown() })
      .parse(await req.json());
    let result;
    if (op === "generate")
      result = await generateDraft(
        u,
        draftSelection.parse(data),
      );
    else if (op === "publish")
      result = await publish(
        u,
        z.object({ ids: z.array(z.string()).min(1) }).parse(data).ids,
      );
    else if (op === "session") {
      const d = z
        .object({
          id: z.string(),
          action: z.enum(["LOCK", "EDIT", "RESCHEDULE", "CANCEL", "COMPLETE"]),
          reason: z.string().max(500).default(""),
          roomId: z.string().optional(),
          date: calendarDate.optional(),
          time: clockTime.optional(),
        })
        .parse(data);
      result = await changeSession(
        u,
        d.id,
        d.action,
        d.reason,
        d.roomId && d.date && d.time
          ? { roomId: d.roomId, start: instant(d.date, d.time) }
          : undefined,
      );
    } else result = await mutateRecord(u, op, data);
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
