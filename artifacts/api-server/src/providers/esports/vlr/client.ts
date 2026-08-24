export class VlrStatsClient {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 8_000) {}

  async health() { await this.request<unknown>("/health"); }

  async listMatches(query: "upcoming" | "upcoming_extended" | "live_score" | "results") {
    return this.request<{ status?: string; data?: { segments?: unknown[] } }>(`/v2/match?q=${query}&num_pages=1`);
  }

  async getMatchDetails(providerMatchId: string) {
    return this.request<{ status?: string; data?: { segments?: unknown[] } }>(`/v2/match/details?match_id=${encodeURIComponent(providerMatchId)}`);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ""), `${this.baseUrl.replace(/\/+$/, "")}/`);
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs), headers: { Accept: "application/json", ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`VLR stats request failed: ${response.status}`);
    return await response.json() as T;
  }
}