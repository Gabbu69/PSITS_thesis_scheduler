import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PublicError } from "./validation";

export function apiError(error: unknown): { error: string; status: number } {
  if (error instanceof PublicError) {
    const status = error.message === "UNAUTHORIZED" ? 401
      : ["FORBIDDEN", "PASSWORD_CHANGE_REQUIRED", "MFA_SETUP_REQUIRED"].includes(error.message) ? 403 : 400;
    return { error: error.message, status };
  }
  if (error instanceof z.ZodError)
    return { error: error.issues.map((i) => `${i.path.join(".") || "Details"}: ${i.message}`).join(" "), status: 400 };
  if (error instanceof SyntaxError) return { error: "Invalid request. Refresh and try again.", status: 400 };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { error: "A record already exists. Check the identifier, email, membership, or booking.", status: 409 };
    if (["P2003", "P2025"].includes(error.code)) return { error: "A selected record no longer exists. Refresh and try again.", status: 409 };
    if (["P2004", "P2010"].includes(error.code)) return { error: "This change conflicts with an existing record. Review group membership and bookings.", status: 409 };
  }
  return { error: "The request could not be completed. Please try again.", status: 500 };
}
