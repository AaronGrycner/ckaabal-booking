"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  generateOutreachEmailAction,
  premiumPolishOutreachEmailAction,
  saveOutreachDraftAction,
  sendOutreachEmailAction,
} from "@/actions/outreach";
import { updateLeadContactEmail } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead } from "@/lib/db/schema";
import { getDuplicateOutreachWarning, isFollowUpDueLead } from "@/lib/crm-utils";
import { GenerateFollowUpEmailButton } from "@/components/generate-follow-up-email-button";
import type { OutreachQualityReview } from "@/lib/services/outreach-email-generate";
import { copyTextToClipboard, copyTextToClipboardSync } from "@/lib/utils";

type GmailStatus = {
  configured: boolean;
  email: string | null;
  authEmail?: string | null;
};

type PendingAction = "generate" | "polish" | "save" | "send" | "email" | null;

function GenerationNotesSection({
  quality,
}: {
  quality: OutreachQualityReview | null;
}) {
  if (!quality?.warnings?.length) return null;

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300">
      <p className="font-medium text-zinc-200">Generation notes</p>
      <ul className="mt-2 list-inside list-disc text-amber-200/90">
        {quality.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}

export function OutreachEmailPanel({
  lead,
  initialSubject,
  initialBody,
  initialQualityReview,
  gmailStatus,
  premiumPolishEnabled,
  defaultFollowUpDays,
}: {
  lead: Lead;
  initialSubject: string;
  initialBody: string;
  initialQualityReview?: OutreachQualityReview | null;
  gmailStatus: GmailStatus;
  premiumPolishEnabled: boolean;
  defaultFollowUpDays: number;
}) {
  const router = useRouter();
  const savedContactEmail = lead.contactEmail?.trim() ?? "";
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [toEmailDraft, setToEmailDraft] = useState<string | null>(null);
  const toEmail = toEmailDraft ?? savedContactEmail;
  const [followUpDays, setFollowUpDays] = useState(String(defaultFollowUpDays));
  const [regenerateInstruction, setRegenerateInstruction] = useState("");
  const [qualityReview, setQualityReview] = useState<OutreachQualityReview | null>(
    initialQualityReview ?? null,
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [, startTransition] = useTransition();

  const hasDraft = Boolean(subject.trim() || body.trim());
  const followUpDue = isFollowUpDueLead(lead);
  const duplicateWarning = getDuplicateOutreachWarning(lead);
  const recipient = toEmail.trim();
  const isPending = pendingAction != null;

  function copyText(text: string, label: string) {
    if (!text.trim()) return;
    try {
      if (copyTextToClipboardSync(text)) {
        setMessage({ type: "success", text: `${label} copied.` });
        return;
      }
      void copyTextToClipboard(text)
        .then(() => setMessage({ type: "success", text: `${label} copied.` }))
        .catch(() =>
          setMessage({ type: "error", text: `Could not copy ${label.toLowerCase()}.` }),
        );
    } catch {
      setMessage({ type: "error", text: `Could not copy ${label.toLowerCase()}.` });
    }
  }

  function runAction(action: PendingAction, task: () => Promise<void>) {
    setMessage(null);
    setPendingAction(action);
    startTransition(async () => {
      try {
        await task();
      } finally {
        setPendingAction(null);
      }
    });
  }

  const savedEmail = savedContactEmail;
  const hasEmailChanges = toEmail.trim() !== savedEmail;

  function handleSaveEmail() {
    runAction("email", async () => {
      const result = await updateLeadContactEmail(lead.id, toEmail);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "Contact email saved." });
      setToEmailDraft(null);
      router.refresh();
    });
  }

  function handleGenerate() {
    runAction("generate", async () => {
      const instruction = regenerateInstruction.trim() || undefined;
      const result = await generateOutreachEmailAction(lead.id, instruction);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      if (result.subject) setSubject(result.subject);
      if (result.body) setBody(result.body);
      if (result.quality) setQualityReview(result.quality);
      setMessage({ type: "success", text: "Outreach email generated." });
      router.refresh();
    });
  }

  function handlePremiumPolish() {
    runAction("polish", async () => {
      const instruction = regenerateInstruction.trim() || undefined;
      const result = await premiumPolishOutreachEmailAction(lead.id, instruction);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      if (result.subject) setSubject(result.subject);
      if (result.body) setBody(result.body);
      if (result.quality) setQualityReview(result.quality);
      setMessage({
        type: "success",
        text: result.message ?? "Draft polished.",
      });
      router.refresh();
    });
  }

  function handleSaveDraft() {
    runAction("save", async () => {
      const result = await saveOutreachDraftAction(lead.id, subject, body);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: result.message ?? "Draft saved." });
      router.refresh();
    });
  }

  function handleSend() {
    runAction("send", async () => {
      const result = await sendOutreachEmailAction(
        lead.id,
        subject,
        body,
        followUpDays,
        toEmail,
      );
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: result.message ?? "Email sent." });
      router.refresh();
    });
  }

  const sendDisabled =
    isPending ||
    !recipient ||
    !subject.trim() ||
    !body.trim() ||
    !gmailStatus.configured ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outreach email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          {!gmailStatus.configured ? (
            <div className="rounded-md border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-amber-100">
              <p className="font-medium">Gmail not configured</p>
              <p className="mt-1 text-xs text-amber-200/90">
                Add <code className="rounded bg-black/30 px-1">GMAIL_USER</code> and{" "}
                <code className="rounded bg-black/30 px-1">GMAIL_APP_PASSWORD</code> to{" "}
                <code className="rounded bg-black/30 px-1">.env.local</code>. Use a
                Google App Password (requires 2FA on the account).
              </p>
            </div>
          ) : (
            <p>
              <span className="text-zinc-500">Gmail:</span> Sending as{" "}
              <span className="text-zinc-200">{gmailStatus.email}</span>
              {gmailStatus.authEmail &&
                gmailStatus.authEmail !== gmailStatus.email && (
                  <span className="text-zinc-500">
                    {" "}
                    (via {gmailStatus.authEmail})
                  </span>
                )}
            </p>
          )}
          <div className="space-y-2">
            <label className="text-zinc-500">To:</label>
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="email"
                value={toEmail}
                onChange={(event) => setToEmailDraft(event.target.value)}
                placeholder="Add an email if you found one…"
                className="h-9 min-w-[220px] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleSaveEmail}
                disabled={isPending || !hasEmailChanges}
              >
                {pendingAction === "email" ? "Saving…" : "Save email"}
              </Button>
            </div>
            {!savedEmail && (
              <p className="text-xs text-zinc-500">
                You can generate a draft without an email. Add one here before
                sending.
              </p>
            )}
            {savedEmail && lead.emailSource && (
              <p className="text-xs text-zinc-500">Source: {lead.emailSource}</p>
            )}
          </div>
        </div>

        {duplicateWarning && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            {duplicateWarning}
          </div>
        )}

        {lead.notes?.trim() && (
          <p className="text-xs text-zinc-500">
            Saved notes drive the email. Checklist gaps from the audit may
            supplement notes when relevant.
          </p>
        )}

        {followUpDue && (
          <div className="rounded-md border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
            <p className="font-medium">Follow-up is due</p>
            <p className="mt-1 text-xs text-amber-200/90">
              Generate a follow-up email that references your prior outreach.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {followUpDue && (
            <GenerateFollowUpEmailButton
              leadId={lead.id}
              onGenerated={({ subject: nextSubject, body: nextBody, quality }) => {
                setSubject(nextSubject);
                setBody(nextBody);
                setQualityReview(quality);
                setMessage({
                  type: "success",
                  text: "Follow-up email generated.",
                });
              }}
            />
          )}
          {!hasDraft ? (
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={isPending}
            >
              {pendingAction === "generate" ? "Generating…" : "Generate outreach email"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleGenerate}
                disabled={isPending}
              >
                {pendingAction === "generate" ? "Regenerating…" : "Regenerate"}
              </Button>
              {premiumPolishEnabled && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePremiumPolish}
                  disabled={isPending}
                >
                  {pendingAction === "polish" ? "Polishing…" : "Premium polish"}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isPending}
              >
                {pendingAction === "save" ? "Saving…" : "Save draft"}
              </Button>
            </>
          )}
        </div>

        {hasDraft && (
          <input
            type="text"
            value={regenerateInstruction}
            onChange={(event) => setRegenerateInstruction(event.target.value)}
            placeholder="Optional: make it shorter, softer, less technical…"
            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          />
        )}

        <GenerationNotesSection quality={qualityReview} />

        {hasDraft && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => copyText(subject, "Subject")}
              disabled={!subject.trim() || isPending}
            >
              Copy subject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => copyText(body, "Body")}
              disabled={!body.trim() || isPending}
            >
              Copy body
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                copyText(
                  `Subject: ${subject}\n\n${body}`,
                  "Full email",
                )
              }
              disabled={!subject.trim() || !body.trim() || isPending}
            >
              Copy full email
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Email body…"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            Follow up in ({defaultFollowUpDays} days by default)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {[defaultFollowUpDays, 5, 7]
              .filter((days, index, arr) => arr.indexOf(days) === index)
              .map((days) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={followUpDays === String(days) ? "default" : "outline"}
                onClick={() =>
                  setFollowUpDays(followUpDays === String(days) ? "0" : String(days))
                }
                disabled={isPending}
              >
                {days} days
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant={followUpDays === "0" ? "default" : "outline"}
              onClick={() => setFollowUpDays("0")}
              disabled={isPending}
            >
              No follow-up
            </Button>
            <input
              type="number"
              min={0}
              max={365}
              value={followUpDays === "0" ? "" : followUpDays}
              onChange={(e) => setFollowUpDays(e.target.value || String(defaultFollowUpDays))}
              placeholder="Custom days"
              className="h-9 w-32 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
            />
          </div>
        </div>

        <Button type="button" size="sm" onClick={handleSend} disabled={sendDisabled}>
          {pendingAction === "send" ? "Sending…" : "Send"}
        </Button>

        {message && (
          <p
            className={
              message.type === "success"
                ? "text-sm text-emerald-400"
                : "text-sm text-red-400"
            }
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
