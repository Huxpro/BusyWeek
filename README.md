# BusyWeek!

> A **time-based** Todo-list app with a simple, elegant design — now ported to
> [Vue Lynx](https://vue.lynxjs.org).

## What is BusyWeek!

BusyWeek! helps you manage your schedule by automatically converting between

- *What is the date that day?*
- *What day of the week is it?*
- *How many days before/after today?*

and presenting a Todo-list **sorted by date**.

## Vue Lynx port (v3.0.0)

This repository was originally a Vue.js 0.12 web app (built with RequireJS,
Gulp, iScroll, LeanCloud and Cordova). It has been ported to a fresh
[Vue Lynx](https://vue.lynxjs.org) project so it renders **natively** through
the [Lynx](https://lynxjs.org) engine.

The project was scaffolded the same way `npm create vue-lynx@latest` would
generate it (TypeScript template), then the BusyWeek feature set was rebuilt on
top of it.

### Getting started

```bash
npm install
npm run dev      # start the dev server (web preview + Lynx bundle + QR code)
npm run build    # production build for the `lynx` and `web` targets
npm run preview  # preview the production build
```

`npm run dev` prints three URLs: a **Web Preview** to open in a browser, a
**Lynx** bundle URL you can open in [LynxExplorer](https://lynxjs.org) (scan the
QR code), and a raw **Web** bundle for container integration.

> Requires Node.js 18+.

### Try it on the web 🌐

Both editions are deployed side by side, so you can compare them live:

| URL | Edition |
| --- | --- |
| **https://huangxuan.me/BusyWeek/** | Vue Lynx version (on the Lynx Web Platform via `@lynx-js/web-core`) |
| **https://huangxuan.me/BusyWeek/legacy/** | the original Vue 0.12 web edition |

They are published by the [`deploy-pages`](.github/workflows/deploy-pages.yml)
GitHub Actions workflow on every push to `master` (and via **Actions → Run
workflow**). It requires **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The build emits a `CNAME`, so the custom domain
(`huangxuan.me`) is preserved on every deploy.

To build the static site locally:

```bash
npm run build:web   # rspeedy build + assemble dist/ (both editions)
npx serve dist      # serve dist/ — / is Lynx, /legacy/ is the original
```

`build:web` produces a fully self-contained `dist/` with relative URLs so it
works under the GitHub Pages project subpath:

- `index.html`, `main.web.bundle`, `static/` — the Lynx app + web runtime (`/`)
- `legacy/` — the original web app (`/legacy/`), with its dead LeanCloud SDK
  stubbed so it boots without the CDN (login / cloud-sync are inert)
- `.nojekyll` — so Pages serves the runtime folders verbatim
- `CNAME` — preserves the `huangxuan.me` custom domain across deploys

### Project layout

```
src/
  index.ts     # createApp(App).mount() entry; imports base.css
  App.vue      # the whole BusyWeek UI (composer, timeline, filters, FAB)
  base.css     # shared base styles (cross-platform font stack, smoothing)
  store.ts     # persistence (NativeModules local storage, in-memory fallback)
  util.ts      # date helpers (ported from the original util.js)
  types.ts     # Todo / DayObject / Timeline model
  App.css      # Material-ish theme (#03A9F4)
web/index.html # host page for the web build (loads the Lynx web runtime)
scripts/       # assemble-web.mjs — bundles the web runtime into dist/
lynx.config.ts # Rspeedy + Vue Lynx + QR-code plugins
legacy/        # the original Vue 0.12 web app, kept for reference
```

### What changed in the port

| Original (web)                       | Vue Lynx port                                   |
| ------------------------------------ | ----------------------------------------------- |
| Vue 0.12 (`v-repeat`, filters)       | Vue 3 SFC + `<script setup>` Composition API    |
| HTML `div` / `span` / `input`        | Lynx `<view>` / `<text>` / `<input>` / `<scroll-view>` |
| `@click`, `keyup`                    | Lynx events `@tap` / `@confirm` / `@blur`       |
| `<select>` day picker                | horizontal `<scroll-view>` of tappable day chips (Lynx has no `<select>`) |
| `localStorage`                       | `NativeModules.NativeLocalStorageModule` (with in-memory fallback) |
| iScroll fake scrolling               | native `<scroll-view>`                          |
| director.js routing                  | reactive `activeFilter` state                   |
| RequireJS + Gulp + Autoprefixer      | Rspeedy (Rsbuild + Rspack) build pipeline       |

The original LeanCloud login / cloud-sync feature was **not** ported: it
depends on a web-only SDK and browser globals that Lynx does not provide. The
core time-based todo experience — add, edit, check, delete, and filter by
all / active / done — is fully preserved.

---

## Legacy changelog

The history of the original web app lives in [`legacy/`](./legacy). Highlights:

- **V2.1.1** — Vue.js upgraded to 0.12.12; migrated to `gulp-connect`
- **V2.0.0** — LogIn/SignUp/CloudSync via LeanCloud; routing via director.js
- **V1.8.0** — iScroll-based fake native scrolling; iOS `standalone` support
- **V1.5.0** — Material design, icons and FAB
- **V1.4.0** — Navigation drawer and todo filters
- **V1.3.0** — Migrated to RequireJS + Gulp
- **V1.2.0** — IntelliScroll position system
- **V1.0.0** — First release (Vue.js + NPM + Grunt)

@2015 [黄玄 (Hux)](http://huangxuan.me/about/) ·
[知乎](http://www.zhihu.com/people/huxpro) ·
[博客](http://huangxuan.me) ·
[GitHub](https://github.com/huxpro)
