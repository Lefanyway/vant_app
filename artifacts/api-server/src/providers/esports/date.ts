export function isCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}
export function isTimezone(timezone: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return true; }
  catch { return false; }
}
function offsetMillis(utcMillis: number, timezone: string): number {
  const value = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' }).formatToParts(new Date(utcMillis)).find(part => part.type === 'timeZoneName')?.value;
  const match = value?.match(/^GMT([+-])(\d{2}):?(\d{2})?$/);
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60000;
}
function localMidnight(year: number, month: number, day: number, timezone: string): number {
  const wallClock = Date.UTC(year, month - 1, day);
  let candidate = wallClock;
  for (let attempt = 0; attempt < 4; attempt++) {
    const adjusted = wallClock - offsetMillis(candidate, timezone);
    if (adjusted === candidate) return candidate;
    candidate = adjusted;
  }
  return Math.max(candidate, wallClock - offsetMillis(candidate, timezone));
}
export function localDayBounds(date: string, timezone = 'UTC') {
  if (!isCalendarDate(date) || !isTimezone(timezone)) throw new RangeError('Invalid calendar date or timezone');
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: new Date(localMidnight(year, month, day, timezone)).toISOString(),
    end: new Date(localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timezone)).toISOString(),
  };
}
