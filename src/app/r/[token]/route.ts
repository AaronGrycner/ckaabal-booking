import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  findActiveTrackedLinkByToken,
  getOutreachTrackingConfig,
  recordOutreachLinkClick,
  resolveTrackedLinkDestination,
} from "@/lib/services/outreach-tracking";

export const dynamic = "force-dynamic";

function redirectResponse(url: string) {
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const { publicSiteUrl } = getOutreachTrackingConfig();

  if (!token?.trim()) {
    return redirectResponse(publicSiteUrl);
  }

  const db = getDb();
  const link = await findActiveTrackedLinkByToken(db, token.trim());

  if (!link) {
    return redirectResponse(publicSiteUrl);
  }

  await recordOutreachLinkClick(db, link, _request.headers);

  return redirectResponse(resolveTrackedLinkDestination(link.destinationUrl));
}
