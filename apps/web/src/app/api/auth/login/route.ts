import { login } from "@/lib/server/access";
import { sendSignInCode } from "@/lib/server/deliver";
import { json, normalizeDeviceId, normalizeEmail, normalizeKind, readJson, sessionCookie } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const deviceId = normalizeDeviceId(body?.deviceId);
  const kind = normalizeKind(body?.kind);
  if (!email) return json({ error: "Enter a valid email address." }, 400);
  if (!deviceId || !kind) return json({ error: "This system could not be identified. Reload and try again." }, 400);

  const result = await login({ email, deviceId, kind });
  if (result.status === "rate-limited") {
    return json({ error: "Too many codes were requested. Wait a few minutes and try again." }, 429);
  }
  if (result.status === "signed-in") {
    return json({ status: "signed-in", paid: result.paid }, 200, {
      "set-cookie": sessionCookie(result.token, request),
    });
  }

  const delivery = await sendSignInCode(email, result.code);
  if (delivery === "failed") {
    return json({ error: "The code could not be sent. Check the email provider and try again." }, 502);
  }
  return json({
    status: "code-required",
    otherKind: result.otherKind,
    delivery,
    previewCode: delivery === "local" ? result.code : null,
  });
}
