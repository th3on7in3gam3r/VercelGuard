import type { Framework, PackageJson } from '../types.js';
import { exists, joinRoot } from '../utils/fs.js';
import { hasDep } from '../utils/package.js';

export async function detectFramework(
  root: string,
  pkg: PackageJson | null,
): Promise<Framework> {
  if (hasDep(pkg, 'next') || (await exists(joinRoot(root, 'next.config.js'))) ||
      (await exists(joinRoot(root, 'next.config.mjs'))) ||
      (await exists(joinRoot(root, 'next.config.ts'))) ||
      (await exists(joinRoot(root, 'next.config.cjs')))) {
    return 'next';
  }
  if (hasDep(pkg, '@remix-run/node') || hasDep(pkg, '@remix-run/react') || hasDep(pkg, 'remix')) {
    return 'remix';
  }
  if (hasDep(pkg, 'nuxt') || (await exists(joinRoot(root, 'nuxt.config.ts'))) ||
      (await exists(joinRoot(root, 'nuxt.config.js')))) {
    return 'nuxt';
  }
  if (hasDep(pkg, 'astro') || (await exists(joinRoot(root, 'astro.config.mjs'))) ||
      (await exists(joinRoot(root, 'astro.config.ts')))) {
    return 'astro';
  }
  if (
    hasDep(pkg, 'vite') ||
    (await exists(joinRoot(root, 'vite.config.ts'))) ||
    (await exists(joinRoot(root, 'vite.config.js'))) ||
    (await exists(joinRoot(root, 'vite.config.mjs')))
  ) {
    return 'vite';
  }
  if (
    (await exists(joinRoot(root, 'index.html'))) &&
    !(await exists(joinRoot(root, 'package.json')))
  ) {
    return 'static';
  }
  if (await exists(joinRoot(root, 'index.html'))) {
    return 'static';
  }
  return 'unknown';
}
