import type { Rule } from '../types.js';
import { exists, joinRoot } from '../utils/fs.js';
import { finding } from './types.js';

const LOCKFILES = [
  { file: 'package-lock.json', pm: 'npm' },
  { file: 'yarn.lock', pm: 'yarn' },
  { file: 'pnpm-lock.yaml', pm: 'pnpm' },
  { file: 'bun.lockb', pm: 'bun' },
] as const;

export const lockfileRule: Rule = {
  id: 'lockfile',
  title: 'Lockfile presence and uniqueness',
  severity: 'error',
  async run(ctx) {
    const present = [];
    for (const lf of LOCKFILES) {
      if (await exists(joinRoot(ctx.root, lf.file))) {
        present.push(lf);
      }
    }

    if (present.length === 0) {
      return [
        finding(this, {
          category: 'lockfile',
          kind: 'config',
          title: 'No lockfile found',
          message:
            'Vercel installs are more reproducible with a committed lockfile (package-lock.json, yarn.lock, pnpm-lock.yaml, or bun.lockb).',
          suggestion: 'Run your package manager install and commit the lockfile.',
          steps: [
            'Run npm install / yarn / pnpm install / bun install',
            'Commit the generated lockfile',
            'Ensure only one lockfile type is present',
          ],
        }),
      ];
    }

    if (present.length > 1) {
      return [
        finding(this, {
          category: 'lockfile',
          kind: 'config',
          title: 'Multiple lockfiles detected',
          message: `Found: ${present.map((p) => p.file).join(', ')}. Vercel may pick the wrong package manager.`,
          suggestion: 'Keep a single lockfile matching your intended package manager.',
          steps: [
            `Decide on one package manager`,
            `Remove unused lockfiles: ${present.map((p) => p.file).join(', ')}`,
            'Reinstall and commit the remaining lockfile',
          ],
          meta: { lockfiles: present.map((p) => p.file) },
        }),
      ];
    }

    return [];
  },
};
