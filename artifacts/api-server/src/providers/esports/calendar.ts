import type { Match } from './types';

const text = (value: string) => value.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, '\\n');
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// An iCalendar feed of a team's next matches; each map takes about an hour.
export function teamCalendar(teamName: string, matches: Match[], now = new Date()) {
  const events = matches.filter((match) => match.startTime).map((match) => {
    const start = match.scheduledTime ?? match.startTime!;
    const end = new Date(Date.parse(start) + (match.bestOf ?? 2) * 3_600_000).toISOString();
    const stream = match.streams?.find((item) => item.url.startsWith('https://'))?.url;
    return [
      'BEGIN:VEVENT',
      `UID:${match.id}@vant`,
      `DTSTAMP:${stamp(now.toISOString())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${text(`${match.homeTeam.name} vs ${match.awayTeam.name}`)}`,
      `DESCRIPTION:${text([match.competition.name, match.bestOf ? `BO${match.bestOf}` : null, stream ? `Assista: ${stream}` : null].filter(Boolean).join(' · '))}`,
      ...(stream ? [`URL:${stream}`] : []),
      'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${text(`${match.homeTeam.name} vs ${match.awayTeam.name} começa em 15 min`)}`, 'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VANT//Agenda//PT-BR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${text(`${teamName} · VANT`)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H', ...events, 'END:VCALENDAR', ''].join('\r\n');
}
