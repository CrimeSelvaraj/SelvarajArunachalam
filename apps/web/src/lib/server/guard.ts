import { sessionForDevice, type PublicSession } from "@/lib/server/access";
import { clearSessionCookie, json, normalizeDeviceId, readCookie, SESSION_COOKIE } from "@/lib/server/http";

export async function requireSession(
  request: Request,
): Promise<{ session: PublicSession; token: string } | Response> {
  const token = readCookie(request, SESSION_COOKIE);
  const deviceId = normalizeDeviceId(request.headers.get("x-atoz-device"));
  const session = await sessionForDevice(token, deviceId);
  if (!session || !token) {
    return json({ error: "signed-out", reason: token ? "ended" : "missing" }, 401, {
      "set-cookie": clearSessionCookie(request),
    });
  }
  return { session, token };
}
