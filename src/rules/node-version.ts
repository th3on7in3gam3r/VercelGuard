import type { Rule } from '../types.js';
import { exists, joinRoot, readText } from '../utils/fs.js';
import { finding } from './types.js';

function parseMajor(range: string): number | null {
  const m = range.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export const nodeVersionRule: Rule = {
  id: 'node-version',
  title: 'Node.js version alignment',
  severity: 'warn',
  async run(ctx) {
    const findings = [];
    let declared: string | null = null;
    let source = '';

    const nvmrc = await readText(joinRoot(ctx.root, '.nvmrc'));
    if (nvmrc?.trim()) {
      declared = nvmrc.trim();
      source = '.nvmrc';
    }

    const nodeVersion = await readText(joinRoot(ctx.root, '.node-version'));
    if (!declared && nodeVersion?.trim()) {
      declared = nodeVersion.trim();
      source = '.node-version';
    }

    if (!declared && ctx.packageJson?.engines?.node) {
      declared = ctx.packageJson.engines.node;
      source = 'package.json engines.node';
    }

    const major = declared ? parseMajor(declared) : null;
    const runtimeMajor = parseMajor(process.versions.node);

    if (!declared) {
      findings.push(
        finding(this, {
          category: 'node',
          kind: 'config',
          severity: 'info',
          title: 'No Node version pinned',
          message:
            'No .nvmrc, .node-version, or engines.node found. Vercel will use its default Node version.',
          suggestion: 'Pin Node 18+ via engines.node or .nvmrc to match local and CI.',
          steps: [
            'Add "engines": { "node": ">=18" } to package.json, or create .nvmrc with 20',
            'Optionally set Node version in the Vercel project settings',
          ],
        }),
      );
    } else if (major !== null && major < 18) {
      findings.push(
        finding(this, {
          category: 'node',
          kind: 'config',
          severity: 'error',
          title: 'Node version below Vercel support',
          message: `${source} specifies Node ${declared}; Vercel expects Node 18+.`,
          file: source.startsWith('.') ? source : 'package.json',
          suggestion: 'Upgrade to Node 18, 20, or 22.',
          steps: [
            `Update ${source} to Node 18+`,
            'Retest locally with the same major version',
          ],
        }),
      );
    } else if (
      major !== null &&
      runtimeMajor !== null &&
      !declared.includes('>') &&
      !declared.includes('*') &&
      !declared.includes('x') &&
      major !== runtimeMajor
    ) {
      findings.push(
        finding(this, {
          category: 'node',
          kind: 'config',
          title: 'Local Node differs from declared version',
          message: `Declared ${declared} (${source}) but running Node ${process.versions.node}.`,
          suggestion: 'Align local Node with the version Vercel will use.',
          steps: [
            `Switch local Node to major ${major} (nvm use / fnm use)`,
            'Re-run install and build',
          ],
        }),
      );
    } else if (
      major !== null &&
      runtimeMajor !== null &&
      declared.trim().startsWith('>=') &&
      runtimeMajor < major
    ) {
      findings.push(
        finding(this, {
          category: 'node',
          kind: 'config',
          severity: 'error',
          title: 'Local Node below engines requirement',
          message: `engines require ${declared} but running Node ${process.versions.node}.`,
          suggestion: 'Upgrade local Node to satisfy package.json engines.',
          steps: [`Install Node ${major}+`, 'Re-run install and build'],
        }),
      );
    }

    // package.json presence of engines is enough; also check vercel.json unused
    if (await exists(joinRoot(ctx.root, 'package.json')) && !ctx.packageJson) {
      findings.push(
        finding(this, {
          category: 'node',
          kind: 'config',
          severity: 'error',
          title: 'Invalid package.json',
          message: 'package.json exists but could not be parsed.',
          file: 'package.json',
        }),
      );
    }

    return findings;
  },
};
