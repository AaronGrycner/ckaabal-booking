import { NextResponse } from "next/server";
import { getGmailConnectionStatus } from "@/lib/services/gmail";

export const runtime = "nodejs";

export async function GET() {
  const status = await getGmailConnectionStatus();
  return NextResponse.json(status);
}
