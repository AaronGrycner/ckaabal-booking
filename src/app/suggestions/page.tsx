import { listSuggestions } from "@/actions/suggestions";
import { SuggestionsPanel } from "@/components/suggestions-panel";

export default async function SuggestionsPage() {
  const suggestions = await listSuggestions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Software suggestions</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Capture ideas for improving this CRM. Nothing happens automatically —
          these are just notes until you delete them.
        </p>
      </div>
      <SuggestionsPanel suggestions={suggestions} />
    </div>
  );
}
