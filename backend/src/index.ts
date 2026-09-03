import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { sequelize } from './db';
// Side-effect import: registers Sequelize model associations.
import './db/models';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import * as routes from './routes';
import logger from './utils/logger';

const app: Express = express();

// Railway (and most PaaS hosts) puts exactly one reverse proxy in front of
// the container. Trusting it is what makes req.ip / express-rate-limit see
// the real client IP from X-Forwarded-For instead of the proxy's own IP --
// without this, rate limiting would count every visitor as the same client.
app.set('trust proxy', 1);

// ============ MIDDLEWARE ============

app.use(corsMiddleware);
app.use(cookieParser());

// Uploads go through multer (memory storage), not JSON bodies, so keep this
// limit small rather than matching the 50MB upload cap.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============ ROUTES ============

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/upload', routes.upload);
app.use('/api/reports', routes.reports);
app.use('/api/projects', routes.projects);
app.use('/api/auth', routes.auth);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============ ERROR HANDLING ============

app.use(errorHandler);

// ============ DATABASE & SERVER ============

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connected');
    await sequelize.sync({ alter: config.nodeEnv === 'development' });
  } catch (err) {
    // Don't crash the whole server over the DB: routes that don't touch it
    // (health check, anonymous contract analysis) should stay usable. Any
    // route that does need the DB will fail on its own at request time.
    logger.error('Database unavailable at startup — DB-backed routes will fail until it recovers:', err);
  }

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
  });
}

start();

export default app;
