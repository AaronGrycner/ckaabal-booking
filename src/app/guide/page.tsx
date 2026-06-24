import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function GuideSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="mb-4 text-xl font-semibold text-zinc-100">{title}</h2>
      <div className="space-y-4 text-sm leading-relaxed text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function GuideLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="text-indigo-400 hover:text-indigo-300">
      {children}
    </Link>
  );
}

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "workflow", label: "Typical workflow" },
  { id: "dashboard", label: "Dashboard & search" },
  { id: "results", label: "Search results" },
  { id: "venue-detail", label: "Venue detail page" },
  { id: "scoring", label: "Fit score & research" },
  { id: "queues", label: "Pipeline queues" },
  { id: "outreach", label: "Outreach emails" },
  { id: "signature", label: "Signature & attachments" },
  { id: "crm", label: "CRM status & logging" },
  { id: "analytics", label: "Analytics" },
  { id: "manual", label: "Manual entry & export" },
  { id: "setup", label: "Setup notes" },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How to use this CRM</h1>
        <p className="mt-2 text-zinc-400">
          A practical guide to finding venues, researching bookers, sending
          booking pitches, and tracking shows for ckaabal. Nothing sends
          automatically — you review and approve every step.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">On this page</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {TOC.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <GuideSection id="overview" title="Overview">
        <p>
          This CRM helps you book live shows nationally. You discover venues via
          Google Places, research their websites for booker contacts and genre
          fit, approve the best targets, generate AI booking pitches, send via
          Gmail, and track each venue through your pipeline until a show is
          booked or the lead is closed.
        </p>
        <p>Main areas of the app:</p>
        <ul className="list-inside list-disc space-y-1 text-zinc-400">
          <li>
            <GuideLink href="/">Dashboard</GuideLink> — search for venues
          </li>
          <li>
            <GuideLink href="/pipeline">Pipeline</GuideLink> — all venues and
            filters
          </li>
          <li>
            <GuideLink href="/ready">Ready</GuideLink> — approved venues ready
            to pitch
          </li>
          <li>
            <GuideLink href="/follow-ups">Follow-ups</GuideLink> — overdue
            nudges
          </li>
          <li>
            <GuideLink href="/call-list">Call list</GuideLink> — phone outreach
          </li>
          <li>
            <GuideLink href="/analytics">Analytics</GuideLink> — funnel stats
          </li>
          <li>
            <GuideLink href="/settings/signature">Signature</GuideLink> — email
            signature and file attachments
          </li>
          <li>
            <GuideLink href="/leads/new">Add Venue</GuideLink> — manual entry
          </li>
        </ul>
      </GuideSection>

      <GuideSection id="workflow" title="Typical workflow">
        <ol className="list-inside list-decimal space-y-3 text-zinc-300">
          <li>
            <strong className="text-zinc-200">Search</strong> — Run a search
            for a venue type and city (e.g. &quot;live music venues&quot; in
            &quot;Austin TX&quot;). Repeat for each market on your tour route.
          </li>
          <li>
            <strong className="text-zinc-200">Review results</strong> — Open
            search results, sort by fit score, and open promising venues.
          </li>
          <li>
            <strong className="text-zinc-200">Approve or reject</strong> — On
            each venue page, approve venues worth pitching or reject poor fits.
          </li>
          <li>
            <strong className="text-zinc-200">Pitch</strong> — From the{" "}
            <GuideLink href="/ready">Ready</GuideLink> queue or venue page,
            generate an AI booking email, edit it, and send via Gmail.
          </li>
          <li>
            <strong className="text-zinc-200">Track</strong> — Update status as
            replies come in (hold, offer sent, show booked). Log follow-ups and
            phone calls.
          </li>
          <li>
            <strong className="text-zinc-200">Close</strong> — Mark shows as{" "}
            <em>Show booked</em> or mark dead ends as <em>Not interested</em> /{" "}
            <em>Not fit</em>.
          </li>
        </ol>
      </GuideSection>

      <GuideSection id="dashboard" title="Dashboard & search">
        <p>
          The <GuideLink href="/">Dashboard</GuideLink> has a search form with
          three fields:
        </p>
        <ul className="list-inside list-disc space-y-1 text-zinc-400">
          <li>
            <strong className="text-zinc-300">Venue type</strong> — What to
            search for. Try &quot;live music venues&quot;, &quot;bars with live
            music&quot;, &quot;music venues&quot;, &quot;night clubs&quot;, etc.
          </li>
          <li>
            <strong className="text-zinc-300">Location</strong> — City and state
            or region (e.g. &quot;Nashville TN&quot;, &quot;Chicago IL&quot;).
          </li>
          <li>
            <strong className="text-zinc-300">Max results</strong> — How many
            places to return (up to 60).
          </li>
        </ul>
        <p>
          Results save immediately. If a venue has a website, background research
          starts automatically (contacts, genres, booking signals). Without a
          Google Places API key, mock sample venues are used instead.
        </p>
      </GuideSection>

      <GuideSection id="results" title="Search results">
        <p>After a search you land on a results table for that run. You can:</p>
        <ul className="list-inside list-disc space-y-1 text-zinc-400">
          <li>Click a venue name to open its detail page</li>
          <li>
            Filter by fit label, CRM status, review status, or &quot;no website
            only&quot;
          </li>
          <li>
            See <em>Audit Pending</em> while site research is still running
          </li>
          <li>Export selected rows or the full run to CSV</li>
          <li>Change status or review status inline for quick triage</li>
        </ul>
        <p>
          Venues are sorted by fit score. Rows with pending research appear at
          the bottom until scoring completes.
        </p>
      </GuideSection>

      <GuideSection id="venue-detail" title="Venue detail page">
        <p>Each venue has a detail page with several panels:</p>
        <ul className="list-inside list-disc space-y-2 text-zinc-400">
          <li>
            <strong className="text-zinc-300">Review bar</strong> — Approve for
            outreach or reject (optional reason).
          </li>
          <li>
            <strong className="text-zinc-300">Notes</strong> — Freeform notes;
            the AI uses concrete notes as pitch angles.
          </li>
          <li>
            <strong className="text-zinc-300">Outreach email</strong> — Generate,
            edit, save draft, polish, and send booking pitches.
          </li>
          <li>
            <strong className="text-zinc-300">Venue info</strong> — Address,
            phone, hours, rating, website, maps link.
          </li>
          <li>
            <strong className="text-zinc-300">Venue research</strong> — Live
            music signals, genres detected on site, booking links, extracted
            emails and socials.
          </li>
          <li>
            <strong className="text-zinc-300">CRM panel</strong> — Status,
            outcomes, contact logging, activity timeline.
          </li>
          <li>
            <strong className="text-zinc-300">Copy summary</strong> — Copy a
            formatted text block for pasting elsewhere.
          </li>
          <li>
            <strong className="text-zinc-300">Call list toggle</strong> — Add
            the venue to your phone outreach queue.
          </li>
        </ul>
        <p>
          You can manually add or correct the booker email on the venue page if
          research missed it.
        </p>
      </GuideSection>

      <GuideSection id="scoring" title="Fit score & research">
        <p>
          Each venue gets a <strong className="text-zinc-200">fit score</strong>{" "}
          (0–100) and label (Excellent / Good / Maybe / Skip). Scoring favors:
        </p>
        <ul className="list-inside list-disc space-y-1 text-zinc-400">
          <li>Live music venue types (clubs, bars, theaters)</li>
          <li>Booker email or booking link found on the website</li>
          <li>Genre signals that match what the venue books</li>
          <li>Live music / shows calendar on the site</li>
          <li>Strong Google rating and review count</li>
        </ul>
        <p>
          The <strong className="text-zinc-200">top signal</strong> column
          summarizes the strongest reason to pitch (or skip) that venue. Site
          research crawls the venue website for contact emails, talent booking
          pages, and genre keywords — not web-design audits.
        </p>
      </GuideSection>

      <GuideSection id="queues" title="Pipeline queues">
        <p>
          <GuideLink href="/pipeline">Pipeline</GuideLink> — Every venue in the
          system. Search, filter by status/review/fit, bulk delete, and open
          any record.
        </p>
        <p>
          <GuideLink href="/ready">Ready</GuideLink> — Venues that are{" "}
          <em>approved</em>, have contact info, fit score ≥ 60, and have never
          been contacted. Your shortlist for pitching today.
        </p>
        <p>
          <GuideLink href="/follow-ups">Follow-ups</GuideLink> — Venues whose
          follow-up date has passed and still need a nudge. Sending an email
          auto-schedules a follow-up (default 3 days, configurable in env).
        </p>
        <p>
          <GuideLink href="/call-list">Call list</GuideLink> — Venues you
          flagged for phone outreach, with business hours shown when available.
        </p>
      </GuideSection>

      <GuideSection id="outreach" title="Outreach emails">
        <p>On a venue page, the outreach panel lets you:</p>
        <ol className="list-inside list-decimal space-y-2 text-zinc-400">
          <li>
            <strong className="text-zinc-300">Generate</strong> — AI writes a
            short booking pitch using venue research (genres, live music
            signals, routing market). Requires OpenAI API key.
          </li>
          <li>
            <strong className="text-zinc-300">Edit</strong> — Tweak subject and
            body before sending. Add optional instructions when regenerating.
          </li>
          <li>
            <strong className="text-zinc-300">Premium polish</strong> — Optional
            second pass for a more natural tone (if enabled).
          </li>
          <li>
            <strong className="text-zinc-300">Save draft</strong> — Store the
            current text on the venue without sending.
          </li>
          <li>
            <strong className="text-zinc-300">Send</strong> — Sends via Gmail
            SMTP, logs the contact, and schedules a follow-up.
          </li>
        </ol>
        <p>
          Gmail must be configured (<code className="rounded bg-zinc-800 px-1">GMAIL_USER</code>{" "}
          + app password). Use <code className="rounded bg-zinc-800 px-1">GMAIL_FROM</code>{" "}
          to send from an alias (e.g. booking@ckaabal.com) while authenticating
          with your main account. The panel shows who you are sending as.
        </p>
        <p>
          Outbound emails include a <strong className="text-zinc-200">tracked
          link</strong> in the signature when configured — clicks are logged on
          the venue timeline. Follow-up emails can be generated separately once
          a venue has been contacted.
        </p>
        <p className="rounded-md border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-amber-100/90">
          A duplicate-send warning appears if you already contacted a venue
          recently. Check the activity timeline before pitching again.
        </p>
      </GuideSection>

      <GuideSection id="signature" title="Signature & attachments">
        <p>
          <GuideLink href="/settings/signature">Signature settings</GuideLink>{" "}
          let you set a standard email signature and upload files to attach on
          every send (e.g. EPK PDF):
        </p>
        <ul className="list-inside list-disc space-y-1 text-zinc-400">
          <li>
            Signature text is used when generating AI emails and appended on
            send if not already in the draft
          </li>
          <li>
            Leave signature blank to fall back to env defaults (band name,
            website, email)
          </li>
          <li>
            Upload PDF, Word, or image files (max 10 MB each, up to 10 files)
          </li>
          <li>
            Toggle &quot;Attach uploaded files when sending&quot; to include
            them on every outreach email
          </li>
        </ul>
        <p>
          The outreach panel on each venue shows how many files will attach and
          links back to signature settings.
        </p>
      </GuideSection>

      <GuideSection id="crm" title="CRM status & logging">
        <p>Track each venue through the booking pipeline:</p>
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              <tr>
                <td className="px-3 py-2">New / Ready to contact</td>
                <td className="px-3 py-2">Not yet pitched or queued to pitch</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Contacted</td>
                <td className="px-3 py-2">Outreach sent or logged</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Follow up due</td>
                <td className="px-3 py-2">Scheduled nudge date has passed</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Replied</td>
                <td className="px-3 py-2">Venue responded</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Hold / meeting</td>
                <td className="px-3 py-2">Date discussion or call scheduled</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Offer sent</td>
                <td className="px-3 py-2">Fee / hold / rider sent</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Show booked</td>
                <td className="px-3 py-2">Confirmed show — won!</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Not interested / Not fit</td>
                <td className="px-3 py-2">Closed — no show</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          Use <strong className="text-zinc-200">Log contact</strong> to record
          emails, calls, DMs, or in-person outreach without using the send
          button. Set outcomes (no response, bad fit, books in-house only, etc.)
          when you have a disposition.
        </p>
        <p>
          The <strong className="text-zinc-200">activity timeline</strong> records
          every status change, email generation, send, click, and note.
        </p>
      </GuideSection>

      <GuideSection id="analytics" title="Analytics">
        <p>
          The <GuideLink href="/analytics">Analytics</GuideLink> page shows
          funnel counts: unreviewed → approved → contacted → replied → hold →
          offer → show booked. Conversion rates help you see where outreach drops
          off.
        </p>
      </GuideSection>

      <GuideSection id="manual" title="Manual entry & export">
        <p>
          <GuideLink href="/leads/new">Add Venue</GuideLink> — Enter a venue
          you found outside of search (referral, social, show listing). You can
          add website, contact email, and notes. If a website is provided,
          research runs in the background.
        </p>
        <p>
          <strong className="text-zinc-200">CSV export</strong> — From search
          results, select rows and export, or export the full run. Useful for
          offline planning or sharing with the band.
        </p>
      </GuideSection>

      <GuideSection id="setup" title="Setup notes">
        <p>Key configuration in <code className="rounded bg-zinc-800 px-1">.env.local</code> (not <code className="rounded bg-zinc-800 px-1">env.local</code>):</p>
        <ul className="list-inside list-disc space-y-1 text-zinc-400">
          <li>
            <code className="text-zinc-300">GOOGLE_PLACES_API_KEY</code> — real
            venue search
          </li>
          <li>
            <code className="text-zinc-300">OPENAI_API_KEY</code> — AI email
            generation
          </li>
          <li>
            <code className="text-zinc-300">GMAIL_USER</code> /{" "}
            <code className="text-zinc-300">GMAIL_APP_PASSWORD</code> — send
            emails
          </li>
          <li>
            <code className="text-zinc-300">GMAIL_FROM</code> — send-as alias
            (booking@ckaabal.com)
          </li>
          <li>
            <code className="text-zinc-300">TURSO_DATABASE_URL</code> / token
            — remote database (optional)
          </li>
          <li>
            <code className="text-zinc-300">OUTREACH_EPK_URL</code> — EPK link
            for tracked clicks
          </li>
        </ul>
        <p>
          After schema changes, run <code className="rounded bg-zinc-800 px-1">npm run db:push</code>.
          Restart the dev server after editing env vars.
        </p>
      </GuideSection>

      <p className="border-t border-zinc-800 pt-8 text-center text-sm text-zinc-500">
        Questions or gaps? Add notes on venue pages and iterate — the AI works
        best with specific research and your own observations.
      </p>
    </div>
  );
}
