#!/usr/bin/env node

/**
 * Downloads the OpenAPI schema from AspectumAPI into openapi/schema.yaml.
 *
 * Env:
 *   OPENAPI_SCHEMA_URL — override URL (default: dev /api/v1/schema/)
 */

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const schemaPath = path.join(rootDir, 'openapi', 'schema.yaml');

const DEFAULT_SCHEMA_URL = 'https://dev.aspectum-guide.com/api/v1/schema/';

async function main() {
  const url = (process.env.OPENAPI_SCHEMA_URL || DEFAULT_SCHEMA_URL).trim();
  if (!url) {
    console.error('[openapi:fetch] OPENAPI_SCHEMA_URL is empty');
    process.exit(1);
  }

  console.log(`[openapi:fetch] GET ${url}`);

  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.oai.openapi, application/yaml, text/yaml, */*' },
  });

  if (!response.ok) {
    console.error(`[openapi:fetch] HTTP ${response.status} ${response.statusText} for ${url}`);
    process.exit(1);
  }

  const body = await response.text();
  const trimmed = body.trim();

  if (!trimmed.startsWith('openapi:') && !trimmed.startsWith('{')) {
    console.error('[openapi:fetch] Response does not look like OpenAPI (yaml/json)');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
  fs.writeFileSync(schemaPath, body.endsWith('\n') ? body : `${body}\n`, 'utf8');

  console.log(`[openapi:fetch] Saved ${schemaPath} (${body.length} bytes)`);
}

main().catch(error => {
  console.error('[openapi:fetch] Failed:', error);
  process.exit(1);
});
