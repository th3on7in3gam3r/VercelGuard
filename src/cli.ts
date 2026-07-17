import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { analyzeDeployment } from './analyze/suggest.js';
import { loadProjectContext } from './context.js';
import { generateAiPrompt } from './fix/ai-prompt.js';
import { formatManualFixes } from './fix/manual.js';
import { exitCodeForFindings, printAnalyzeReport, printCheckReport } from './report/cli.js';
import { runRules } from './rules/index.js';
import type { Severity } from './types.js';

function parseFailOn(value: string): Severity {
  if (value === 'error' || value === 'warn' || value === 'info') return value;
  throw new Error(`Invalid --fail-on value: ${value}`);
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('vercelguard')
    .description('Smart pre-deployment checker and error fixer for Vercel')
    .version('0.1.0');

  program
    .command('check')
    .description('Run pre-deployment checks')
    .argument('[dir]', 'project directory', '.')
    .option('--json', 'output JSON report', false)
    .option('--skip-build', 'skip running the production build', false)
    .option('--fail-on <level>', 'fail on error|warn|info', 'error')
    .option('--token <token>', 'Vercel API token (or set VERCEL_TOKEN)')
    .option('--cwd <path>', 'working directory override')
    .action(async (dir: string, opts) => {
      try {
        const cwd = path.resolve(opts.cwd ?? dir);
        const ctx = await loadProjectContext(cwd, {
          skipBuild: opts.skipBuild,
          json: opts.json,
          failOn: parseFailOn(opts.failOn),
          token: opts.token,
          cwd,
        });

        if (!opts.json) {
          console.log(chalk.blue('Running VercelGuard checks...'));
        }

        const report = await runRules(ctx);
        printCheckReport(report, Boolean(opts.json));
        process.exitCode = report.passed ? 0 : 1;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(message));
        process.exitCode = 1;
      }
    });

  program
    .command('analyze')
    .description('Analyze Vercel deployment logs for common failures')
    .argument('[deploymentId]', 'deployment id or URL (defaults to latest failed)')
    .option('--json', 'output JSON report', false)
    .option('--logs <file>', 'analyze a local log file instead of fetching')
    .option('--token <token>', 'Vercel API token (or set VERCEL_TOKEN)')
    .option('--cwd <path>', 'project directory', '.')
    .action(async (deploymentId: string | undefined, opts) => {
      try {
        const cwd = path.resolve(opts.cwd);
        const ctx = await loadProjectContext(cwd, {
          json: opts.json,
          token: opts.token,
          cwd,
        });

        let logsOverride: string | undefined;
        if (opts.logs) {
          logsOverride = await fs.readFile(path.resolve(opts.logs), 'utf8');
        }

        if (!opts.json) {
          console.log(chalk.blue('Analyzing deployment logs...'));
        }

        const report = await analyzeDeployment(ctx, deploymentId, logsOverride);
        printAnalyzeReport(report, Boolean(opts.json));
        process.exitCode = exitCodeForFindings(report.findings, 'error');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(message));
        process.exitCode = 1;
      }
    });

  program
    .command('fix')
    .description('Print manual fix steps and an AI prompt for findings')
    .argument('[deploymentId]', 'deployment id or URL (defaults to latest failed)')
    .option('--logs <file>', 'use a local log file instead of fetching')
    .option('--out <file>', 'write AI prompt to a file')
    .option('--check', 'also run local checks and include those findings', false)
    .option('--skip-build', 'when used with --check, skip build', false)
    .option('--token <token>', 'Vercel API token (or set VERCEL_TOKEN)')
    .option('--cwd <path>', 'project directory', '.')
    .action(async (deploymentId: string | undefined, opts) => {
      try {
        const cwd = path.resolve(opts.cwd);
        const ctx = await loadProjectContext(cwd, {
          skipBuild: opts.skipBuild,
          token: opts.token,
          cwd,
        });

        const findings = [];
        let logsExcerpt: string | undefined;

        if (opts.check) {
          const checkReport = await runRules(ctx);
          findings.push(...checkReport.findings);
        }

        let logsOverride: string | undefined;
        if (opts.logs) {
          logsOverride = await fs.readFile(path.resolve(opts.logs), 'utf8');
        }

        try {
          const analyzeReport = await analyzeDeployment(ctx, deploymentId, logsOverride);
          findings.push(...analyzeReport.findings);
          logsExcerpt = analyzeReport.logs;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (opts.logs) throw err;
          console.log(chalk.yellow(`Analyze skipped: ${message}`));
          if (!opts.check && findings.length === 0) {
            console.log(
              chalk.dim(
                'Tip: run with --logs <file> to analyze a saved build log, or --check for local findings.',
              ),
            );
          }
        }

        console.log(formatManualFixes(findings));

        const prompt = await generateAiPrompt(ctx, findings, logsExcerpt);
        console.log(chalk.bold('\nAI prompt\n'));
        console.log(prompt);

        if (opts.out) {
          const outPath = path.resolve(opts.out);
          await fs.writeFile(outPath, prompt, 'utf8');
          console.log(chalk.green(`\nWrote AI prompt to ${outPath}`));
        }

        process.exitCode = exitCodeForFindings(findings, 'error');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(message));
        process.exitCode = 1;
      }
    });

  return program;
}
