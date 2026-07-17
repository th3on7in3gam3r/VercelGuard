# VercelGuard

Smart pre-deployment checker and error fixer for Git repos targeting **Vercel**.

Catch common pitfalls locally before you push, analyze failed deployment logs, and get manual fix steps or a ready-to-paste AI prompt.

## Install

```bash
cd vercelguard
npm install
npm run build
npm link   # optional: expose `vercelguard` globally
```

Or run without building:

```bash
npx tsx src/index.ts check
```

## Commands

### `check`

Run local pre-deploy rules (framework detection, git hygiene, lockfile, Node version, env coverage, `vercel.json` / Next config, SPA rewrites, heavy deps, and optionally a production build).

```bash
vercelguard check
vercelguard check ./my-app --skip-build
vercelguard check --json --fail-on warn
```

| Flag | Description |
|------|-------------|
| `--skip-build` | Do not run `npm run build` (or yarn/pnpm/bun equivalent) |
| `--fail-on error\|warn\|info` | Exit non-zero when findings meet this severity (default: `error`) |
| `--json` | Machine-readable report |
| `--token <token>` | Vercel token for env comparison (or `VERCEL_TOKEN`) |
| `--cwd <path>` | Project directory |

### `analyze`

Pull recent deployment logs (Vercel CLI preferred, `VERCEL_TOKEN` + API fallback) and parse common failures.

```bash
vercelguard analyze
vercelguard analyze dpl_xxx
vercelguard analyze --logs ./failed-build.txt
```

### `fix`

Print step-by-step manual instructions and a structured AI prompt (optionally write to a file).

```bash
vercelguard fix
vercelguard fix --out prompt.md
vercelguard fix --check --skip-build --out prompt.md
vercelguard fix --logs ./failed-build.txt --out prompt.md
```

## Auth (Vercel)

1. Prefer **Vercel CLI**: `npm i -g vercel` then `vercel login` and `vercel link` in the project.
2. Fallback: set `VERCEL_TOKEN` (or `--token`) and ensure `.vercel/project.json` exists from `vercel link`.

## Config

Optional `vercelguard.config.json` (or `.vercelguard.json`) in the project root:

```json
{
  "disabledRules": ["build"],
  "severityOverrides": {
    "large-deps": "info"
  },
  "failOn": "error"
}
```

## Built-in rules

- `git-hygiene` — `.gitignore` for secrets/artifacts; sensitive files in the working tree
- `lockfile` — exactly one package manager lockfile
- `node-version` — `.nvmrc` / `engines.node` vs Node 18+
- `env-vars` — `.env.example` / `process.env` usage vs local + Vercel env
- `vercel-json` — JSON validity, Next `outputDirectory`, function memory/timeout hints
- `next-config` — static export, image config, `generateStaticParams` heuristics
- `image-domains` — legacy `images.domains` migration hint
- `spa-rewrites` — SPA catch-all rewrite for Vite/client routers
- `large-deps` — heavy packages that often OOM builds
- `build` — runs the production build unless `--skip-build`

## Exit codes

- `0` — passed (no findings at or above `--fail-on`)
- `1` — failed checks / analyze errors / unexpected CLI error

## Security

Secret values are never printed. Tokens and password-like env assignments are redacted in log excerpts and AI prompts. Do not commit `.env` files.
