import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, '..', 'dist', 'index.js');
const shebang = '#!/usr/bin/env node\n';
const source = fs.readFileSync(target, 'utf8');
if (!source.startsWith('#!')) {
  fs.writeFileSync(target, shebang + source);
}
fs.chmodSync(target, 0o755);
