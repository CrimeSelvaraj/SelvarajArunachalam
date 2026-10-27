import { normalizeCode, normalizeEmail, verifySignIn } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = (await readJson(req)) as { email?: unknown; code?: unknown };
    const email = normalizeEmail(body.email);
    const code = normalizeCode(body.code);
    if (!email) throw new HttpError("Enter a valid email address.", 400);
    if (!code) throw new HttpError("Enter the six-digit code.", 400);
    const result = await verifySignIn(email, code);
    return json({ status: "signed_in", paid: result.paid });
  } catch (error) {
    return errorResponse(error);
  }
}
