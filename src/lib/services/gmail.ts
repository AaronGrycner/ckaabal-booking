import nodemailer from "nodemailer";

export type GmailConnectionStatus = {
  configured: boolean;
  email: string | null;
};

function getSmtpConfig() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!user || !pass) {
    return null;
  }

  return { user, pass };
}

export function isGmailConfigured() {
  return getSmtpConfig() != null;
}

export async function getGmailConnectionStatus(): Promise<GmailConnectionStatus> {
  const config = getSmtpConfig();
  if (!config) {
    return { configured: false, email: null };
  }

  return { configured: true, email: config.user };
}

export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  body: string;
  html?: string;
}) {
  const config = getSmtpConfig();
  if (!config) {
    throw new Error(
      "Gmail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local.",
    );
  }

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transport.sendMail({
    from: config.user,
    to: input.to,
    subject: input.subject,
    text: input.body,
    ...(input.html ? { html: input.html } : {}),
  });
}
