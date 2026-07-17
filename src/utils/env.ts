import { readText } from './fs.js';

/** Parse KEY=VALUE lines; ignore comments and empty lines. Never returns values for secrets display. */
export async function parseEnvKeys(filePath: string): Promise<string[]> {
  const content = await readText(filePath);
  if (!content) return [];
  const keys: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

/** Keys that are runtime/platform meta, not app secrets to sync to Vercel. */
const IGNORED_ENV_KEYS = new Set([
  'NODE_ENV',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_REGION',
  'VERCEL_TOKEN', // CLI auth for this tool — not a project env var
  'CI',
  'PATH',
  'HOME',
  'PWD',
  'TMPDIR',
]);

/** Strip line and block comments so doc examples like process.env.NAME are ignored. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Scan for process.env.NAME / process.env['NAME'] / process.env["NAME"] */
export function extractProcessEnvKeys(source: string): string[] {
  const keys = new Set<string>();
  const cleaned = stripComments(source);
  const dot = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
  const bracket = /process\.env\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g;
  let m: RegExpExecArray | null;
  while ((m = dot.exec(cleaned))) {
    if (!IGNORED_ENV_KEYS.has(m[1])) keys.add(m[1]);
  }
  while ((m = bracket.exec(cleaned))) {
    if (!IGNORED_ENV_KEYS.has(m[1])) keys.add(m[1]);
  }
  return [...keys];
}

export function redactSecrets(text: string): string {
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1[REDACTED]')
    .replace(/(VERCEL_TOKEN\s*[=:]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE)[A-Z0-9_]*\s*[=:]\s*)\S+/gi, '$1[REDACTED]');
}
