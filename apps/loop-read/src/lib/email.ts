import nodemailer from "nodemailer";

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Local demo banner may show the code. Never enable the override on a public host. */
export function demoCodeVisible(): boolean {
  if (smtpConfigured()) return false;
  if (process.env.LOOP_READ_SHOW_DEMO_CODE === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export async function deliverSignInCode(email: string, code: string): Promise<{ demo: boolean }> {
  if (!smtpConfigured()) {
    console.info(
      `[LOOP READ demo email] to=${email} code=${code} — SMTP is not configured, so this code was not emailed.`,
    );
    return { demo: true };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Your LOOP READ sign-in code",
    text: [
      `Your LOOP READ sign-in code is ${code}.`,
      "It expires in 10 minutes.",
      "If you did not try to sign in, you can ignore this message.",
    ].join("\n"),
  });

  return { demo: false };
}
