import { execa } from 'execa';

export async function isVercelCliAvailable(): Promise<boolean> {
  try {
    await execa('vercel', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    try {
      await execa('npx', ['vercel', '--version'], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

async function runVercel(
  args: string[],
  cwd: string,
  token?: string,
): Promise<{ stdout: string; stderr: string }> {
  const env = {
    ...process.env,
    ...(token ? { VERCEL_TOKEN: token } : {}),
  };
  try {
    const result = await execa('vercel', args, { cwd, env, stdio: 'pipe' });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (primary) {
    try {
      const result = await execa('npx', ['vercel', ...args], { cwd, env, stdio: 'pipe' });
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (secondary) {
      const err = secondary as { stderr?: string; stdout?: string; message?: string };
      throw new Error(err.stderr || err.stdout || err.message || String(primary));
    }
  }
}

export async function vercelWhoami(cwd: string, token?: string): Promise<string | null> {
  try {
    const { stdout } = await runVercel(['whoami'], cwd, token);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function vercelEnvLs(cwd: string, token?: string): Promise<string[]> {
  const { stdout } = await runVercel(['env', 'ls'], cwd, token);
  const keys: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    // Typical: NAME    Production     Encrypted    age
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+/);
    if (m && m[1] !== 'name' && m[1] !== 'Name') keys.push(m[1]);
  }
  return [...new Set(keys)];
}

export async function vercelLs(
  cwd: string,
  token?: string,
): Promise<Array<{ id: string; url?: string; state?: string }>> {
  // Prefer plain `ls` — `--json` is flaky / unsupported on some CLI versions
  let stdout = '';
  try {
    ({ stdout } = await runVercel(['ls'], cwd, token));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Brand-new linked projects often have zero deployments
    if (/no deployments|not found|Response Error/i.test(message)) {
      return [];
    }
    throw err;
  }

  try {
    const data = JSON.parse(stdout) as unknown;
    const list = Array.isArray(data)
      ? data
      : (data as { deployments?: unknown[] }).deployments ?? [];
    return (list as Array<Record<string, unknown>>)
      .map((d) => ({
        id: String(d.uid ?? d.id ?? ''),
        url: d.url ? String(d.url) : undefined,
        state: d.state
          ? String(d.state)
          : d.readyState
            ? String(d.readyState)
            : undefined,
      }))
      .filter((d) => d.id);
  } catch {
    const deployments: Array<{ id: string; url?: string; state?: string }> = [];
    for (const line of stdout.split(/\r?\n/)) {
      const m = line.match(/(dpl_[A-Za-z0-9]+|https:\/\/\S+)/);
      if (m) {
        deployments.push({
          id: m[1].startsWith('dpl_') ? m[1] : m[1],
          url: m[1].startsWith('http') ? m[1] : undefined,
          state: /Error|FAILED|failed/i.test(line)
            ? 'ERROR'
            : /Ready|READY/i.test(line)
              ? 'READY'
              : undefined,
        });
      }
    }
    return deployments;
  }
}

export async function vercelLogs(
  cwd: string,
  deploymentIdOrUrl: string,
  token?: string,
): Promise<string> {
  try {
    const { stdout, stderr } = await runVercel(
      ['logs', deploymentIdOrUrl, '--output', 'raw'],
      cwd,
      token,
    );
    return [stdout, stderr].filter(Boolean).join('\n');
  } catch {
    const { stdout, stderr } = await runVercel(['logs', deploymentIdOrUrl], cwd, token);
    return [stdout, stderr].filter(Boolean).join('\n');
  }
}
