import type { Rule } from '../types.js';
import { exists, joinRoot, readText } from '../utils/fs.js';
import { finding } from './types.js';

interface VercelJson {
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  framework?: string;
  rewrites?: unknown[];
  redirects?: unknown[];
  headers?: unknown[];
  functions?: Record<string, { memory?: number; maxDuration?: number }>;
  [key: string]: unknown;
}

export const vercelJsonRule: Rule = {
  id: 'vercel-json',
  title: 'vercel.json validation',
  severity: 'warn',
  async run(ctx) {
    const findings = [];
    const path = joinRoot(ctx.root, 'vercel.json');
    if (!(await exists(path))) {
      return [];
    }

    const raw = await readText(path);
    let config: VercelJson | null = null;
    try {
      config = raw ? (JSON.parse(raw) as VercelJson) : null;
    } catch {
      return [
        finding(this, {
          category: 'vercel-json',
          kind: 'config',
          severity: 'error',
          title: 'Invalid vercel.json',
          message: 'vercel.json is not valid JSON.',
          file: 'vercel.json',
          steps: ['Fix JSON syntax in vercel.json', 'Validate with: node -e "JSON.parse(require(\'fs\').readFileSync(\'vercel.json\',\'utf8\'))"'],
        }),
      ];
    }

    if (!config) return [];

    if (ctx.framework === 'next' && config.outputDirectory) {
      findings.push(
        finding(this, {
          category: 'vercel-json',
          kind: 'config',
          title: 'outputDirectory set for Next.js',
          message:
            'Next.js on Vercel usually should not set outputDirectory; the platform handles the build output.',
          file: 'vercel.json',
          suggestion: 'Remove outputDirectory unless you intentionally use a custom output.',
        }),
      );
    }

    if (ctx.framework === 'vite' && !config.rewrites?.length && !config.outputDirectory) {
      findings.push(
        finding(this, {
          category: 'vercel-json',
          kind: 'config',
          severity: 'info',
          title: 'Vite project without explicit outputDirectory',
          message: 'Consider setting outputDirectory to "dist" if auto-detection fails.',
          file: 'vercel.json',
        }),
      );
    }

    if (config.functions) {
      for (const [route, fn] of Object.entries(config.functions)) {
        if (fn.maxDuration && fn.maxDuration > 60) {
          findings.push(
            finding(this, {
              id: `vercel-json-timeout-${route}`,
              category: 'vercel-json',
              kind: 'config',
              title: 'High function maxDuration',
              message: `Function "${route}" maxDuration=${fn.maxDuration}s may exceed plan limits.`,
              file: 'vercel.json',
              suggestion: 'Confirm your Vercel plan supports this duration; prefer shorter handlers.',
              steps: [
                'Check plan limits for serverless max duration',
                'Move long work to background/queue jobs if possible',
              ],
            }),
          );
        }
        if (fn.memory && fn.memory >= 3008) {
          findings.push(
            finding(this, {
              id: `vercel-json-memory-${route}`,
              category: 'vercel-json',
              kind: 'config',
              title: 'High function memory',
              message: `Function "${route}" memory=${fn.memory}MB can increase cost and cold starts.`,
              file: 'vercel.json',
              suggestion: 'Profile memory usage; reduce if possible to avoid OOM on lower tiers.',
            }),
          );
        }
      }
    }

    return findings;
  },
};
