/**
 * Typed errors for the YouTube layer. The `retryable` flag drives both the
 * serverless retry loop and the client TanStack Query retry policy. Deterministic
 * failures (quota, bad key, 4xx) are NOT retryable; transient ones (5xx, network)
 * are. Shared by client and server, so no env access here.
 */

export type YouTubeErrorReason =
  | 'missingKey'
  | 'quotaExceeded'
  | 'keyInvalid'
  | 'forbidden'
  | 'badRequest'
  | 'notFound'
  | 'transient'
  | 'network'
  | 'parse'
  | 'unknown';

export class YouTubeError extends Error {
  readonly reason: YouTubeErrorReason;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    reason: YouTubeErrorReason,
    message: string,
    options?: { status?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause != null ? { cause: options.cause } : undefined);
    this.name = 'YouTubeError';
    this.reason = reason;
    this.status = options?.status ?? 0;
    this.retryable = options?.retryable ?? false;
  }

  /** True when the cause is YouTube quota exhaustion (serve cached, show notice). */
  get isQuota(): boolean {
    return this.reason === 'quotaExceeded';
  }

  /** True when the key is missing or invalid (client should fall back to mock). */
  get isKeyProblem(): boolean {
    return this.reason === 'missingKey' || this.reason === 'keyInvalid';
  }
}

/** Map a Google API error `reason` string to our typed reason + retry policy. */
export function classifyYouTubeReason(
  httpStatus: number,
  apiReason?: string,
): { reason: YouTubeErrorReason; retryable: boolean } {
  const r = (apiReason ?? '').toLowerCase();

  if (r === 'quotaexceeded' || r === 'dailylimitexceeded' || r === 'ratelimitexceeded') {
    return { reason: 'quotaExceeded', retryable: false };
  }
  if (r === 'keyinvalid' || r === 'badkey') {
    return { reason: 'keyInvalid', retryable: false };
  }
  if (r === 'iprefererblocked' || r === 'accessnotconfigured' || r === 'forbidden') {
    return { reason: 'forbidden', retryable: false };
  }

  if (httpStatus === 400) return { reason: 'badRequest', retryable: false };
  if (httpStatus === 401 || httpStatus === 403) return { reason: 'forbidden', retryable: false };
  if (httpStatus === 404) return { reason: 'notFound', retryable: false };
  if (httpStatus >= 500) return { reason: 'transient', retryable: true };

  return { reason: 'unknown', retryable: false };
}
