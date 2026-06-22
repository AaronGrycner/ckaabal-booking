import {
  contactAvailabilityLabel,
  getContactAvailability,
  type ContactAvailability,
} from "@/lib/crm-utils";
import type { Lead, WebsiteAudit } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";

export function ContactAvailabilityBadges({
  lead,
  audit,
  showBest = true,
}: {
  lead: Lead;
  audit?: WebsiteAudit | null;
  showBest?: boolean;
}) {
  const availability = getContactAvailability(lead, audit);
  const items: { key: keyof ContactAvailability; label: string }[] = [
    { key: "hasEmail", label: "Email" },
    { key: "hasContactForm", label: "Form" },
    { key: "hasInstagram", label: "IG" },
    { key: "hasPhone", label: "Phone" },
    { key: "hasFacebook", label: "FB" },
    { key: "hasLinkedIn", label: "LI" },
  ];

  const active = items.filter((item) => availability[item.key] === true);

  if (!active.length && availability.bestContactMethod === "website") {
    return (
      <div className="flex flex-wrap gap-1">
        <Badge variant="secondary">Website</Badge>
      </div>
    );
  }

  if (!active.length) {
    return <span className="text-xs text-zinc-500">None</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {active.map((item) => (
        <Badge key={item.key} variant="secondary">
          {item.label}
        </Badge>
      ))}
      {showBest && availability.bestContactMethod !== "none" && (
        <Badge variant="default">
          Best: {contactAvailabilityLabel(availability.bestContactMethod)}
        </Badge>
      )}
    </div>
  );
}
