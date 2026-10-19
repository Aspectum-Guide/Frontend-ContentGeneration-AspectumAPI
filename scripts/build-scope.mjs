/* eslint-env node */
// Production build of one deployment out of this codebase.
//   node scripts/build-scope.mjs studio|catalog|all
// VITE_NAV_SCOPE is read at build time (src/config/nav.js, src/config/scope.js): a scoped
// build only registers and shows its own area. Output goes to dist/ like a normal build.
import { build } from 'vite'

const scope = process.argv[2]
if (!['all', 'studio', 'catalog'].includes(scope)) {
  console.error('usage: node scripts/build-scope.mjs <studio|catalog|all>')
  process.exit(2)
}

process.env.VITE_NAV_SCOPE = scope === 'all' ? '' : scope
console.log(`Building scope: ${scope}`)
await build()
