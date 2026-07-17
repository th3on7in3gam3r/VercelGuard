import type { Finding, ProjectContext, Rule, Severity } from '../types.js';

export function finding(
  rule: Rule,
  partial: Omit<Finding, 'id' | 'ruleId' | 'severity'> & {
    severity?: Severity;
    id?: string;
  },
): Finding {
  const severity = partial.severity ?? rule.severity;
  return {
    id: partial.id ?? `${rule.id}-${partial.file ?? 'general'}`,
    ruleId: rule.id,
    severity,
    category: partial.category,
    title: partial.title,
    message: partial.message,
    kind: partial.kind,
    file: partial.file,
    line: partial.line,
    suggestion: partial.suggestion,
    steps: partial.steps,
    excerpt: partial.excerpt,
    meta: partial.meta,
  };
}
