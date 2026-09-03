import rateLimit, { Options } from 'express-rate-limit';

// Each request spawns the audit-prep CLI as a real subprocess, making this
// the most expensive route in the API to leave unprotected -- especially
// while running on a metered hosting trial. 20/hour per IP is generous for
// legitimate use (testing a handful of contracts) while capping how much a
// bot or abusive script can burn through.
export function createUploadRateLimit(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many analysis requests. Try again in a while.' },
    ...overrides,
  });
}

export const uploadRateLimit = createUploadRateLimit();
