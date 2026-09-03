import express from 'express';
import request from 'supertest';
import { createUploadRateLimit } from '../src/middleware/rateLimit';

describe('uploadRateLimit', () => {
  it('allows requests under the limit and blocks once it is exceeded', async () => {
    const app = express();
    app.set('trust proxy', 1);
    // A tightly-scoped instance so the test is fast and doesn't depend on
    // the production threshold (20/hour).
    app.get('/test', createUploadRateLimit({ windowMs: 60_000, limit: 3 }), (_req, res) => {
      res.json({ ok: true });
    });

    const agent = request(app);

    for (let i = 0; i < 3; i++) {
      const res = await agent.get('/test');
      expect(res.status).toBe(200);
    }

    const blocked = await agent.get('/test');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many/i);
  });
});
