import type { TeamNewsArticle } from "../types";

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: string;
  description?: string;
};

const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function tagValue(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  const value = match?.[1] ? decodeXml(match[1]).trim() : undefined;
  return value || undefined;
}

function parseItems(xml: string): RssItem[] {
  return Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)).map((match) => {
    const item = match[1] ?? "";
    return {
      title: tagValue(item, "title"),
      link: tagValue(item, "link"),
      pubDate: tagValue(item, "pubDate"),
      source: tagValue(item, "source"),
      description: tagValue(item, "description"),
    };
  });
}

function cleanDescription(description?: string): string | undefined {
  if (!description) return undefined;
  // The RSS description is escaped HTML, so its text still holds HTML entities such as &nbsp; after the tags go.
  const text = decodeXml(description.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ")).replace(/\s+/g, " ").trim();
  return text || undefined;
}

// Google News often sends a description that is only the headline plus the source name.
function repeatsTitle(summary: string, title: string, source?: string): boolean {
  const normalize = (value: string) => {
    const text = value.replace(/\s+/g, " ").trim().toLowerCase();
    const name = source?.replace(/\s+/g, " ").trim().toLowerCase();
    return (name && text.endsWith(name) ? text.slice(0, -name.length) : text).replace(/[\s\-–—·|]+$/, "");
  };
  return normalize(summary) === normalize(title);
}

export async function fetchTeamNews(teamName: string, limit: number): Promise<TeamNewsArticle[]> {
  const query = `"${teamName}" esports`;
  const url = new URL(GOOGLE_NEWS_RSS);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "VANT esports news reader" },
  });
  if (!response.ok) throw new Error(`Google News RSS request failed: ${response.status}`);

  const items = parseItems(await response.text());
  const articles: TeamNewsArticle[] = [];
  for (const item of items) {
    if (!item.title || !item.link || !item.pubDate) continue;
    let articleUrl: URL;
    const publishedAt = new Date(item.pubDate);
    try {
      articleUrl = new URL(item.link);
      if (articleUrl.protocol !== "https:" || Number.isNaN(publishedAt.getTime())) continue;
    } catch {
      continue;
    }

    const source = item.source ?? articleUrl.hostname.replace(/^www\./, "");
    const summary = cleanDescription(item.description);
    articles.push({
      id: `google-news:${Buffer.from(articleUrl.href).toString("base64url")}`,
      title: item.title,
      url: articleUrl.href,
      publishedAt: publishedAt.toISOString(),
      source,
      summary: summary && !repeatsTitle(summary, item.title, source) ? summary : undefined,
    });
    if (articles.length >= limit) break;
  }
  return articles;
}