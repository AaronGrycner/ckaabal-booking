"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteSignatureAttachmentAction,
  saveSignatureSettingsAction,
  uploadSignatureAttachmentAction,
  type SignatureSettingsActionState,
} from "@/actions/signature-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatAttachmentSize,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/services/outreach-signature";
import type { SignatureSettingsView } from "@/lib/services/outreach-signature";

const initialSaveState: SignatureSettingsActionState = {};
const initialUploadState: SignatureSettingsActionState = {};

export function SignatureSettingsForm({ data }: { data: SignatureSettingsView }) {
  const [saveState, saveAction, savePending] = useActionState(
    saveSignatureSettingsAction,
    initialSaveState,
  );
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadSignatureAttachmentAction,
    initialUploadState,
  );
  const [message, setMessage] = useState<SignatureSettingsActionState | null>(
    null,
  );
  const [deletePending, startDelete] = useTransition();

  const statusMessage =
    message?.message ?? saveState.message ?? uploadState.message;
  const statusError =
    message?.error ?? saveState.error ?? uploadState.error;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email signature</CardTitle>
          <p className="text-sm text-zinc-400">
            Used when generating outreach emails and appended on send if not
            already in the draft. Leave blank to use env defaults.
          </p>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Signature text</span>
              <textarea
                name="bodyText"
                rows={10}
                defaultValue={data.settings.bodyText}
                placeholder={data.effectiveSignaturePreview}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                name="attachFilesOnSend"
                defaultChecked={data.settings.attachFilesOnSend}
                className="rounded border-zinc-600"
              />
              Attach uploaded files when sending outreach emails
            </label>
            {saveState.error && (
              <p className="text-sm text-red-400">{saveState.error}</p>
            )}
            {saveState.message && (
              <p className="text-sm text-emerald-400">{saveState.message}</p>
            )}
            <Button type="submit" disabled={savePending}>
              {savePending ? "Saving…" : "Save signature"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Standard attachments</CardTitle>
          <p className="text-sm text-zinc-400">
            Upload files to include on outreach sends (e.g. EPK PDF). Max{" "}
            {Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB per file. PDF,
            Word, and images supported.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={uploadAction} className="flex flex-wrap items-end gap-3">
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Add file</span>
              <input
                type="file"
                name="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.txt,application/pdf,image/*"
                required
                className="block text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-zinc-200"
              />
            </label>
            <Button type="submit" disabled={uploadPending}>
              {uploadPending ? "Uploading…" : "Upload"}
            </Button>
          </form>

          {uploadState.error && (
            <p className="text-sm text-red-400">{uploadState.error}</p>
          )}
          {uploadState.message && (
            <p className="text-sm text-emerald-400">{uploadState.message}</p>
          )}

          {data.attachments.length === 0 ? (
            <p className="text-sm text-zinc-500">No attachments yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
              {data.attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{file.filename}</p>
                    <p className="text-xs text-zinc-500">
                      {formatAttachmentSize(file.sizeBytes)} · {file.mimeType}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={deletePending}
                    onClick={() => {
                      startDelete(async () => {
                        const result = await deleteSignatureAttachmentAction(
                          file.id,
                        );
                        setMessage(result);
                      });
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-300">
            {data.settings.bodyText.trim() || data.effectiveSignaturePreview}
          </pre>
          {statusError && (
            <p className="mt-3 text-sm text-red-400">{statusError}</p>
          )}
          {statusMessage && (
            <p className="mt-3 text-sm text-emerald-400">{statusMessage}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
