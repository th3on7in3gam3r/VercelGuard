import type { PackageJson } from '../types.js';
import { joinRoot, readJson } from './fs.js';

export async function loadPackageJson(root: string): Promise<PackageJson | null> {
  return readJson<PackageJson>(joinRoot(root, 'package.json'));
}

export function allDeps(pkg: PackageJson | null): Record<string, string> {
  if (!pkg) return {};
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
}

export function hasDep(pkg: PackageJson | null, name: string): boolean {
  return name in allDeps(pkg);
}

export function detectBuildScript(pkg: PackageJson | null): string | null {
  if (!pkg?.scripts) return null;
  if (pkg.scripts.build) return 'build';
  if (pkg.scripts['vercel-build']) return 'vercel-build';
  return null;
}
