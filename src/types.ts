export type Severity = 'error' | 'warn' | 'info';

export type Framework =
  | 'next'
  | 'vite'
  | 'remix'
  | 'astro'
  | 'nuxt'
  | 'static'
  | 'unknown';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';

export type FindingCategory =
  | 'git'
  | 'lockfile'
  | 'node'
  | 'env'
  | 'vercel-json'
  | 'next-config'
  | 'spa'
  | 'build'
  | 'deps'
  | 'images'
  | 'deployment'
  | 'unknown';

export type ErrorKind =
  | 'missing_env'
  | 'oom'
  | 'build_timeout'
  | 'type_error'
  | 'module_not_found'
  | 'spa_404'
  | 'git_hygiene'
  | 'config'
  | 'unknown';

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  message: string;
  severity: Severity;
  category: FindingCategory;
  kind?: ErrorKind;
  file?: string;
  line?: number;
  suggestion?: string;
  steps?: string[];
  excerpt?: string;
  meta?: Record<string, unknown>;
}

export interface VercelLink {
  projectId: string;
  orgId?: string;
  projectName?: string;
}

export interface PackageJson {
  name?: string;
  version?: string;
  engines?: { node?: string };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface ProjectContext {
  root: string;
  packageJson: PackageJson | null;
  framework: Framework;
  packageManager: PackageManager;
  vercelLink: VercelLink | null;
  hasVercelJson: boolean;
  config: GuardConfig;
  options: CheckOptions;
}

export interface GuardConfig {
  disabledRules?: string[];
  severityOverrides?: Record<string, Severity>;
  failOn?: Severity;
}

export interface CheckOptions {
  skipBuild?: boolean;
  json?: boolean;
  failOn?: Severity;
  token?: string;
  cwd?: string;
}

export interface CheckReport {
  framework: Framework;
  packageManager: PackageManager;
  findings: Finding[];
  counts: Record<Severity, number>;
  passed: boolean;
}

export interface AnalyzeReport {
  deploymentId?: string;
  url?: string;
  state?: string;
  logs: string;
  findings: Finding[];
  counts: Record<Severity, number>;
}

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  frameworks?: Framework[];
  run: (ctx: ProjectContext) => Promise<Finding[]> | Finding[];
}
