import fs from 'fs-extra';
import path from 'path';

export async function exists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

export async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return (await fs.readJson(filePath)) as T;
  } catch {
    return null;
  }
}

export async function findUp(
  startDir: string,
  names: string[],
): Promise<string | null> {
  let dir = path.resolve(startDir);
  while (true) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (await exists(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function listFiles(
  dir: string,
  filter?: (name: string) => boolean,
): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir);
  return filter ? entries.filter(filter) : entries;
}

export function joinRoot(root: string, ...parts: string[]): string {
  return path.join(root, ...parts);
}
