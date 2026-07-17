import simpleGit from 'simple-git';
import type { Rule } from '../types.js';
import { exists, joinRoot, readText } from '../utils/fs.js';
import { finding } from './types.js';

const REQUIRED_IGNORE = ['.env', '.next', 'dist', '.vercel', 'node_modules'];

export const gitHygieneRule: Rule = {
  id: 'git-hygiene',
  title: 'Git hygiene for secrets and build artifacts',
  severity: 'warn',
  async run(ctx) {
    const findings = [];
    const gitignorePath = joinRoot(ctx.root, '.gitignore');
    const gitignore = (await readText(gitignorePath)) ?? '';

    if (!(await exists(gitignorePath))) {
      findings.push(
        finding(this, {
          category: 'git',
          kind: 'git_hygiene',
          title: 'Missing .gitignore',
          message: 'No .gitignore found. Secrets and build output may be committed.',
          suggestion: 'Add a .gitignore covering .env*, node_modules, .next, dist, .vercel.',
          steps: [
            'Create a .gitignore at the repo root',
            'Include: .env*.local, .env, node_modules, .next, dist, .vercel, out',
          ],
        }),
      );
      return findings;
    }

    for (const pattern of REQUIRED_IGNORE) {
      if (!gitignore.includes(pattern)) {
        findings.push(
          finding(this, {
            id: `git-hygiene-missing-${pattern}`,
            category: 'git',
            kind: 'git_hygiene',
            title: `gitignore missing ${pattern}`,
            message: `.gitignore does not mention "${pattern}".`,
            file: '.gitignore',
            suggestion: `Add "${pattern}" (or a broader pattern) to .gitignore.`,
            steps: [`Add "${pattern}" to .gitignore`, 'Verify with: git check-ignore -v <path>'],
          }),
        );
      }
    }

    try {
      const git = simpleGit(ctx.root);
      if (await git.checkIsRepo()) {
        const status = await git.status();
        const trackedSecrets = [
          ...status.staged,
          ...status.created,
          ...status.modified,
          ...status.not_added,
        ].filter(
          (f) =>
            /(^|\/)\.env($|\.|\/)/.test(f) ||
            /\.(pem|key)$/.test(f) ||
            /(credentials|secrets)\.json$/i.test(f),
        );
        for (const file of [...new Set(trackedSecrets)]) {
          findings.push(
            finding(this, {
              id: `git-hygiene-secret-${file}`,
              category: 'git',
              kind: 'git_hygiene',
              severity: 'error',
              title: 'Sensitive file in working tree',
              message: `"${file}" looks like a secret or credential file.`,
              file,
              suggestion: 'Remove from staging and ensure it is gitignored.',
              steps: [
                `git rm --cached "${file}" (if tracked)`,
                'Add the path to .gitignore',
                'Rotate any credentials that may have been exposed',
              ],
            }),
          );
        }
      }
    } catch {
      // not a git repo or git unavailable — skip tracked-file checks
    }

    return findings;
  },
};
