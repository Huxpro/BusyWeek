// Assemble a static, self-contained site for the Vue Lynx *web* build, ready
// to deploy to GitHub Pages (or any static host).
//
// Run *after* `rspeedy build`, which produces `dist/main.web.bundle`. This:
//   1. copies the @lynx-js/web-core prod runtime into `dist/static/`
//   2. copies the host page (`web/index.html`) to `dist/index.html`
//
// The runtime is bundled locally (no CDN) and all URLs in index.html are
// relative, so the result works under the GitHub Pages project subpath.

import { createRequire } from 'node:module'
import { cp, mkdir, copyFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

// Fail loudly if the web build hasn't run yet.
try {
  await access(path.join(dist, 'main.web.bundle'))
} catch {
  console.error('✗ dist/main.web.bundle not found — run `rspeedy build` first.')
  process.exit(1)
}

// Locate the web-core prod runtime inside node_modules.
const webCorePkg = require.resolve('@lynx-js/web-core/package.json')
const runtimeSrc = path.join(
  path.dirname(webCorePkg),
  'dist',
  'client_prod',
  'static',
)

await mkdir(dist, { recursive: true })
await cp(runtimeSrc, path.join(dist, 'static'), { recursive: true })
await copyFile(path.join(root, 'web', 'index.html'), path.join(dist, 'index.html'))

console.log('✓ Assembled static web site in dist/')
console.log('  - dist/index.html        (host page)')
console.log('  - dist/main.web.bundle   (app)')
console.log('  - dist/static/           (Lynx web runtime)')
