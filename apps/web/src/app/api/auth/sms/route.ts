import { codeForSms } from "@/lib/server/access";
import { sendSignInSms } from "@/lib/server/deliver";
import { json, normalizeDeviceId, normalizeEmail, normalizePhone, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const deviceId = normalizeDeviceId(body?.deviceId);
  const phone = normalizePhone(body?.phone);
  if (!email || !deviceId) return json({ error: "Request a new code first." }, 400);
  if (!phone) return json({ error: "Enter a phone number with at least 8 digits." }, 400);

  const code = await codeForSms(email, deviceId, phone);
  if (!code) return json({ error: "Request a new code first." }, 400);

  const delivery = await sendSignInSms(phone, code);
  if (delivery === "missing") {
    return json({
      status: "not-configured",
      message: "No text provider is configured. The number is saved. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM to send the same code by SMS.",
    });
  }
  if (delivery === "failed") return json({ error: "The text could not be sent." }, 502);
  return json({ status: "sent", message: "The same code was sent by text." });
}
