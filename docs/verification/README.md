# Visual & interaction verification

The Vue Lynx port was driven through a headless browser (Playwright + Chromium)
and compared **side by side** against the original Vue 0.12 web edition
(`legacy/`) under the **same scripted interactions**.

- **Port** runs as the **Lynx-for-web** bundle from `npm run dev`
  (`/__web_preview`), i.e. the same Vue Lynx code that renders natively, served
  through Lynx's web runtime (`<lynx-view>` → `<x-view>` / `<x-text>` /
  `<scroll-view>`, `@tap` events).
- **Original** is `legacy/src` served statically. The LeanCloud SDK was stubbed
  (login/cloud sync is out of scope and needs a CDN + browser globals); nothing
  else was changed.

Scenario (identical for both), viewport 390×844:

1. start empty → 2. add 4 todos (今天 ×2, 明天, 后天) via the composer →
3. check the first todo done → 4. filter **在忙 (active)** → 5. filter **完成 (done)**.

Both apps ended in the same state — `{ days: 3, todos: 4, checked: 1 }` with
identical text — confirming the ported logic (date grouping, weekday math,
add/check, and the active/done filters) matches the original.

## Side-by-side

| Step | Composite |
| --- | --- |
| Empty state | `compare-01-initial-empty.png` |
| Timeline (全部) | `compare-02-list-all.png` |
| Checked / strikethrough | `compare-03-checked-done.png` |
| Filter 在忙 | `compare-04-filter-active.png` |
| Filter 完成 | `compare-05-filter-done.png` |

Per-app frames are under `port/` and `original/`.

## Notes

- **Expected design differences:** the port surfaces filters as **tabs** in the
  app bar (全部 / 在忙 / 完成); the original kept them in a hamburger **nav
  drawer**. The port uses a round checkbox, the original a square one. Day
  headers read “周二” in the port vs “星期二” in the original (both correct).
- **Legacy flexbox fix:** the original used 2009-era `-webkit-box` flexbox, so
  in a 2026 browser its un-flexed todo-text column collapsed CJK text to one
  character per line (`original/02-list-all-BEFORE-flexbox-fix.png`). This was
  fixed at the source by adding standard flexbox (`display: flex`, `flex`,
  `align-items`, `justify-content`) alongside the legacy `-webkit-box` rules in
  `legacy/src/css/style.css` and `mpi.scss`. The `original/*.png` frames above
  are rendered straight from that fixed CSS — **no test-time shim**.
