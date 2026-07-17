import chalk from 'chalk';
import type { AnalyzeReport, CheckReport, Finding, Severity } from '../types.js';

function colorSeverity(s: Severity): string {
  if (s === 'error') return chalk.red(s);
  if (s === 'warn') return chalk.yellow(s);
  return chalk.blue(s);
}

function printFinding(f: Finding): void {
  const loc = f.file ? chalk.dim(` (${f.file}${f.line ? `:${f.line}` : ''})`) : '';
  console.log(`  ${colorSeverity(f.severity)} ${chalk.bold(f.title)}${loc}`);
  console.log(`    ${f.message.split('\n')[0]}`);
  if (f.suggestion) console.log(chalk.dim(`    → ${f.suggestion}`));
}

export function printCheckReport(report: CheckReport, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(chalk.bold('\nVercelGuard check'));
  console.log(
    chalk.dim(
      `Framework: ${report.framework} · Package manager: ${report.packageManager}`,
    ),
  );
  console.log('');

  if (!report.findings.length) {
    console.log(chalk.green('No issues found.'));
  } else {
    for (const f of report.findings) printFinding(f);
  }

  console.log('');
  console.log(
    `Summary: ${chalk.red(`${report.counts.error} error(s)`)} · ${chalk.yellow(`${report.counts.warn} warning(s)`)} · ${chalk.blue(`${report.counts.info} info`)}`,
  );
  console.log(
    report.passed ? chalk.green('Result: PASSED') : chalk.red('Result: FAILED'),
  );
}

export function printAnalyzeReport(report: AnalyzeReport, asJson: boolean): void {
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          deploymentId: report.deploymentId,
          url: report.url,
          state: report.state,
          counts: report.counts,
          findings: report.findings,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(chalk.bold('\nVercelGuard analyze'));
  if (report.deploymentId) console.log(chalk.dim(`Deployment: ${report.deploymentId}`));
  if (report.url) console.log(chalk.dim(`URL: ${report.url}`));
  if (report.state) console.log(chalk.dim(`State: ${report.state}`));
  console.log('');

  if (!report.findings.length) {
    console.log(chalk.green('No parseable errors found in logs.'));
  } else {
    for (const f of report.findings) printFinding(f);
  }

  console.log('');
  console.log(
    `Summary: ${chalk.red(`${report.counts.error} error(s)`)} · ${chalk.yellow(`${report.counts.warn} warning(s)`)} · ${chalk.blue(`${report.counts.info} info`)}`,
  );
}

export function exitCodeForFindings(
  findings: Finding[],
  failOn: Severity = 'error',
): number {
  const rank = (s: Severity) => (s === 'error' ? 3 : s === 'warn' ? 2 : 1);
  const threshold = rank(failOn);
  return findings.some((f) => rank(f.severity) >= threshold) ? 1 : 0;
}
