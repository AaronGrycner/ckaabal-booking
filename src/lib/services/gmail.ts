import nodemailer from "nodemailer";

export type GmailConnectionStatus = {
  configured: boolean;
  /** Address recipients see (alias / send-as). */
  email: string | null;
  /** Account used for SMTP authentication. */
  authEmail: string | null;
};

function getSmtpConfig() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!user || !pass) {
    return null;
  }

  return { user, pass };
}

/** From header address — alias when set, otherwise SMTP login. */
export function getGmailFromAddress() {
  const config = getSmtpConfig();
  if (!config) return null;

  return (
    process.env.GMAIL_FROM?.trim() ||
    process.env.OUTREACH_EMAIL?.trim() ||
    config.user
  );
}

function getGmailFromHeader() {
  const fromAddress = getGmailFromAddress();
  if (!fromAddress) return null;

  const name =
    process.env.GMAIL_FROM_NAME?.trim() ||
    process.env.OUTREACH_SENDER_NAME?.trim() ||
    process.env.OUTREACH_BAND_NAME?.trim();

  if (name) {
    return `"${name.replace(/"/g, "")}" <${fromAddress}>`;
  }

  return fromAddress;
}

export function isGmailConfigured() {
  return getSmtpConfig() != null;
}

export async function getGmailConnectionStatus(): Promise<GmailConnectionStatus> {
  const config = getSmtpConfig();
  if (!config) {
    return { configured: false, email: null, authEmail: null };
  }

  return {
    configured: true,
    email: getGmailFromAddress(),
    authEmail: config.user,
  };
}

export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}) {
  const config = getSmtpConfig();
  if (!config) {
    throw new Error(
      "Gmail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local.",
    );
  }

  const from = getGmailFromHeader();
  if (!from) {
    throw new Error("Gmail from address is not configured.");
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
    from,
    to: input.to,
    subject: input.subject,
    text: input.body,
    ...(input.html ? { html: input.html } : {}),
    ...(input.attachments?.length
      ? {
          attachments: input.attachments.map((file) => ({
            filename: file.filename,
            content: file.content,
            contentType: file.contentType,
          })),
        }
      : {}),
  });
}
