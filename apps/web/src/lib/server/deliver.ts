import { randomUUID } from "node:crypto";
import { appendOutbox, updateStore } from "@/lib/server/store";

export type Delivery = "local" | "email" | "sms" | "failed" | "missing";

async function remember(channel: "email" | "sms", to: string, body: string, delivered: boolean): Promise<void> {
  await updateStore((db) => {
    appendOutbox(db, {
      id: randomUUID(),
      at: new Date().toISOString(),
      channel,
      to,
      body,
      delivered,
    });
  });
}

export async function sendSignInCode(email: string, code: string): Promise<Exclude<Delivery, "sms" | "missing">> {
  const text = `Your ATOZ sign-in code is ${code}. It expires in 10 minutes. Enter it on the new system to move your session. The other system will be signed out.`;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!key && !from) {
    console.info(`[atoz] no email provider configured; sign-in code for ${email} is ${code}`);
    await remember("email", email, text, false);
    return "local";
  }

  if (!key || !from) {
    console.error("[atoz] email provider is incomplete: set both RESEND_API_KEY and EMAIL_FROM");
    await remember("email", email, text, false);
    return "failed";
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "ATOZ sign-in code",
        text,
      }),
    });
    if (!response.ok) {
      console.error(`[atoz] email provider rejected the sign-in code (${response.status})`);
      await remember("email", email, text, false);
      return "failed";
    }
    await remember("email", email, text, true);
    return "email";
  } catch (error) {
    console.error("[atoz] email provider could not be reached", error instanceof Error ? error.message : "unknown");
    await remember("email", email, text, false);
    return "failed";
  }
}

export async function sendSignInSms(phone: string, code: string): Promise<"sms" | "failed" | "missing"> {
  const text = `ATOZ sign-in code: ${code}. It expires in 10 minutes.`;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid && !token && !from) {
    console.info(`[atoz] no SMS provider configured; sign-in code for ${phone} was not texted`);
    await remember("sms", phone, text, false);
    return "missing";
  }

  if (!sid || !token || !from) {
    console.error("[atoz] SMS provider is incomplete: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM");
    await remember("sms", phone, text, false);
    return "failed";
  }

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: from, Body: text }),
    });
    if (!response.ok) {
      console.error(`[atoz] SMS provider rejected the sign-in code (${response.status})`);
      await remember("sms", phone, text, false);
      return "failed";
    }
    await remember("sms", phone, text, true);
    return "sms";
  } catch (error) {
    console.error("[atoz] SMS provider could not be reached", error instanceof Error ? error.message : "unknown");
    await remember("sms", phone, text, false);
    return "failed";
  }
}
