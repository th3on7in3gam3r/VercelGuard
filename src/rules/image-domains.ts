import type { Rule } from '../types.js';
import { exists, joinRoot, readText } from '../utils/fs.js';
import { finding } from './types.js';

export const imageDomainsRule: Rule = {
  id: 'image-domains',
  title: 'Next.js image domain configuration',
  severity: 'info',
  frameworks: ['next'],
  async run(ctx) {
    const findings = [];
    let configContent = '';
    let configFile = '';
    for (const name of ['next.config.ts', 'next.config.mjs', 'next.config.js', 'next.config.cjs']) {
      const p = joinRoot(ctx.root, name);
      if (await exists(p)) {
        configContent = (await readText(p)) ?? '';
        configFile = name;
        break;
      }
    }

    if (!configFile) return [];

    if (/images\s*:\s*\{[^}]*domains\s*:/.test(configContent) && !/remotePatterns/.test(configContent)) {
      findings.push(
        finding(this, {
          category: 'images',
          kind: 'config',
          title: 'Legacy images.domains in use',
          message:
            'images.domains is deprecated in favor of images.remotePatterns in modern Next.js.',
          file: configFile,
          suggestion: 'Migrate domains to remotePatterns with protocol and hostname.',
          steps: [
            'Replace images.domains with images.remotePatterns',
            'Include protocol (https) and hostname for each host',
          ],
        }),
      );
    }

    return findings;
  },
};
