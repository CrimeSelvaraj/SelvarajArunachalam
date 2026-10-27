import { getViewer } from "@/lib/auth";
import { errorResponse, json } from "@/lib/http";

export async function GET() {
  try {
    const viewer = await getViewer();
    if (viewer.kind === "replaced") {
      return json({ error: "This email signed in on another device.", reason: "replaced" }, 401);
    }
    if (viewer.kind !== "user") {
      return json({ error: "Sign in required.", reason: "unauthorized" }, 401);
    }
    return json({
      email: viewer.user.email,
      paid: viewer.user.paid,
      paymentMethod: viewer.user.paymentMethod,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
