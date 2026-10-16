# Multiline Todo and Composer Editing Design

## Goals

- Give the composer controls the same visual clearance above the software keyboard as the clearance between the quick-day shortcuts and the picker row.
- Render every Todo's complete text at its natural number of lines on Native and Web.
- Replace inline row editing with a long-press interaction that opens the existing full-screen composer in edit mode.
- Allow an edit to change both the Todo text and its date while preserving identity and completion state.
- Keep Clear-style displacement motion correct for variable-height rows, including removal, completed-item hiding, and cross-date moves.

## Interaction model

The floating action button opens the composer with a create intent. A long press on `.todo-body` opens the same composer with an edit intent containing the Todo id and its source date. The checkbox and delete hit targets keep their existing stopped tap handlers, so neither can accidentally open the editor. A normal tap on the Todo body no longer swaps in an inline input.

Native Lynx supplies its standard 500ms `longpress` event and cancels it when scrolling wins the gesture. The pinned Web Core revision does not synthesize that event, so `web/index.html` installs a delegated shadow-root pointer bridge. It starts a 500ms timer only for `.todo-body`, cancels on pointer movement beyond a small threshold, pointer cancellation/up, or timeline scroll, and dispatches a bubbling/composed `CustomEvent('longpress')` to the Lynx element. It never prevents pointer movement, so Web scrolling remains native. A scoped `contextmenu` handler suppresses the browser menu only after this Todo-body gesture.

The composer title and submit label are intent-specific:

- create: `添加事项` / `添加`
- edit: `编辑事项` / `保存`

Opening an edit copies the Todo text and date into isolated draft refs, then uses the existing post-mount `setValue` followed by focus sequence. Closing or swiping the composer away discards the draft. Saving trims the text. To preserve the prior inline editor's behavior, an empty edit removes the Todo; an empty create continues to use `写点啥呀！`.

When the date changes, save removes the Todo from its source day, deletes an empty source day, updates `date` and `dayType`, and inserts the same logical Todo into the target day. Its stable `id` and `done` values remain unchanged. The timeline's existing date sort determines the resulting visual order.

## Cross-platform text measurement

The row height is not capped. Both builds use the same small internal facade with `prepare`/`layout` semantics, but Rspeedy resolves its implementation by environment:

- `lynx`: `lynx-pretext@0.0.1`, whose width primitive is `lynx.getTextInfo()` and whose source is safe for PrimJS.
- `web`: `@chenglou/pretext@0.0.8`, whose width primitive is Canvas 2D `measureText()` and which uses `OffscreenCanvas` in the Lynx Web worker.

Environment-level `resolve.alias` keeps the browser package and its Unicode/`Intl.Segmenter` requirements out of the Native bundle. The Web backend is capability guarded: if Canvas or segmentation is unavailable, the app starts with the minimum height and relies on the renderer layout event instead of failing the list.

An invisible, non-interactive row-width probe uses the exact day-card/Todo geometry. Its `.todo-body` emits `layoutchange`; a SelectorQuery `boundingClientRect` call is the fallback. Once the usable text width is known, each Todo is prepared once per text/font combination and laid out cheaply for that width. A resize invalidates only width-dependent layout results, not the prepared text cache.

Measurements use `whiteSpace: 'pre-wrap'`, a `15px` body font, and a `20px` line height. Row height is:

```text
max(52, measuredTextHeight + 16)
```

The 16px vertical chrome gives multiline text 8px above and below while retaining the existing 52px minimum and touch comfort for a single line.

Prediction is not the final authority. Every visible `<text>` listens for Lynx's `layout` event and reports its renderer-owned `lineCount` and `size.height`. A valid actual height replaces the prediction for that Todo. Text edits and text-width changes invalidate stale actual values. This corrects font, emoji, bidi, and engine differences without introducing a fixed line limit.

## Variable-height motion

`createTimelineMotionLayout` receives a Todo-height map. It replaces `index * 52` with per-day prefix sums and replaces `count * 52` with the sum of resolved heights. Missing or invalid measurements fall back to 52px.

The template assigns both transform and height to every `.todo-slot`; the nested `.todo` stretches to that height. Checkbox and delete hit areas remain at least 44px and vertically center within taller rows. The leaving VNode keeps its last inline height while survivors, day-card heights, and later day offsets transition to their new prefix-sum positions. This preserves the current exit-left plus surrounding displacement choreography for rows of any height.

## Composer spacing

The quick-day viewport is 50px tall while its chip is 44px, and the viewport has an 8px bottom margin. Therefore the visual shortcut-to-picker clearance is 14px. When the native keyboard is open, `.addpage-bottom` uses 14px bottom padding instead of 8px, matching that rhythm while retaining the existing keyboard-height offset.

## Cleanup

Inline edit state, `<input>`, focus directive, edit-keyboard spacer, and the dedicated inline keyboard-avoidance modules/tests become dead code and are removed. Composer keyboard avoidance remains in place and now covers both creation and editing.

## Failure handling

- Invalid or unavailable predicted measurement returns the 52px minimum and never prevents rendering.
- Invalid layout events are ignored.
- SelectorQuery calls keep failure callbacks and cannot red-screen if the probe or composer disappears.
- Long press is attached only to the Todo body; Lynx cancels it when scrolling wins the gesture.
- Picker sheets retain their current unmount-on-close behavior and operate on the same draft date in both intents.

## Verification

- Unit-test row-height clamping, arbitrary line counts, renderer correction normalization, cache invalidation, and variable-height prefix sums.
- Unit-test editing in place, moving across dates, preserving `id`/`done`, source-day cleanup, cancellation, and empty-edit removal through extracted pure helpers.
- Add source regressions for long press, removal of inline input/keyboard spacer, dynamic title/submit labels, 14px keyboard spacing, layout events, and environment aliases.
- Unit-test the Web long-press bridge's 500ms trigger plus movement, release, and scroll cancellation with fake timers and a minimal event target.
- Build both `lynx` and `web` environments and confirm each bundle contains only its intended Pretext backend.
- Web: verify one-line, long CJK, long Latin, emoji, explicit newline, completed-item hiding, deletion, long-press edit, date move, cancel, and responsive desktop widths.
- iOS Simulator: verify the same text corpus, 500ms long press, composer prefill, keyboard clearance, picker/date changes, scroll cancellation of long press, and smooth displacement after rows leave or move.

## References

- [Pretext](https://github.com/chenglou/pretext)
- [lynx-pretext](https://github.com/Huxpro/lynx-pretext)
- [Lynx `getTextInfo`](https://lynxjs.org/api/lynx-api/lynx/lynx-get-text-info)
- [Lynx `<text>` layout event](https://lynxjs.org/api/elements/built-in/text)
- [Rspeedy/Rsbuild environment aliases](https://rsbuild.rs/config/resolve/alias)
