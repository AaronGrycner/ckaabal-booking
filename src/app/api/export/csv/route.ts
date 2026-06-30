import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { getContactAvailability } from "@/lib/crm-utils";
import { getLatestAuditsForLeads } from "@/lib/services/audit-utils";

function escapeCsv(value: unknown) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvDate(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const idsParam = searchParams.get("ids");
    const runIdParam = searchParams.get("runId");

    const db = getDb();
    let rows;

    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !Number.isNaN(id));
      if (!ids.length) {
        return NextResponse.json({ error: "No valid ids" }, { status: 400 });
      }
      rows = await db.query.leads.findMany({
        where: inArray(leads.id, ids),
      });
    } else if (runIdParam) {
      const runId = Number(runIdParam);
      if (Number.isNaN(runId)) {
        return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
      }
      rows = await db.query.leads.findMany({
        where: eq(leads.searchRunId, runId),
      });
    } else {
      return NextResponse.json(
        { error: "Provide ids or runId query param" },
        { status: 400 },
      );
    }

    const auditMap = await getLatestAuditsForLeads(
      db,
      rows.map((r) => r.id),
    );

    const headers = [
      "businessName",
      "category",
      "city",
      "phone",
      "contactEmail",
      "emailConfidence",
      "emailSource",
      "websiteUrl",
      "rating",
      "reviewCount",
      "fitScore",
      "fitLabel",
      "mainIssue",
      "auditStatus",
      "status",
      "reviewStatus",
      "reviewedAt",
      "sourceType",
      "sourceQuery",
      "bestContactMethod",
      "firstContactedAt",
      "lastContactedAt",
      "followUpDueAt",
      "lastContactMethod",
      "replyReceivedAt",
      "outcome",
    ];

    const lines = [
      headers.join(","),
      ...rows.map((row) => {
        const audit = auditMap.get(row.id) ?? null;
        const availability = getContactAvailability(row, audit);

        const values: Record<string, unknown> = {
          ...row,
          reviewedAt: csvDate(row.reviewedAt),
          bestContactMethod: availability.bestContactMethod,
          firstContactedAt: csvDate(row.firstContactedAt),
          lastContactedAt: csvDate(row.lastContactedAt),
          followUpDueAt: csvDate(row.followUpDueAt),
          replyReceivedAt: csvDate(row.replyReceivedAt),
        };

        return headers.map((h) => escapeCsv(values[h])).join(",");
      }),
    ];

    const filename = `ckaabal-venues-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[export/csv]", error);
    return NextResponse.json(
      { error: "Export failed. Try again." },
      { status: 500 },
    );
  }
}
