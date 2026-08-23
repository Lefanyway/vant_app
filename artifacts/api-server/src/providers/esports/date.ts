function offsetMinutes(utcMillis: number, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" });
    const parts = formatter.formatToParts(new Date(utcMillis));
    const offset = parts.find((part) => part.type === "timeZoneName")?.value.match(/GMT([+-]\d{2}):?(\d{2})?/) ?? [];
    return (Number(offset[1] ?? 0) * 60) + Number(offset[2] ?? 0);
  } catch {
    return 0;
  }
}

function localStartUtcMillis(year: number, month: number, day: number, timezone: string): number {
  const approximate = Date.UTC(year, month - 1, day);
  return approximate - offsetMinutes(approximate, timezone) * 60_000;
}

/** Bounds of a local calendar day in UTC, computed from consecutive local midnights so DST-shifted days (23h/25h) are handled correctly. */
export function localDayBounds(date: string, timezone = "UTC") {
  const [year, month, day] = date.split("-").map(Number);
  const start = localStartUtcMillis(year, month, day, timezone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = localStartUtcMillis(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timezone);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}
