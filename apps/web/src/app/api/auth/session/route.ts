import { readSession, sessionForDevice } from "@/lib/server/access";
import { clearSessionCookie, json, normalizeDeviceId, readCookie, SESSION_COOKIE } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  const deviceId = normalizeDeviceId(request.headers.get("x-atoz-device"));
  const owned = token ? await readSession(token) : null;
  const session = await sessionForDevice(token, deviceId);
  if (!session) {
    const reason = owned && deviceId && owned.deviceId !== deviceId ? "other-device" : token ? "ended" : "missing";
    return json({ error: "signed-out", reason }, 401, { "set-cookie": clearSessionCookie(request) });
  }
  return json({ email: session.email, paid: session.paid, kind: session.kind });
}
