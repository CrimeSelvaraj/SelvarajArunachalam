import { logout } from "@/lib/server/access";
import { clearSessionCookie, json, readCookie, SESSION_COOKIE } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await logout(readCookie(request, SESSION_COOKIE));
  return json({ status: "signed-out" }, 200, { "set-cookie": clearSessionCookie(request) });
}
