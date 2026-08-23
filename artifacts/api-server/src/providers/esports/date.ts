export function localDayBounds(date: string, timezone = "UTC") {
  const [year, month, day] = date.split("-").map(Number);
  const approximate = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" });
  const parts = formatter.formatToParts(new Date(approximate));
  const offset = parts.find((part) => part.type === "timeZoneName")?.value.match(/GMT([+-]\d{2}):?(\d{2})?/) ?? [];
  const minutes = (Number(offset[1] ?? 0) * 60) + Number(offset[2] ?? 0);
  const start = new Date(approximate - minutes * 60_000);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}