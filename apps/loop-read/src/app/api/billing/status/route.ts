import { requireUser } from "@/lib/auth";
import { paypalEnabled } from "@/lib/billing";
import { errorResponse, json } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    return json({
      paid: user.paid,
      paymentMethod: user.paymentMethod,
      paypalConfigured: paypalEnabled(),
      amount: "1.00",
      currency: "USD",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
