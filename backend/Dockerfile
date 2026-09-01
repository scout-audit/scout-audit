# Build context is the repo ROOT (not backend/), since this image needs
# both backend/ and the sibling cli/ crate. On Railway: set the service's
# Dockerfile Path to "backend/Dockerfile" and leave the root directory as
# the repo root so both directories are visible to COPY.

# ---- Stage 1: build the Rust CLI ----
FROM rust:1-slim-bookworm AS cli-builder
WORKDIR /cli
COPY cli/Cargo.toml cli/Cargo.lock ./
COPY cli/src ./src
RUN cargo build --release

# ---- Stage 2: build the Node backend ----
FROM node:22-slim AS backend-builder
RUN corepack enable
WORKDIR /backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN pnpm run build

# ---- Stage 3: runtime image ----
FROM node:22-slim
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
ENV AUDIT_PREP_CLI_PATH=/usr/local/bin/audit-prep

COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=backend-builder /backend/dist ./dist
COPY --from=cli-builder /cli/target/release/audit-prep /usr/local/bin/audit-prep

# Railway (and most PaaS hosts) injects PORT at runtime; the app already
# reads it via process.env.PORT, so no build-time value is needed here.
CMD ["node", "dist/index.js"]
