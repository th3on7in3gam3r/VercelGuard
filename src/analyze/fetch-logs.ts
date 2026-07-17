import type { ProjectContext } from '../types.js';
import { createVercelClient } from '../vercel/client.js';

export async function fetchDeploymentLogs(
  ctx: ProjectContext,
  deploymentId?: string,
): Promise<{ deploymentId?: string; url?: string; state?: string; logs: string }> {
  const client = createVercelClient({
    root: ctx.root,
    token: ctx.options.token ?? process.env.VERCEL_TOKEN,
    link: ctx.vercelLink,
  });

  const deployment = await client.resolveFailedDeployment(deploymentId);
  if (!deployment) {
    throw new Error(
      'No deployments found for this project yet. Deploy once, or analyze a local log with: vercelguard analyze --logs <file>',
    );
  }

  const target = deployment.url ?? deployment.id;
  const logs = await client.getLogs(target);
  return {
    deploymentId: deployment.id,
    url: deployment.url,
    state: deployment.state,
    logs,
  };
}
