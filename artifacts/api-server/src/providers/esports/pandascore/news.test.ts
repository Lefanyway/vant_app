import assert from "node:assert/strict";
import test from "node:test";
import { fetchTeamNews } from "./news";

// Mirrors Google News: the description is escaped HTML with a link, two &nbsp; and the source name.
const rss = (title: string, linkText: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item>
  <title>${title}</title>
  <link>https://news.google.com/rss/articles/example</link>
  <pubDate>Mon, 24 Nov 2025 08:00:00 GMT</pubDate>
  <description>&lt;a href="https://news.google.com/rss/articles/example" target="_blank"&gt;${linkText}&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Sheep Esports&lt;/font&gt;</description>
  <source url="https://sheepesports.com">Sheep Esports</source>
</item>
</channel></rss>`;

test("decodes HTML entities left in the news summary", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(rss("KRÜ Blaze survive at GC Championship - Sheep Esports", "MIBR &amp;amp; KRÜ Blaze survive"), { status: 200 }));
  const [article] = await fetchTeamNews("KRÜ Blaze", 5);
  assert.equal(article?.summary, "MIBR & KRÜ Blaze survive Sheep Esports");
});

test("drops a summary that only repeats the title and the source", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(rss("KRÜ Blaze survive at GC Championship - Sheep Esports", "KRÜ Blaze survive at GC Championship"), { status: 200 }));
  const [article] = await fetchTeamNews("KRÜ Blaze", 5);
  assert.equal(article?.title, "KRÜ Blaze survive at GC Championship - Sheep Esports");
  assert.equal(article?.summary, undefined);
});
