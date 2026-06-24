import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getEnv } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ckaabal Booking CRM",
  description: "Venue research and show booking outreach for ckaabal",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isMockMode } = getEnv();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0c0f14] text-zinc-100">
        <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ckaabal Booking
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm">
              <Link href="/" className="text-zinc-400 hover:text-zinc-200">
                Dashboard
              </Link>
              <Link
                href="/pipeline"
                className="text-zinc-400 hover:text-zinc-200"
              >
                Pipeline
              </Link>
              <Link href="/ready" className="text-zinc-400 hover:text-zinc-200">
                Ready
              </Link>
              <Link
                href="/follow-ups"
                className="text-zinc-400 hover:text-zinc-200"
              >
                Follow-ups
              </Link>
              <Link
                href="/call-list"
                className="text-zinc-400 hover:text-zinc-200"
              >
                Call list
              </Link>
              <Link
                href="/analytics"
                className="text-zinc-400 hover:text-zinc-200"
              >
                Analytics
              </Link>
              <Link
                href="/guide"
                className="text-zinc-400 hover:text-zinc-200"
              >
                Guide
              </Link>
              <Link
                href="/suggestions"
                className="text-zinc-400 hover:text-zinc-200"
              >
                Suggestions
              </Link>
              <Link
                href="/settings/signature"
                className="text-zinc-400 hover:text-zinc-200"
              >
                Signature
              </Link>
              <Link
                href="/leads/new"
                className="text-zinc-400 hover:text-zinc-200"
              >
                Add Venue
              </Link>
            </nav>
          </div>
          <span className="text-xs text-zinc-500">Internal tool</span>
        </div>
          {isMockMode && (
            <div className="border-t border-amber-900/50 bg-amber-950/30 px-4 py-2 text-center text-sm text-amber-200">
              Mock mode active — add GOOGLE_PLACES_API_KEY to use real search
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
