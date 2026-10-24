import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor } from "@/lib/access";
import { mutateRecord, viewData } from "@/lib/records";
import { generateDraft, publish, changeSession } from "@/lib/scheduling";
import { instant } from "@/lib/constraints";
function failure(e: unknown) {
  const message = e instanceof Error ? e.message : "Request failed";
  const status =
    message === "UNAUTHORIZED" ? 401 : ["FORBIDDEN", "PASSWORD_CHANGE_REQUIRED", "MFA_SETUP_REQUIRED"].includes(message) ? 403 : 400;
  const friendly = message.includes("Unique constraint")
    ? "A record already exists. Check duplicate membership, identifier, email, or booking."
    : message.includes("Foreign key")
      ? "A selected record no longer exists. Refresh and try again."
      : e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" ") : message;
  return NextResponse.json({ error: friendly }, { status });
}
export async function GET() {
  try {
    return NextResponse.json(await viewData(await actor()));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      throw new Error("FORBIDDEN");
    const u = await actor();
    const { op, data } = z
      .object({ op: z.string(), data: z.unknown() })
      .parse(await req.json());
    let result;
    if (op === "generate")
      result = await generateDraft(
        u,
        z
          .object({
            termId: z.string(),
            stageId: z.string(),
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            rooms: z.array(z.string()).min(1),
            attemptIds: z.array(z.string()).optional(),
          })
          .parse(data),
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
          reason: z.string().default(""),
          roomId: z.string().optional(),
          date: z.string().optional(),
          time: z.string().optional(),
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
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return failure(e);
  }
}
