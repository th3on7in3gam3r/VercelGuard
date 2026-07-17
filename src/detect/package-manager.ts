import type { PackageManager } from '../types.js';
import { exists, joinRoot } from '../utils/fs.js';

export async function detectPackageManager(root: string): Promise<PackageManager> {
  const checks: [PackageManager, string][] = [
    ['pnpm', 'pnpm-lock.yaml'],
    ['yarn', 'yarn.lock'],
    ['bun', 'bun.lockb'],
    ['npm', 'package-lock.json'],
  ];
  const found: PackageManager[] = [];
  for (const [pm, file] of checks) {
    if (await exists(joinRoot(root, file))) found.push(pm);
  }
  if (found.length === 1) return found[0];
  if (found.length > 1) return found[0]; // first match; lockfile rule will warn
  return 'unknown';
}

export function installCommand(pm: PackageManager): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun install';
    default:
      return 'npm install';
  }
}

export function runScriptCommand(pm: PackageManager, script: string): string {
  switch (pm) {
    case 'pnpm':
      return `pnpm run ${script}`;
    case 'yarn':
      return `yarn ${script}`;
    case 'bun':
      return `bun run ${script}`;
    default:
      return `npm run ${script}`;
  }
}
