import type { CheckReport, Finding, ProjectContext, Rule, Severity } from '../types.js';
import { buildRule } from './build.js';
import { envVarsRule } from './env-vars.js';
import { gitHygieneRule } from './git-hygiene.js';
import { imageDomainsRule } from './image-domains.js';
import { largeDepsRule } from './large-deps.js';
import { lockfileRule } from './lockfile.js';
import { nextConfigRule } from './next-config.js';
import { nodeVersionRule } from './node-version.js';
import { spaRewritesRule } from './spa-rewrites.js';
import { vercelJsonRule } from './vercel-json.js';

export const builtinRules: Rule[] = [
  gitHygieneRule,
  lockfileRule,
  nodeVersionRule,
  envVarsRule,
  vercelJsonRule,
  nextConfigRule,
  imageDomainsRule,
  spaRewritesRule,
  largeDepsRule,
  buildRule,
];

function severityRank(s: Severity): number {
  return s === 'error' ? 3 : s === 'warn' ? 2 : 1;
}

function applyConfig(rule: Rule, ctx: ProjectContext): Rule | null {
  if (ctx.config.disabledRules?.includes(rule.id)) return null;
  const override = ctx.config.severityOverrides?.[rule.id];
  if (override) return { ...rule, severity: override };
  return rule;
}

export async function runRules(ctx: ProjectContext): Promise<CheckReport> {
  const findings: Finding[] = [];

  for (const raw of builtinRules) {
    const rule = applyConfig(raw, ctx);
    if (!rule) continue;
    if (rule.frameworks && !rule.frameworks.includes(ctx.framework)) continue;

    try {
      const result = await rule.run(ctx);
      findings.push(...result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      findings.push({
        id: `${rule.id}-exception`,
        ruleId: rule.id,
        title: `Rule ${rule.id} crashed`,
        message,
        severity: 'warn',
        category: 'unknown',
      });
    }
  }

  const counts: Record<Severity, number> = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;

  const failOn = ctx.options.failOn ?? 'error';
  const threshold = severityRank(failOn);
  const passed = !findings.some((f) => severityRank(f.severity) >= threshold);

  return {
    framework: ctx.framework,
    packageManager: ctx.packageManager,
    findings,
    counts,
    passed,
  };
}
