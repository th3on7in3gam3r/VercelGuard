import type { Finding } from '../types.js';
import chalk from 'chalk';

export function formatManualFixes(findings: Finding[]): string {
  const lines: string[] = [];
  lines.push(chalk.bold('\nManual fix instructions\n'));

  if (!findings.length) {
    lines.push(chalk.green('No findings to fix.'));
    return lines.join('\n');
  }

  findings.forEach((f, i) => {
    lines.push(chalk.cyan(`${i + 1}. [${f.severity}] ${f.title}`));
    lines.push(`   ${f.message}`);
    if (f.file) lines.push(`   File: ${f.file}${f.line ? `:${f.line}` : ''}`);
    if (f.suggestion) lines.push(`   Suggestion: ${f.suggestion}`);
    if (f.steps?.length) {
      lines.push('   Steps:');
      for (const step of f.steps) lines.push(`   - ${step}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
