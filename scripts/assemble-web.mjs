// Assemble a static, self-contained site for GitHub Pages (or any static host),
// hosting BOTH editions of BusyWeek side by side:
//
//   /         -> the Vue Lynx version (this project's web build)
//   /legacy/  -> the original Vue 0.12 web edition (from legacy/src)
//
// Run *after* `rspeedy build`, which produces `dist/main.web.bundle`. This:
//   1. copies the @lynx-js/web-core prod runtime into `dist/static/`
//   2. copies the host page (`web/index.html`) to `dist/index.html`
//   3. copies the original web app into `dist/legacy/`, stubbing its (long
//      dead) LeanCloud SDK so it boots without the CDN
//
// The Lynx runtime is bundled locally (no CDN) and all URLs are relative, so
// the result works under the GitHub Pages project subpath.

import { createRequire } from 'node:module'
import { cp, mkdir, copyFile, access, writeFile, readFile } from 'node:fs/promises'
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
// Disable Jekyll so GitHub Pages serves the runtime folders/files verbatim.
await writeFile(path.join(dist, '.nojekyll'), '')

// Preserve the Pages custom domain. The deploy force-pushes a fresh gh-pages
// branch, so the CNAME must be re-emitted on every build or the custom domain
// (huangxuan.me) breaks with a 404.
const cnameSrc = path.join(root, 'web', 'CNAME')
try {
  await access(cnameSrc)
  await copyFile(cnameSrc, path.join(dist, 'CNAME'))
} catch {
  // no custom domain configured — skip
}

// --- Original edition at /legacy/ -----------------------------------------
// Copy the original web app verbatim, then neutralize its LeanCloud (AV)
// dependency: the SDK is loaded from an external CDN and the app's 2015-era
// backend/keys are long gone, so a failed load would hang the splash screen.
// The stub lets the UI boot; only login / cloud-sync are inert.
const legacySrc = path.join(root, 'legacy', 'src')
const legacyOut = path.join(dist, 'legacy')
await cp(legacySrc, legacyOut, { recursive: true })

const avStub = `// Deploy-only stub for the LeanCloud (AV) SDK so BusyWeek boots without the
// external CDN. Login / cloud-sync are inert; the todo app is unaffected.
window.AV = {
  initialize: function () {},
  User: {
    current: function () { return null; },
    logIn: function () {},
    logOut: function () {}
  }
};
define('AV', [], function () { return window.AV; });
`
await writeFile(path.join(legacyOut, 'js', 'lib', 'av-stub.js'), avStub)

const appJsPath = path.join(legacyOut, 'js', 'app.js')
const appJs = await readFile(appJsPath, 'utf8')
const patched = appJs.replace(
  /AV:\s*"https:\/\/cdn1\.lncld\.net\/static\/js\/av-core-mini-0\.5\.4"/,
  'AV: "lib/av-stub"',
)
if (patched === appJs) {
  console.warn('⚠ legacy AV CDN path not found in app.js — stub not wired')
}
await writeFile(appJsPath, patched)

console.log('✓ Assembled static web site in dist/')
console.log('  - dist/index.html        (Lynx host page,  served at /)')
console.log('  - dist/main.web.bundle   (Lynx app)')
console.log('  - dist/static/           (Lynx web runtime)')
console.log('  - dist/legacy/           (original web edition, served at /legacy/)')
console.log('  - dist/.nojekyll + CNAME')
