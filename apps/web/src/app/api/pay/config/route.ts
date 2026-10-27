import { requireSession } from "@/lib/server/guard";
import { json } from "@/lib/server/http";
import { paypalClientId, paypalConfigured } from "@/lib/server/paypal";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireSession(request);
  if (gate instanceof Response) return gate;
  const clientId = paypalClientId();
  return json({
    amount: "1.00",
    currency: "USD",
    mode: paypalConfigured() && clientId ? "paypal" : "sandbox-stand-in",
    clientId,
  });
}
