import { verifyCode } from "@/lib/server/access";
import { json, normalizeCode, normalizeDeviceId, normalizeEmail, readJson, sessionCookie } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const deviceId = normalizeDeviceId(body?.deviceId);
  const code = normalizeCode(body?.code);
  if (!email) return json({ error: "Enter a valid email address." }, 400);
  if (!deviceId) return json({ error: "This system could not be identified. Reload and try again." }, 400);
  if (!code) return json({ error: "Enter the six-digit code." }, 400);

  const result = await verifyCode({ email, deviceId, code });
  if (result.status === "signed-in") {
    return json({ status: "signed-in", paid: result.paid }, 200, {
      "set-cookie": sessionCookie(result.token, request),
    });
  }
  const message =
    result.status === "expired"
      ? "That code expired. Request a new one."
      : result.status === "too-many-tries"
        ? "Too many tries. Request a new code."
        : result.status === "no-challenge"
          ? "Request a new code for this system."
          : "That code does not match.";
  return json({ error: message }, 400);
}
