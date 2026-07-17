import { execa } from 'execa';
import type { Rule } from '../types.js';
import { runScriptCommand } from '../detect/package-manager.js';
import { detectBuildScript } from '../utils/package.js';
import { finding } from './types.js';

export const buildRule: Rule = {
  id: 'build',
  title: 'Local production build',
  severity: 'error',
  async run(ctx) {
    if (ctx.options.skipBuild) {
      return [
        finding(this, {
          category: 'build',
          kind: 'config',
          severity: 'info',
          title: 'Build skipped',
          message: 'Skipped local build because --skip-build was set.',
        }),
      ];
    }

    if (!ctx.packageJson) {
      return [
        finding(this, {
          category: 'build',
          kind: 'config',
          severity: 'warn',
          title: 'No package.json',
          message: 'Cannot run a Node build without package.json.',
        }),
      ];
    }

    const script = detectBuildScript(ctx.packageJson);
    if (!script) {
      return [
        finding(this, {
          category: 'build',
          kind: 'config',
          severity: 'warn',
          title: 'No build script',
          message: 'package.json has no "build" or "vercel-build" script.',
          file: 'package.json',
          suggestion: 'Add a build script that matches what Vercel will run.',
        }),
      ];
    }

    const cmd = runScriptCommand(ctx.packageManager === 'unknown' ? 'npm' : ctx.packageManager, script);
    const [bin, ...args] = cmd.split(' ');

    try {
      await execa(bin, args, {
        cwd: ctx.root,
        stdio: 'pipe',
        env: { ...process.env, CI: '1', NODE_ENV: 'production' },
        timeout: 10 * 60 * 1000,
      });
      return [];
    } catch (err: unknown) {
      const e = err as {
        stdout?: string;
        stderr?: string;
        shortMessage?: string;
        message?: string;
      };
      const output = [e.stderr, e.stdout].filter(Boolean).join('\n').slice(-4000);
      const message = e.shortMessage ?? e.message ?? 'Build failed';

      let kind: 'type_error' | 'module_not_found' | 'oom' | 'build_timeout' | 'unknown' = 'unknown';
      if (/Type error|TS\d{4}/i.test(output)) kind = 'type_error';
      else if (/Cannot find module|Module not found/i.test(output)) kind = 'module_not_found';
      else if (/JavaScript heap out of memory|ENOMEM|SIGKILL/i.test(output)) kind = 'oom';
      else if (/timed out|ETIMEDOUT/i.test(output) || /timeout/i.test(message)) kind = 'build_timeout';

      return [
        finding(this, {
          category: 'build',
          kind,
          title: 'Local build failed',
          message: `Command failed: ${cmd}`,
          excerpt: output.slice(-1500),
          suggestion: 'Fix the build error locally before pushing to Vercel.',
          steps: [
            `Run locally: ${cmd}`,
            'Address the first error in the build output',
            'Re-run vercelguard check after fixes',
          ],
        }),
      ];
    }
  },
};
