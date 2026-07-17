import type { VercelLink } from '../types.js';

const API = 'https://api.vercel.com';

export interface ApiOptions {
  token: string;
  link: VercelLink;
}

async function apiFetch<T>(
  path: string,
  token: string,
  query?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(API + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function apiListEnvKeys(opts: ApiOptions): Promise<string[]> {
  const teamId = opts.link.orgId;
  const data = await apiFetch<{ envs?: Array<{ key: string }> }>(
    `/v9/projects/${opts.link.projectId}/env`,
    opts.token,
    { teamId },
  );
  return [...new Set((data.envs ?? []).map((e) => e.key))];
}

export async function apiListDeployments(
  opts: ApiOptions,
): Promise<Array<{ id: string; url?: string; state?: string }>> {
  const data = await apiFetch<{
    deployments?: Array<{
      uid: string;
      url?: string;
      state?: string;
      readyState?: string;
    }>;
  }>(`/v6/deployments`, opts.token, {
    projectId: opts.link.projectId,
    teamId: opts.link.orgId,
    limit: '20',
  });
  return (data.deployments ?? []).map((d) => ({
    id: d.uid,
    url: d.url ? `https://${d.url}` : undefined,
    state: d.readyState ?? d.state,
  }));
}

export async function apiGetDeploymentEvents(
  opts: ApiOptions,
  deploymentId: string,
): Promise<string> {
  const teamId = opts.link.orgId;
  try {
    const events = await apiFetch<Array<{ text?: string; payload?: { text?: string }; type?: string }>>(
      `/v2/deployments/${deploymentId}/events`,
      opts.token,
      { teamId, builds: '1', direction: 'forward', follow: '0' },
    );
    if (Array.isArray(events)) {
      return events
        .map((e) => e.text ?? e.payload?.text ?? JSON.stringify(e))
        .join('\n');
    }
  } catch {
    // fall through
  }

  // Fallback: deployment details
  const dep = await apiFetch<{
    readyState?: string;
    errorMessage?: string;
    errorCode?: string;
  }>(`/v13/deployments/${deploymentId}`, opts.token, { teamId });
  return [
    `readyState: ${dep.readyState ?? 'unknown'}`,
    dep.errorCode ? `errorCode: ${dep.errorCode}` : '',
    dep.errorMessage ? `errorMessage: ${dep.errorMessage}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
