#!/usr/bin/env node
import { createProgram } from './cli.js';

const program = createProgram();
program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
