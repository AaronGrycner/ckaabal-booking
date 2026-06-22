import { SearchForm } from "@/components/search-form";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          ckaabal Booking CRM
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Find live music venues nationwide, research booker contacts and genre
          fit, and manage show booking outreach. Nothing is sent automatically.
        </p>
      </div>
      <SearchForm />
    </div>
  );
}
