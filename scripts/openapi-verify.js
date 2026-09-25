#!/usr/bin/env node

/**
 * Regenerates OpenAPI types from openapi/schema.yaml and fails if the git
 * working tree differs. Not yet wired into CI (see AGENTS/README) — this
 * repo has no consumers of the generated types yet, so it's available for
 * whoever starts migrating a page to run manually first.
 */

import { execSync } from 'child_process';

const rootDir = process.cwd();

const TRACKED_PATHS = ['openapi/schema.yaml', 'src/types/api.generated.ts'];

function run(command) {
  execSync(command, { cwd: rootDir, stdio: 'inherit' });
}

function main() {
  console.log('[openapi:verify] Regenerating types from openapi/schema.yaml...');
  run('npm run codegen');

  console.log('[openapi:verify] Checking for uncommitted drift...');
  const diff = execSync(`git diff -- ${TRACKED_PATHS.map(p => `"${p}"`).join(' ')}`, {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (diff.trim()) {
    console.error('\n[openapi:verify] Generated OpenAPI files are out of date.');
    console.error('Run: npm run codegen:sync');
    console.error('Then commit: openapi/schema.yaml, src/types/api.generated.ts\n');
    console.error(diff.slice(0, 4000));
    process.exit(1);
  }

  console.log('[openapi:verify] OK — schema and generated types match repo.');
}

main();
