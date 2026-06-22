import { readFileSync } from "fs";
import { resolve } from "path";
import nodemailer from "nodemailer";
import {
  getGmailConnectionStatus,
  sendGmailMessage,
} from "../src/lib/services/gmail";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const status = await getGmailConnectionStatus();
  console.log("Configured:", status.configured);
  console.log("Sender:", status.email ?? "(none)");

  if (!status.configured) {
    console.error("FAIL: GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local");
    process.exit(1);
  }

  const user = process.env.GMAIL_USER!.trim();
  const pass = process.env.GMAIL_APP_PASSWORD!.trim();

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  console.log("Verifying SMTP login…");
  await transport.verify();
  console.log("SMTP verify: OK");

  const subject = `Leadfinder SMTP test ${new Date().toISOString()}`;
  const body = "If you received this, Gmail app password sending is working.";

  console.log(`Sending test email to ${user}…`);
  await sendGmailMessage({ to: user, subject, body });
  console.log("Send: OK");
  console.log("PASS: Gmail app password system is working.");
}

main().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
