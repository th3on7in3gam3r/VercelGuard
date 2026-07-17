import fs from 'fs-extra';
import path from 'path';
import type { Rule } from '../types.js';
import { createVercelClient } from '../vercel/client.js';
import { extractProcessEnvKeys, parseEnvKeys } from '../utils/env.js';
import { exists, joinRoot, listFiles, readText } from '../utils/fs.js';
import { finding } from './types.js';

async function collectRequiredKeys(root: string): Promise<string[]> {
  const keys = new Set<string>();

  for (const name of ['.env.example', '.env.sample', '.env.template', '.env.local.example']) {
    const p = joinRoot(root, name);
    if (await exists(p)) {
      for (const k of await parseEnvKeys(p)) keys.add(k);
    }
  }

  const dirs = ['src', 'app', 'pages', 'lib', 'server'];
  for (const dir of dirs) {
    const abs = joinRoot(root, dir);
    if (!(await exists(abs))) continue;
    await walkScan(abs, keys, 0);
  }

  keys.delete('NODE_ENV');
  keys.delete('VERCEL_TOKEN');
  return [...keys].sort();
}

async function walkScan(dir: string, keys: Set<string>, depth: number): Promise<void> {
  if (depth > 4) return;
  let entries: string[] = [];
  try {
    entries = await listFiles(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === '.next') continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = await fs.stat(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      await walkScan(full, keys, depth + 1);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(name)) {
      const content = await readText(full);
      if (content) {
        for (const k of extractProcessEnvKeys(content)) keys.add(k);
      }
    }
  }
}

export const envVarsRule: Rule = {
  id: 'env-vars',
  title: 'Environment variable coverage',
  severity: 'warn',
  async run(ctx) {
    const findings = [];
    const required = await collectRequiredKeys(ctx.root);

    if (required.length === 0) {
      findings.push(
        finding(this, {
          category: 'env',
          kind: 'missing_env',
          severity: 'info',
          title: 'No env keys detected',
          message:
            'No .env.example keys or process.env references found in common directories. Add .env.example for clearer checks.',
          suggestion: 'Create .env.example listing required variables (names only).',
        }),
      );
      return findings;
    }

    const localEnvPath = joinRoot(ctx.root, '.env');
    if (await exists(localEnvPath)) {
      const localSet = new Set(await parseEnvKeys(localEnvPath));
      const missing = required.filter((k) => !localSet.has(k));
      if (missing.length) {
        findings.push(
          finding(this, {
            category: 'env',
            kind: 'missing_env',
            title: 'Local .env missing keys from example/usage',
            message: `Missing locally: ${missing.slice(0, 15).join(', ')}${missing.length > 15 ? '…' : ''}`,
            file: '.env',
            suggestion: 'Add missing keys to .env (do not commit secrets).',
            steps: [
              'Copy from .env.example where applicable',
              'Fill values for local development',
              'Ensure production values are set in the Vercel dashboard',
            ],
            meta: { missingKeys: missing },
          }),
        );
      }
    }

    if (ctx.vercelLink) {
      try {
        const client = createVercelClient({
          root: ctx.root,
          token: ctx.options.token ?? process.env.VERCEL_TOKEN,
          link: ctx.vercelLink,
        });
        const remote = await client.listEnvKeys();
        if (remote) {
          const remoteSet = new Set(remote.map((k) => k.toUpperCase()));
          const missingRemote = required.filter((k) => !remoteSet.has(k.toUpperCase()));
          if (missingRemote.length) {
            findings.push(
              finding(this, {
                category: 'env',
                kind: 'missing_env',
                severity: 'error',
                title: 'Env keys missing on Vercel project',
                message: `Not found in Vercel env: ${missingRemote.slice(0, 15).join(', ')}${missingRemote.length > 15 ? '…' : ''}`,
                suggestion:
                  'Add these variables in Vercel Project Settings → Environment Variables (or vercel env add).',
                steps: [
                  ...missingRemote.slice(0, 8).map((k) => `vercel env add ${k}`),
                  'Redeploy after adding variables',
                ],
                meta: { missingKeys: missingRemote },
              }),
            );
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        findings.push(
          finding(this, {
            category: 'env',
            kind: 'missing_env',
            severity: 'info',
            title: 'Could not compare Vercel env',
            message: msg,
            suggestion: 'Run `vercel link` and authenticate, or set VERCEL_TOKEN.',
          }),
        );
      }
    } else {
      findings.push(
        finding(this, {
          category: 'env',
          kind: 'missing_env',
          severity: 'info',
          title: 'Project not linked to Vercel',
          message: `Detected ${required.length} env key(s) locally; link the project to compare against Vercel.`,
          suggestion: 'Run `vercel link` in this directory to enable env comparison.',
          meta: { detectedKeys: required },
        }),
      );
    }

    return findings;
  },
};
