import {
  isTodayHoursLine,
  parseBusinessHoursLines,
} from "@/lib/business-hours";

export function BusinessHoursDisplay({
  hours,
  compact = false,
}: {
  hours: string | null | undefined;
  compact?: boolean;
}) {
  const lines = parseBusinessHoursLines(hours);

  if (!lines.length) {
    return <span className="text-zinc-500">—</span>;
  }

  if (compact) {
    const todayLine = lines.find((line) => isTodayHoursLine(line));
    return (
      <span className="text-sm">
        {todayLine ?? lines[0]}
      </span>
    );
  }

  return (
    <ul className="space-y-0.5 text-sm">
      {lines.map((line) => (
        <li
          key={line}
          className={
            isTodayHoursLine(line)
              ? "font-medium text-emerald-300"
              : "text-zinc-400"
          }
        >
          {line}
        </li>
      ))}
    </ul>
  );
}
