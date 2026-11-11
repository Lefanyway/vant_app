import type { SearchResult } from "./types";

// Lower case, no accents, punctuation as spaces: "KRÜ Blaze" and "kru blaze" compare equal.
export function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// "champions" is a whole word of "Champions 2025" but only the start of "Championship".
export function hasWholeWords(text: string, query: string): boolean {
  return ` ${normalize(text)} `.includes(` ${normalize(query)} `);
}

// PandaScore slugs are ASCII ("kru-blaze"), so a slug search finds names whose accents the user did not type.
export function slugify(value: string): string {
  return normalize(value).replace(/ /g, "-");
}

const regionNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });
export function countryName(code?: string): string | undefined {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return undefined;
  try { return regionNames.of(code.toUpperCase()); } catch { return undefined; }
}

// 0 exact name or acronym, 1 name starts with the query, 2 a word (or the season) starts with it,
// 3 it appears anywhere, 4 matched upstream only (slug).
function score(item: SearchResult, query: string): number {
  const name = normalize(item.name);
  const acronym = item.acronym ? normalize(item.acronym) : "";
  const season = item.season ? normalize(item.season) : "";
  if (name === query || (acronym && acronym === query)) return 0;
  if (name.startsWith(query)) return 1;
  const words = `${name} ${acronym} ${season}`.split(" ").filter(Boolean);
  if (words.some((word) => word.startsWith(query)) || season.startsWith(query)) return 2;
  if (name.includes(query) || season.includes(query)) return 3;
  return 4;
}

// Best match first; among equals the shorter name, so "Team Liquid" comes before "Team Liquid Academy".
export function rankResults(items: SearchResult[], rawQuery: string, limit = 30): SearchResult[] {
  const query = normalize(rawQuery);
  // The first copy wins: lookups come newest season first.
  const unique = [...items.reduce((seen, item) => seen.has(`${item.type}:${item.id}`) ? seen : seen.set(`${item.type}:${item.id}`, item), new Map<string, SearchResult>()).values()];
  return unique
    .map((item) => ({ item, score: score(item, query) }))
    .sort((a, b) => a.score - b.score || a.item.name.length - b.item.name.length || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map(({ item }) => item);
}
