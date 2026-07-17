import type { ErrorKind, Finding, Severity } from '../types.js';
import { redactSecrets } from '../utils/env.js';

interface Pattern {
  kind: ErrorKind;
  title: string;
  severity: Severity;
  regex: RegExp;
  suggestion: string;
  steps: string[];
}

const PATTERNS: Pattern[] = [
  {
    kind: 'missing_env',
    title: 'Missing environment variable',
    severity: 'error',
    regex:
      /(?:Environment variable|env(?:ironment)?(?: variable)?)[^\n]*?(?:missing|not (?:found|set|defined)|undefined)[^\n]*?([A-Z_][A-Z0-9_]{2,})|(?:([A-Z_][A-Z0-9_]{2,})\s+(?:is not|was not)\s+(?:defined|set|found))|Missing:\s*([A-Z_][A-Z0-9_]*)/i,
    suggestion: 'Add the missing environment variable in the Vercel project settings for the correct environment.',
    steps: [
      'Identify the missing variable name from the log',
      'vercel env add <NAME>  (or Dashboard → Settings → Environment Variables)',
      'Redeploy the project',
    ],
  },
  {
    kind: 'oom',
    title: 'Out of memory / SIGKILL',
    severity: 'error',
    regex: /JavaScript heap out of memory|ENOMEM|SIGKILL|Killed|out of memory|FATAL ERROR: Reached heap limit/i,
    suggestion: 'Reduce build memory pressure or increase the build machine resources on Vercel.',
    steps: [
      'Run the build locally with NODE_OPTIONS=--max-old-space-size=4096 to reproduce',
      'Remove unused heavy dependencies; split monorepo builds',
      'Upgrade Vercel build resources if on Hobby and hitting limits',
    ],
  },
  {
    kind: 'build_timeout',
    title: 'Build timeout',
    severity: 'error',
    regex: /build.*(timed out|timeout)|Error:.*timeout|Task timed out|maxDuration/i,
    suggestion: 'Shorten the build or raise function/build duration limits within plan constraints.',
    steps: [
      'Profile slow build steps (typecheck, lint, image optimization)',
      'Cache dependencies; avoid downloading large binaries at build time',
      'Check vercel.json functions.maxDuration against plan limits',
    ],
  },
  {
    kind: 'type_error',
    title: 'TypeScript type error',
    severity: 'error',
    regex: /Type (?:error|Error)|error TS\d{4}|Failed to compile/i,
    suggestion: 'Fix TypeScript errors locally with the same tsconfig used in CI/Vercel.',
    steps: [
      'Run npx tsc --noEmit (or your framework typecheck)',
      'Fix the first reported type error',
      'Ensure next.config does not ignoreBuildErrors in production',
    ],
  },
  {
    kind: 'module_not_found',
    title: 'Module not found',
    severity: 'error',
    regex: /Module not found|Cannot find module ['"]([^'"]+)['"]|ERR_MODULE_NOT_FOUND/i,
    suggestion: 'Install the missing dependency or fix the import path; ensure it is not a local-only package.',
    steps: [
      'Confirm the package is listed in package.json dependencies (not only installed globally)',
      'Commit the lockfile and reinstall cleanly',
      'Check case-sensitive paths (Linux builds on Vercel)',
    ],
  },
  {
    kind: 'spa_404',
    title: 'SPA routing 404',
    severity: 'warn',
    regex: /404.*index\.html|THE_PAGE_COULD_NOT_BE_FOUND|No matching route|Rewrite.*not found/i,
    suggestion: 'Add SPA catch-all rewrites in vercel.json so client routes serve index.html.',
    steps: [
      'Add rewrites to vercel.json targeting /index.html',
      'Redeploy and test deep links',
    ],
  },
];

export function parseLogs(logs: string, deploymentId?: string): Finding[] {
  const redacted = redactSecrets(logs);
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(redacted);
    if (!match) continue;
    const key = pattern.kind;
    if (seen.has(key)) continue;
    seen.add(key);

    const captured =
      match.slice(1).find((g) => g && /^[A-Z_][A-Z0-9_]*$/.test(g)) ??
      match.slice(1).find(Boolean);

    findings.push({
      id: `analyze-${pattern.kind}`,
      ruleId: 'analyze',
      category: 'deployment',
      kind: pattern.kind,
      severity: pattern.severity,
      title: pattern.title,
      message: captured
        ? `${pattern.title}: ${captured}`
        : pattern.title,
      suggestion: pattern.suggestion,
      steps: pattern.steps,
      excerpt: excerptAround(redacted, match.index, 400),
      meta: { deploymentId, matched: match[0].slice(0, 200) },
    });
  }

  if (findings.length === 0 && redacted.trim()) {
    const errorLine =
      redacted
        .split(/\r?\n/)
        .find((l) => /error|failed|exception/i.test(l))
        ?.trim() ?? 'Unrecognized deployment failure';
    findings.push({
      id: 'analyze-unknown',
      ruleId: 'analyze',
      category: 'deployment',
      kind: 'unknown',
      severity: 'error',
      title: 'Unrecognized deployment error',
      message: errorLine.slice(0, 300),
      suggestion: 'Review the full log excerpt and share it with an AI assistant using `vercelguard fix`.',
      steps: [
        'Open the deployment in the Vercel dashboard for full logs',
        'Run `vercelguard fix` to generate a structured AI prompt',
      ],
      excerpt: redacted.slice(-1200),
      meta: { deploymentId },
    });
  }

  return findings;
}

function excerptAround(text: string, index: number, radius: number): string {
  const start = Math.max(0, index - radius / 2);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).trim();
}
