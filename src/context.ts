import path from 'path';
import type {
  CheckOptions,
  GuardConfig,
  ProjectContext,
  VercelLink,
} from './types.js';
import { detectFramework } from './detect/framework.js';
import { detectPackageManager } from './detect/package-manager.js';
import { exists, joinRoot, readJson } from './utils/fs.js';
import { loadPackageJson } from './utils/package.js';

const DEFAULT_CONFIG: GuardConfig = {
  disabledRules: [],
  severityOverrides: {},
  failOn: 'error',
};

export async function loadConfig(root: string): Promise<GuardConfig> {
  const candidates = [
    'vercelguard.config.json',
    '.vercelguard.json',
  ];
  for (const name of candidates) {
    const data = await readJson<Partial<GuardConfig>>(joinRoot(root, name));
    if (data) {
      return {
        ...DEFAULT_CONFIG,
        ...data,
        disabledRules: data.disabledRules ?? [],
        severityOverrides: data.severityOverrides ?? {},
      };
    }
  }
  return { ...DEFAULT_CONFIG };
}

async function loadVercelLink(root: string): Promise<VercelLink | null> {
  const project = await readJson<{
    projectId?: string;
    orgId?: string;
    projectName?: string;
  }>(joinRoot(root, '.vercel', 'project.json'));
  if (!project?.projectId) return null;
  return {
    projectId: project.projectId,
    orgId: project.orgId,
    projectName: project.projectName,
  };
}

export async function loadProjectContext(
  cwd: string,
  options: CheckOptions = {},
): Promise<ProjectContext> {
  const root = path.resolve(options.cwd ?? cwd);
  const packageJson = await loadPackageJson(root);
  const [framework, packageManager, vercelLink, hasVercelJson, config] =
    await Promise.all([
      detectFramework(root, packageJson),
      detectPackageManager(root),
      loadVercelLink(root),
      exists(joinRoot(root, 'vercel.json')),
      loadConfig(root),
    ]);

  return {
    root,
    packageJson,
    framework,
    packageManager,
    vercelLink,
    hasVercelJson,
    config,
    options: {
      ...options,
      failOn: options.failOn ?? config.failOn ?? 'error',
    },
  };
}
