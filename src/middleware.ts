import { type NextRequest, NextResponse } from "next/server";
import {
  getPublicSiteUrl,
  getTrackingHost,
  isAllowedTrackingPath,
  isLocalDevTrackingHost,
  normalizeHostname,
} from "@/lib/tracking-host-guard";

export function middleware(request: NextRequest) {
  const trackingHost = getTrackingHost();
  if (!trackingHost || isLocalDevTrackingHost(trackingHost)) {
    return NextResponse.next();
  }

  const requestHost = normalizeHostname(request.headers.get("host") ?? "");
  if (requestHost !== trackingHost) {
    return NextResponse.next();
  }

  if (isAllowedTrackingPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(getPublicSiteUrl(), 302);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
