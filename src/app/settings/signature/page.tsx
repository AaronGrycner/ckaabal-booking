import { SignatureSettingsForm } from "@/components/signature-settings-form";
import { getDb } from "@/lib/db";
import { getSignatureSettingsView } from "@/lib/services/outreach-signature";

export default async function SignatureSettingsPage() {
  const db = getDb();
  const data = await getSignatureSettingsView(db);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Email signature & attachments</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Set a standard signature and upload files to attach when you send
          booking outreach from the CRM.
        </p>
      </div>
      <SignatureSettingsForm data={data} />
    </div>
  );
}
