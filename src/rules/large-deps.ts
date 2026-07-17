import type { Rule } from '../types.js';
import { allDeps } from '../utils/package.js';
import { finding } from './types.js';

/** Packages that frequently contribute to OOM on constrained Vercel build machines */
const HEAVY_PACKAGES: { name: string; reason: string }[] = [
  { name: 'puppeteer', reason: 'Downloads Chromium; often OOMs or times out on Vercel builds' },
  { name: 'puppeteer-core', reason: 'Heavy browser automation dependency' },
  { name: 'playwright', reason: 'Large browser binaries; prefer external CI for e2e' },
  { name: 'electron', reason: 'Not suitable for Vercel serverless/build targets' },
  { name: 'sharp', reason: 'Native binary; usually fine but can fail on wrong arch — pin a supported version' },
  { name: 'tensorflow', reason: 'Very large; may exceed build memory' },
  { name: '@tensorflow/tfjs-node', reason: 'Large native ML dependency' },
  { name: 'aws-sdk', reason: 'Legacy monolith SDK; prefer @aws-sdk/* modular clients to shrink bundle' },
];

export const largeDepsRule: Rule = {
  id: 'large-deps',
  title: 'Heavy dependencies that risk build OOM',
  severity: 'warn',
  run(ctx) {
    const deps = allDeps(ctx.packageJson);
    const findings = [];

    for (const heavy of HEAVY_PACKAGES) {
      if (heavy.name in deps) {
        findings.push(
          finding(this, {
            id: `large-deps-${heavy.name}`,
            category: 'deps',
            kind: 'oom',
            title: `Heavy dependency: ${heavy.name}`,
            message: heavy.reason,
            file: 'package.json',
            suggestion: `Review whether ${heavy.name} is needed at build/runtime on Vercel.`,
            steps: [
              `Confirm ${heavy.name} is required in production`,
              'Move e2e/browser tools to a separate package or CI job when possible',
              'Watch build memory; upgrade build machine or reduce concurrent work if OOM occurs',
            ],
          }),
        );
      }
    }

    return findings;
  },
};
