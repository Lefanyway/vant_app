import { ProviderError, providerHttpError } from '../errors';

export class PandaScoreClient {
  constructor(private readonly token: string, private readonly baseUrl = 'https://api.pandascore.co', private readonly options: { timeoutMs?: number; attempts?: number; retryDelayMs?: number; fetcher?: typeof fetch } = {}) {}
  async request<T>(endpoint: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => value !== undefined && url.searchParams.set(key, String(value)));
    const attempts = Math.min(2, Math.max(1, this.options.attempts ?? 2));
    for (let attempt = 0; attempt < attempts; attempt++) {
      let failure: ProviderError;
      try {
        const response = await (this.options.fetcher ?? fetch)(url, { signal: AbortSignal.timeout(this.options.timeoutMs ?? 5000), headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' } });
        if (!response.ok) throw providerHttpError(response.status);
        try { return await response.json() as T; }
        catch { throw new ProviderError('PROVIDER_INVALID_DATA', 'Esports provider returned invalid data'); }
      } catch (error) {
        failure = error instanceof ProviderError ? error : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
          ? new ProviderError('PROVIDER_TIMEOUT', 'Esports provider timed out', 504, true)
          : new ProviderError('PROVIDER_UNREACHABLE', 'Esports provider is temporarily unreachable', 503, true);
      }
      if (!failure.retryable || attempt === attempts - 1) throw failure;
      await new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs ?? 200));
    }
    throw new ProviderError('PROVIDER_FAILED', 'Esports provider could not complete the request');
  }
  async fetchAllPages<T>(endpoint: string, params: Record<string, string | number | boolean | undefined> = {}, maxPages = 20): Promise<{ rows: T[]; pages: number }> {
    const rows: T[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const chunk = await this.request<T[]>(endpoint, { ...params, page, per_page: 100 });
      if (!Array.isArray(chunk)) throw new ProviderError('PROVIDER_INVALID_DATA', 'Esports provider returned an invalid list');
      rows.push(...chunk);
      if (chunk.length < 100) return { rows, pages: page };
    }
    throw new ProviderError('PROVIDER_DATA_LIMIT', 'Too much esports data; narrow the game or date range', 503);
  }
}
