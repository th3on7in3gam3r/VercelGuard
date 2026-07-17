import type { Rule } from '../types.js';
import { exists, joinRoot, readText } from '../utils/fs.js';
import { finding } from './types.js';

interface VercelJson {
  rewrites?: Array<{ source?: string; destination?: string }>;
}

function hasSpaCatchAll(rewrites: VercelJson['rewrites']): boolean {
  if (!rewrites?.length) return false;
  return rewrites.some((r) => {
    const src = r.source ?? '';
    const dest = r.destination ?? '';
    return (
      (src.includes(':path') || src === '/(.*)' || src.includes('(.*)') || src === '/:path*') &&
      (dest.includes('index.html') || dest === '/index.html')
    );
  });
}

export const spaRewritesRule: Rule = {
  id: 'spa-rewrites',
  title: 'SPA fallback rewrites for client routers',
  severity: 'warn',
  frameworks: ['vite', 'static'],
  async run(ctx) {
    const findings = [];
    const hasIndex = await exists(joinRoot(ctx.root, 'index.html'));
    if (!hasIndex && ctx.framework !== 'vite') return [];

    // Detect client-side router usage
    const pkgDeps = {
      ...(ctx.packageJson?.dependencies ?? {}),
      ...(ctx.packageJson?.devDependencies ?? {}),
    };
    const usesClientRouter =
      'react-router-dom' in pkgDeps ||
      'react-router' in pkgDeps ||
      '@tanstack/react-router' in pkgDeps ||
      'vue-router' in pkgDeps ||
      'svelte-spa-router' in pkgDeps ||
      ctx.framework === 'vite';

    if (!usesClientRouter) return [];

    let rewrites: VercelJson['rewrites'] = [];
    if (ctx.hasVercelJson) {
      const raw = await readText(joinRoot(ctx.root, 'vercel.json'));
      try {
        const parsed = raw ? (JSON.parse(raw) as VercelJson) : {};
        rewrites = parsed.rewrites ?? [];
      } catch {
        // vercel-json rule handles invalid JSON
      }
    }

    if (!hasSpaCatchAll(rewrites)) {
      findings.push(
        finding(this, {
          category: 'spa',
          kind: 'spa_404',
          title: 'Missing SPA catch-all rewrite',
          message:
            'Client-side routing typically needs a rewrite so deep links serve index.html instead of 404 on Vercel.',
          file: ctx.hasVercelJson ? 'vercel.json' : undefined,
          suggestion:
            'Add a rewrite: { "source": "/(.*)", "destination": "/index.html" } (adjust for your framework).',
          steps: [
            'Create or edit vercel.json',
            'Add rewrites with a catch-all to index.html',
            'Deploy a preview and open a nested client route directly',
          ],
        }),
      );
    }

    return findings;
  },
};
