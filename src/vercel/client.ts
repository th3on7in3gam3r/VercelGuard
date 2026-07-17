import type { VercelLink } from '../types.js';
import * as api from './api.js';
import * as cli from './cli.js';

export interface VercelClientOptions {
  root: string;
  token?: string;
  link?: VercelLink | null;
}

export interface VercelClient {
  listEnvKeys: () => Promise<string[] | null>;
  listDeployments: () => Promise<Array<{ id: string; url?: string; state?: string }>>;
  getLogs: (deploymentIdOrUrl: string) => Promise<string>;
  resolveFailedDeployment: (
    preferredId?: string,
  ) => Promise<{ id: string; url?: string; state?: string } | null>;
}

export function createVercelClient(opts: VercelClientOptions): VercelClient {
  const token = opts.token;
  const link = opts.link ?? null;

  async function useCli(): Promise<boolean> {
    if (!(await cli.isVercelCliAvailable())) return false;
    const who = await cli.vercelWhoami(opts.root, token);
    return Boolean(who || token);
  }

  return {
    async listEnvKeys() {
      if (await useCli()) {
        try {
          return await cli.vercelEnvLs(opts.root, token);
        } catch {
          // fall through to API
        }
      }
      if (token && link) {
        return api.apiListEnvKeys({ token, link });
      }
      if (!token && !link) {
        throw new Error(
          'Cannot list Vercel env: run `vercel link` / `vercel login`, or set VERCEL_TOKEN with a linked project.',
        );
      }
      if (!token) {
        throw new Error('Vercel CLI unavailable/unauthenticated. Set VERCEL_TOKEN or run `vercel login`.');
      }
      throw new Error('Project not linked (.vercel/project.json missing). Run `vercel link`.');
    },

    async listDeployments() {
      let cliError: string | null = null;
      if (await useCli()) {
        try {
          return await cli.vercelLs(opts.root, token);
        } catch (err: unknown) {
          cliError = err instanceof Error ? err.message : String(err);
        }
      }
      if (token && link) {
        return api.apiListDeployments({ token, link });
      }
      if (cliError && /no deployments|Response Error|not found/i.test(cliError)) {
        return [];
      }
      throw new Error(
        cliError
          ? `Cannot list deployments (${cliError}). If this project has never been deployed, use --logs <file> or deploy once first.`
          : 'Cannot list deployments. Authenticate with Vercel CLI or provide VERCEL_TOKEN and link the project.',
      );
    },

    async getLogs(deploymentIdOrUrl: string) {
      if (await useCli()) {
        try {
          return await cli.vercelLogs(opts.root, deploymentIdOrUrl, token);
        } catch {
          // fall through
        }
      }
      if (token && link) {
        const id = deploymentIdOrUrl.replace(/^https?:\/\//, '').split('/')[0];
        // If it's a URL host, try to find deployment id from list
        let deploymentId = deploymentIdOrUrl;
        if (!deploymentIdOrUrl.startsWith('dpl_')) {
          const deps = await api.apiListDeployments({ token, link });
          const match = deps.find(
            (d) =>
              d.id === deploymentIdOrUrl ||
              d.url?.includes(id) ||
              d.url === deploymentIdOrUrl,
          );
          deploymentId = match?.id ?? deploymentIdOrUrl;
        }
        return api.apiGetDeploymentEvents({ token, link }, deploymentId);
      }
      throw new Error(
        'Cannot fetch logs. Authenticate with Vercel CLI or provide VERCEL_TOKEN.',
      );
    },

    async resolveFailedDeployment(preferredId?: string) {
      const deployments = await this.listDeployments();
      if (preferredId) {
        const found = deployments.find(
          (d) =>
            d.id === preferredId ||
            d.url === preferredId ||
            d.url?.includes(preferredId),
        );
        return found ?? { id: preferredId };
      }
      const failed = deployments.find((d) =>
        /error|failed|canceled|cancelled/i.test(d.state ?? ''),
      );
      return failed ?? deployments[0] ?? null;
    },
  };
}
