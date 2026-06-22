const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function normalizeHostname(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";

  try {
    if (trimmed.includes("://")) {
      return new URL(trimmed).hostname.toLowerCase();
    }
  } catch {
    // fall through for bare host values
  }

  return trimmed.split(":")[0]?.replace(/\.$/, "") ?? "";
}

export function getTrackingHost(): string | null {
  const explicit = process.env.OUTREACH_TRACKING_HOST?.trim();
  if (explicit) {
    const host = normalizeHostname(explicit);
    return host || null;
  }

  const baseUrl = process.env.OUTREACH_TRACKING_BASE_URL?.trim();
  if (!baseUrl) return null;

  try {
    return new URL(baseUrl).hostname.toLowerCase() || null;
  } catch {
    const host = normalizeHostname(baseUrl);
    return host || null;
  }
}

export function getPublicSiteUrl(): string {
  const url =
    process.env.PUBLIC_SITE_URL?.trim() || "https://ckaabal.com";
  return url.replace(/\/$/, "");
}

export function isLocalDevTrackingHost(host: string): boolean {
  return LOCAL_DEV_HOSTS.has(normalizeHostname(host));
}

export function isTrackingHostRequest(requestHost: string): boolean {
  const trackingHost = getTrackingHost();
  if (!trackingHost) return false;
  return normalizeHostname(requestHost) === trackingHost;
}

export function isAllowedTrackingPath(pathname: string): boolean {
  return pathname.startsWith("/r/");
}
