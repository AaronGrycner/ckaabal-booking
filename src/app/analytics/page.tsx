import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import {
  getContactAvailability,
  isFollowUpDueLead,
  isReadyLead,
} from "@/lib/crm-utils";
import { getLatestAuditsForLeads } from "@/lib/services/audit-utils";

function pct(numerator: number, denominator: number) {
  if (denominator === 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default async function AnalyticsPage() {
  const db = getDb();
  const allLeads = await db.query.leads.findMany();
  const auditMap = await getLatestAuditsForLeads(
    db,
    allLeads.map((l) => l.id),
  );

  const total = allLeads.length;
  const unreviewed = allLeads.filter((l) => l.reviewStatus === "unreviewed").length;
  const approved = allLeads.filter(
    (l) => l.reviewStatus === "approved_for_outreach",
  ).length;
  const rejected = allLeads.filter((l) => l.reviewStatus === "rejected").length;
  const readyToContact = allLeads.filter((l) => {
    const audit = auditMap.get(l.id) ?? null;
    return isReadyLead(l, getContactAvailability(l, audit));
  }).length;
  const contacted = allLeads.filter((l) => l.firstContactedAt != null).length;
  const followUpsDue = allLeads.filter(isFollowUpDueLead).length;
  const replied = allLeads.filter((l) =>
    ["replied", "meeting_scheduled", "proposal_sent", "client"].includes(
      l.status,
    ),
  ).length;
  const meetings = allLeads.filter(
    (l) => l.status === "meeting_scheduled",
  ).length;
  const proposals = allLeads.filter((l) => l.status === "proposal_sent").length;
  const clients = allLeads.filter((l) => l.status === "client").length;
  const notInterested = allLeads.filter(
    (l) => l.status === "not_interested",
  ).length;
  const notFit = allLeads.filter((l) => l.status === "not_fit").length;

  const approvedContacted = allLeads.filter(
    (l) =>
      l.reviewStatus === "approved_for_outreach" && l.firstContactedAt != null,
  ).length;
  const contactedReplied = allLeads.filter(
    (l) =>
      l.firstContactedAt != null &&
      ["replied", "meeting_scheduled", "proposal_sent", "client"].includes(
        l.status,
      ),
  ).length;
  const repliedMeeting = allLeads.filter((l) =>
    ["meeting_scheduled", "proposal_sent", "client"].includes(l.status),
  ).length;
  const meetingClient = clients;

  const counts = [
    { label: "Total leads", value: total },
    { label: "Unreviewed", value: unreviewed },
    { label: "Approved for outreach", value: approved },
    { label: "Rejected", value: rejected },
    { label: "Ready to contact", value: readyToContact },
    { label: "Contacted", value: contacted },
    { label: "Follow-ups due", value: followUpsDue },
    { label: "Replied", value: replied },
    { label: "Meetings scheduled", value: meetings },
    { label: "Proposals sent", value: proposals },
    { label: "Clients", value: clients },
    { label: "Not interested", value: notInterested },
    { label: "Not fit", value: notFit },
  ];

  const conversions = [
    {
      label: "Approved → Contacted",
      rate: pct(approvedContacted, approved),
    },
    {
      label: "Contacted → Replied",
      rate: pct(contactedReplied, contacted),
    },
    {
      label: "Replied → Meeting",
      rate: pct(repliedMeeting, replied),
    },
    {
      label: "Meeting → Client",
      rate: pct(meetingClient, meetings + proposals + clients),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pipeline" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Pipeline
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-zinc-400">
          Pipeline counts and conversion rates.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-zinc-400">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Conversion rates</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {conversions.map((item) => (
            <Card key={item.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-zinc-400">
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{item.rate}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
