import fs from 'fs-extra';
import type { Rule } from '../types.js';
import { exists, joinRoot, listFiles, readText } from '../utils/fs.js';
import { finding } from './types.js';

async function findNextConfig(root: string): Promise<string | null> {
  for (const name of ['next.config.ts', 'next.config.mjs', 'next.config.js', 'next.config.cjs']) {
    if (await exists(joinRoot(root, name))) return name;
  }
  return null;
}

export const nextConfigRule: Rule = {
  id: 'next-config',
  title: 'Next.js config checks',
  severity: 'warn',
  frameworks: ['next'],
  async run(ctx) {
    const findings = [];
    const configName = await findNextConfig(ctx.root);
    if (!configName) {
      findings.push(
        finding(this, {
          category: 'next-config',
          kind: 'config',
          severity: 'info',
          title: 'No next.config found',
          message: 'Next.js project without next.config.* — defaults are fine, but image domains may need config.',
        }),
      );
      return findings;
    }

    const content = (await readText(joinRoot(ctx.root, configName))) ?? '';

    if (/output\s*:\s*['"]export['"]/.test(content)) {
      findings.push(
        finding(this, {
          category: 'next-config',
          kind: 'config',
          title: 'Static export mode enabled',
          message:
            'output: "export" disables many Next.js server features (API routes, ISR, middleware). Ensure this is intentional for Vercel.',
          file: configName,
          suggestion: 'Remove output: "export" unless you need a fully static site.',
          steps: [
            `Review ${configName} output setting`,
            'Confirm you do not rely on server-only Next features',
          ],
        }),
      );
    }

    const usesNextImage =
      content.includes('next/image') ||
      (await exists(joinRoot(ctx.root, 'app'))) ||
      (await exists(joinRoot(ctx.root, 'pages')));

    if (
      usesNextImage &&
      !/images\s*:/.test(content) &&
      !/remotePatterns/.test(content)
    ) {
      findings.push(
        finding(this, {
          category: 'images',
          kind: 'config',
          severity: 'info',
          title: 'No images.remotePatterns configured',
          message:
            'If you load remote images with next/image, configure images.remotePatterns (or legacy domains).',
          file: configName,
          suggestion: 'Add images.remotePatterns for allowed remote hosts.',
        }),
      );
    }

    // Heuristic: dynamic segments without generateStaticParams in app router
    const appDir = joinRoot(ctx.root, 'app');
    if (await exists(appDir)) {
      const dynamicPages = await findDynamicRoutes(appDir);
      for (const route of dynamicPages.slice(0, 10)) {
        const pageContent = (await readText(route.file)) ?? '';
        if (
          !pageContent.includes('generateStaticParams') &&
          /export\s+const\s+dynamic\s*=\s*['"]force-static['"]/.test(pageContent)
        ) {
          findings.push(
            finding(this, {
              id: `next-config-static-params-${route.route}`,
              category: 'next-config',
              kind: 'config',
              title: 'force-static dynamic route may need generateStaticParams',
              message: `${route.route} is force-static with dynamic segments but no generateStaticParams.`,
              file: route.file.replace(ctx.root + '/', ''),
              suggestion: 'Add generateStaticParams or change rendering mode.',
              steps: [
                'Implement generateStaticParams for known paths',
                'Or use dynamic rendering if paths are unbounded',
              ],
            }),
          );
        }
      }
    }

    return findings;
  },
};

async function findDynamicRoutes(
  dir: string,
  base = '',
): Promise<{ route: string; file: string }[]> {
  const results: { route: string; file: string }[] = [];
  const entries = await listFiles(dir);
  for (const name of entries) {
    const full = joinRoot(dir, name);
    const st = await fs.stat(full);
    if (st.isDirectory()) {
      const seg = name.startsWith('(') ? base : `${base}/${name}`;
      results.push(...(await findDynamicRoutes(full, seg || `/${name}`)));
    } else if (/^page\.(tsx|ts|jsx|js)$/.test(name) && /\[[^\]]+\]/.test(base)) {
      results.push({ route: base || '/', file: full });
    }
  }
  return results;
}
