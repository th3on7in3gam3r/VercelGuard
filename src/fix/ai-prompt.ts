import path from 'path';
import type { Finding, ProjectContext } from '../types.js';
import { redactSecrets } from '../utils/env.js';
import { exists, joinRoot, readText } from '../utils/fs.js';

const MAX_FILE_CHARS = 2500;
const MAX_EXCERPT = 2000;

export async function generateAiPrompt(
  ctx: ProjectContext,
  findings: Finding[],
  logsExcerpt?: string,
): Promise<string> {
  const relevantFiles = await collectRelevantFiles(ctx, findings);
  const parts: string[] = [];

  parts.push('# VercelGuard fix request');
  parts.push('');
  parts.push('You are helping fix a Vercel deployment / pre-deploy issue.');
  parts.push('Propose a **minimal** patch: only change what is required.');
  parts.push('Do not invent secrets; use placeholders for env values.');
  parts.push('');
  parts.push('## Project context');
  parts.push(`- Root: ${ctx.root}`);
  parts.push(`- Framework: ${ctx.framework}`);
  parts.push(`- Package manager: ${ctx.packageManager}`);
  parts.push(`- Linked to Vercel: ${ctx.vercelLink ? 'yes' : 'no'}`);
  parts.push('');

  parts.push('## Findings');
  for (const f of findings) {
    parts.push(`### ${f.title} (${f.severity}, ${f.kind ?? f.category})`);
    parts.push(f.message);
    if (f.file) parts.push(`File: ${f.file}`);
    if (f.suggestion) parts.push(`Suggestion: ${f.suggestion}`);
    if (f.excerpt) {
      parts.push('Excerpt:');
      parts.push('```');
      parts.push(redactSecrets(f.excerpt).slice(0, MAX_EXCERPT));
      parts.push('```');
    }
    parts.push('');
  }

  if (logsExcerpt?.trim()) {
    parts.push('## Deployment log excerpt');
    parts.push('```');
    parts.push(redactSecrets(logsExcerpt).slice(-MAX_EXCERPT));
    parts.push('```');
    parts.push('');
  }

  if (relevantFiles.length) {
    parts.push('## Relevant files');
    for (const file of relevantFiles) {
      parts.push(`### ${file.path}`);
      parts.push('```');
      parts.push(redactSecrets(file.content).slice(0, MAX_FILE_CHARS));
      parts.push('```');
      parts.push('');
    }
  }

  parts.push('## Your task');
  parts.push('1. Explain the root cause briefly.');
  parts.push('2. List concrete file edits (unified diff or clear before/after).');
  parts.push('3. List any Vercel dashboard / CLI steps (env vars, settings).');
  parts.push('4. Give a short verification checklist.');

  return parts.join('\n');
}

async function collectRelevantFiles(
  ctx: ProjectContext,
  findings: Finding[],
): Promise<Array<{ path: string; content: string }>> {
  const candidates = new Set<string>();

  for (const f of findings) {
    if (f.file) candidates.add(f.file);
  }

  const defaults = [
    'vercel.json',
    'package.json',
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'vite.config.ts',
    'vite.config.js',
    '.env.example',
  ];
  for (const d of defaults) candidates.add(d);

  const result: Array<{ path: string; content: string }> = [];
  for (const rel of candidates) {
    const abs = path.isAbsolute(rel) ? rel : joinRoot(ctx.root, rel);
    if (!(await exists(abs))) continue;
    const content = await readText(abs);
    if (!content) continue;
    // Never include .env with values
    if (/(^|\/)\.env($|\.(?!example|sample|template))/.test(rel)) continue;
    result.push({
      path: path.relative(ctx.root, abs) || rel,
      content,
    });
  }
  return result.slice(0, 8);
}
