import { markSessionPaid } from "@/lib/server/access";
import { requireSession } from "@/lib/server/guard";
import { json } from "@/lib/server/http";
import { paypalConfigured } from "@/lib/server/paypal";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireSession(request);
  if (gate instanceof Response) return gate;
  if (paypalConfigured()) {
    return json({ error: "PayPal is configured. Use the PayPal button for the $1 payment." }, 409);
  }
  const paid = await markSessionPaid(gate.token, "local-sandbox");
  if (!paid) return json({ error: "signed-out", reason: "ended" }, 401);
  return json({ status: "paid", ref: "local-sandbox" });
}
