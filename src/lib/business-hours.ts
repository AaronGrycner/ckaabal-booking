export function formatOpeningHours(
  weekdayDescriptions: string[] | null | undefined,
): string | null {
  if (!weekdayDescriptions?.length) return null;
  return weekdayDescriptions.join("\n");
}

export function parseBusinessHoursLines(hours: string | null | undefined) {
  if (!hours?.trim()) return [];
  return hours
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function getTodayWeekdayName() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(),
  );
}

export function isTodayHoursLine(line: string, today = getTodayWeekdayName()) {
  return line.toLowerCase().startsWith(today.toLowerCase());
}
