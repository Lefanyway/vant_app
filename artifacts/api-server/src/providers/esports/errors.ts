export class ProviderError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502, public readonly retryable = false, public readonly upstreamStatus?: number) {
    super(message);
    this.name = 'ProviderError';
  }
}
export function providerHttpError(status: number): ProviderError {
  if (status === 401) return new ProviderError('PROVIDER_AUTH_FAILED', 'Esports provider authentication failed', 503, false, status);
  if (status === 403) return new ProviderError('PROVIDER_ACCESS_DENIED', 'Esports data is not available on the configured provider plan', 503, false, status);
  if (status === 429) return new ProviderError('PROVIDER_RATE_LIMITED', 'Esports provider request limit reached; try again later', 503, true, status);
  if (status === 404) return new ProviderError('PROVIDER_NOT_FOUND', 'Requested esports data was not found', 404, false, status);
  return new ProviderError('PROVIDER_FAILED', 'Esports provider could not complete the request', 502, status >= 500, status);
}
export const isProviderNotFound = (error: unknown) => error instanceof ProviderError && error.upstreamStatus === 404;
