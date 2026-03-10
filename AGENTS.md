# Repository Guidelines

## Project Structure & Module Organization
- `apps/web`: Next.js + Electron desktop shell (primary UI), including Electron runtime files in `apps/web/electron`.
- `apps/rust-api`: Main backend (`axum`) serving `/healthz`, `/api/preview`, `/api/generate`, and export stats.
- `apps/rust-desktop` and `apps/tauri-desktop`: Native desktop variants and packaging experiments.
- `apps/api`: Legacy FastAPI compatibility layer (keep changes minimal unless required).
- `apps/formatter`: Python formatter package for Markdown to DOCX utilities.
- `tests`: Python integration/regression tests. Web E2E lives in `apps/web/tests`; Rust contract tests live in `apps/rust-api/tests`.
- `docs`: product, release, policy, and implementation plan documents.

## Build, Test, and Development Commands
- `npm run dev` (repo root): starts desktop development flow (web + Rust API + Electron).
- `npm run dev:web`: run Next.js UI only.
- `npm run dev:api`: run Rust API only.
- `npm run test`: top-level verification (Rust tests/checks + Electron backend tests).
- `npm run build:desktop`: build desktop installers via Electron Builder.
- `npm --prefix apps/web run lint`: run ESLint for the web app.
- `cd apps/web && npx playwright test`: run browser E2E tests.
- `pytest tests apps/api/tests`: run Python test suites.

## Coding Style & Naming Conventions
- TypeScript/React: follow `apps/web/eslint.config.mjs`; prefer PascalCase for components and camelCase for functions/hooks.
- Rust: use Rust 2021 idioms; keep modules/functions snake_case and run `cargo fmt` before PR.
- Python: 4-space indentation, snake_case for modules/functions, and explicit imports for cross-package code.
- Test files: Python `test_*.py`, Playwright `*.spec.ts`, Rust tests in `tests/` or `#[cfg(test)]` modules.

## Testing Guidelines
- Add or update tests for every behavior change in the touched layer (web, Rust API, or Python formatter).
- No strict repository-wide coverage gate is enforced today; PRs should include meaningful regression tests.
- For endpoint changes, validate both happy path and error path.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes already used in history: `feat:`, `fix:`, `docs:`, `chore:`, `perf:`.
- Keep commits focused by subsystem (for example: `fix: adjust rust-api preview error handling`).
- PRs should include: purpose, key changes, test commands run, and screenshots/recordings for UI or desktop behavior changes.
- Link related issues and explicitly call out breaking changes or new environment variables.

## Security & Configuration Tips
- Never commit signing or release secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_*`, tokens).
- Use environment variables for local overrides like `NEXT_PUBLIC_API_BASE`, `API_HOST`, and `API_PORT`.
