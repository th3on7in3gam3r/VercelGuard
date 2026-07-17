import type { AnalyzeReport, Finding, ProjectContext, Severity } from '../types.js';
import { fetchDeploymentLogs } from './fetch-logs.js';
import { parseLogs } from './parsers.js';

export async function analyzeDeployment(
  ctx: ProjectContext,
  deploymentId?: string,
  logsOverride?: string,
): Promise<AnalyzeReport> {
  let logs: string;
  let meta: { deploymentId?: string; url?: string; state?: string } = {};

  if (logsOverride) {
    logs = logsOverride;
    meta = { deploymentId };
  } else {
    const fetched = await fetchDeploymentLogs(ctx, deploymentId);
    logs = fetched.logs;
    meta = {
      deploymentId: fetched.deploymentId,
      url: fetched.url,
      state: fetched.state,
    };
  }

  const findings = parseLogs(logs, meta.deploymentId);
  const enriched = findings.map((f) => enrichWithProject(f, ctx));

  const counts: Record<Severity, number> = { error: 0, warn: 0, info: 0 };
  for (const f of enriched) counts[f.severity]++;

  return {
    ...meta,
    logs,
    findings: enriched,
    counts,
  };
}

function enrichWithProject(finding: Finding, ctx: ProjectContext): Finding {
  const extra: string[] = [];
  if (ctx.framework !== 'unknown') {
    extra.push(`Detected framework: ${ctx.framework}`);
  }
  if (finding.kind === 'spa_404' && ctx.framework === 'vite') {
    extra.push('Vite SPA: ensure vercel.json catch-all rewrite exists.');
  }
  if (finding.kind === 'missing_env' && !ctx.vercelLink) {
    extra.push('Project is not linked; run `vercel link` to manage env from CLI.');
  }
  if (!extra.length) return finding;
  return {
    ...finding,
    message: `${finding.message}\n${extra.join(' ')}`,
  };
}
