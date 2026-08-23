export class PandaScoreClient {
  constructor(private readonly token: string, private readonly baseUrl = "https://api.pandascore.co") {}

  async request<T>(endpoint: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => value !== undefined && url.searchParams.set(key, String(value)));
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(url, { signal: controller.signal, headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" } });
        if (response.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          continue;
        }
        if (!response.ok) throw new Error(`PandaScore request failed: ${response.status}`);
        return await response.json() as T;
      } catch (error) { lastError = error; if (attempt === 2) throw error; }
      finally { clearTimeout(timeout); }
    }
    throw lastError ?? new Error("Provider request failed");
  }

  /** Fetches every page of a paginated endpoint. Safety cap prevents infinite loops. */
  async fetchAllPages<T>(endpoint: string, params: Record<string, string | number | boolean | undefined> = {}, maxPages = 20): Promise<{ rows: T[]; pages: number }> {
    const rows: T[] = [];
    let pages = 0;
    let lastSize = 0;
    for (let page = 1; page <= maxPages; page += 1) {
      const chunk = await this.request<T[]>(endpoint, { ...params, page, per_page: 100 });
      pages += 1;
      lastSize = chunk.length;
      rows.push(...chunk);
      if (chunk.length < 100) break;
    }
    if (pages === maxPages && lastSize === 100) {
      console.warn(`[VANT esports] pagination truncated endpoint=${endpoint} pages=${pages} — increase maxPages or narrow the query`);
    }
    return { rows, pages };
  }
}
