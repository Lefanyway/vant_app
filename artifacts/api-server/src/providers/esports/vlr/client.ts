export class VlrStatsClient {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 8_000) {}

  async health() { await this.request<unknown>("/health"); }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ""), `${this.baseUrl.replace(/\/+$/, "")}/`);
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs), headers: { Accept: "application/json", ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`VLR stats request failed: ${response.status}`);
    return await response.json() as T;
  }
}