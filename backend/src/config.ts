import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  // Railway (and most PaaS hosts) injects PORT dynamically -- always defer to it.
  port: Number(process.env.PORT) || 5000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',

  // No insecure fallback: a weak default secret is worse than failing fast.
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  db: {
    // Most hosted Postgres (Railway, Render, Neon, Supabase) hand you a
    // single connection string -- prefer it when present. DB_HOST/etc.
    // stay as the local/docker-compose fallback.
    url: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'soroban_audit_prep',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  },

  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },

  auditCliPath: process.env.AUDIT_PREP_CLI_PATH || 'audit-prep',

  maxUploadSizeBytes: 50 * 1024 * 1024,
};
