# Scout Audit

Audit-prep tooling for Soroban smart contracts. Upload a contract, get back a readiness score, a list of security findings, and (for compiled contracts) a gas profile — before you pay for a real audit.

**Live**: [scout-audit-flax.vercel.app](https://scout-audit-flax.vercel.app) (frontend) · backend runs on Railway

The project has three parts:

| Path | What it is |
|---|---|
| [`app/`](app/) | Next.js frontend — the dashboard UI |
| [`backend/`](backend/) | Express/TypeScript API — receives uploads, runs the CLI, stores reports |
| [`cli/`](cli/) | Rust CLI (`audit-prep`) — the actual analysis engine |

## How analysis works

`cli/` is a standalone Rust binary that runs three passes over a contract and combines them into a score (0–100, ready at ≥70):

1. **[Scout](https://github.com/CoinFabrik/scout-audit)** — if the input is part of a Cargo project and `cargo-scout-audit` is installed, runs it and folds its findings in. Skipped (not an error) otherwise.
2. **Custom linter** — 7 pattern-based rules over Rust source: missing `require_auth` checks, unchecked storage reads, unchecked arithmetic, missing event emission, missing TTL extension, duplicate error codes, undocumented public functions.
3. **Gas profiling** — only for a compiled `.wasm` input. Parses the module and assigns a heuristic, instruction-weighted cost per exported function (calls and memory ops weighted higher, matching Soroban's real cost shape). This is a relative signal, not the Soroban host's actual metered gas.

It works standalone (`audit-prep scan ./contract.rs`), from CI, or called by the backend.

## Running it locally

**Frontend**
```bash
pnpm install
pnpm dev          # http://localhost:3000
```

**Backend** — needs a `.env` (copy `backend/.env.example`) with `JWT_SECRET` set at minimum; Postgres is optional for local dev (the server starts without it, just report/project persistence and GitHub OAuth won't work until it's connected):
```bash
cd backend
pnpm install
cp .env.example .env   # set JWT_SECRET
docker compose up postgres -d   # optional, for persistence
pnpm dev          # http://localhost:5000
```

**CLI** — the backend spawns this binary (`AUDIT_PREP_CLI_PATH` in `backend/.env`, defaults to `../cli/target/release/audit-prep`):
```bash
cd cli
cargo build --release
./target/release/audit-prep scan ./tests/fixtures/sample_contracts/token.rs
```

## Deployment

- **Frontend** → Vercel. Set `NEXT_PUBLIC_API_URL` to wherever the backend is hosted.
- **Backend + Postgres** → Railway. `railway.json` and `backend/Dockerfile` (multi-stage: builds the Rust CLI and the Node backend into one image) are already set up — point a Railway service at this repo and it should pick both up. Needs `JWT_SECRET`, `DATABASE_URL` (Railway's Postgres plugin provides this), and `FRONTEND_URL` (for CORS) set as service variables.

## Status

The upload → analyze → report flow works end-to-end without an account (anonymous requests just aren't persisted). Signed-in persistence (saved reports, project history) and GitHub OAuth are built but not yet verified against a live database.

---

This repo is linked to a [v0](https://v0.app) project for frontend iteration — [continue in v0 →](https://v0.app/chat/projects/prj_Nl1XhoupO6arCmFVyE8gBkHdQJPE). Changes pushed to `main` from v0 land here directly.
