import { cookies } from "next/headers";
import { LoginScreen } from "@/components/LoginScreen";
import { PayScreen } from "@/components/PayScreen";
import { Shell } from "@/components/Shell";
import { readSession } from "@/lib/server/access";
import { SESSION_COOKIE } from "@/lib/server/http";

export async function AccessFrame({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const session = await readSession(jar.get(SESSION_COOKIE)?.value ?? null);
  if (!session) return <LoginScreen />;
  if (!session.paid) return <PayScreen email={session.email} />;
  return <Shell>{children}</Shell>;
}
