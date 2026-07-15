# Todo Edit Keyboard Avoidance Design

## Goal

When a Todo enters edit mode on iOS, keep its native `<input>` fully visible above the software keyboard and leave the main timeline manually scrollable. The pinned app header must not move, and Web behavior must remain unchanged.

## Confirmed root cause

The current edit path only mounts the input, seeds it with `setValue`, and focuses it. It neither expands the timeline's scroll range while the keyboard is present nor moves `#timeline-scroll` after focus.

The iPhone 17 Pro simulator reproduces the failure deterministically with eleven rows: the last edit input has screen bounds `y=714..738`, while the keyboard begins at `y=566`. The field is therefore entirely behind the keyboard even though focus succeeds.

## Reference implementation

The design ports the mechanism from LynxUI's [KeyboardAwareInScrollView example](https://github.com/lynx-family/lynx-ui/blob/f2bd3a2048ceeec19c58b79b4cdd29d12b496bed/apps/examples/Input/KeyboardAwareInScrollView/index.tsx) and its [KeyboardAwareRoot](https://github.com/lynx-family/lynx-ui/blob/f2bd3a2048ceeec19c58b79b4cdd29d12b496bed/packages/lynx-ui-input/src/KeyboardAwareRoot.tsx) / [KeyboardAwareResponder](https://github.com/lynx-family/lynx-ui/blob/f2bd3a2048ceeec19c58b79b4cdd29d12b496bed/packages/lynx-ui-input/src/KeyboardAwareResponder.tsx) components.

The ReactLynx package cannot be imported into this Vue Lynx application. Its underlying algorithm is portable: observe the keyboard, add a trailing dummy spacer, measure the focused field and scroll viewport, then issue an absolute scroll command.

## Considered approaches

1. Use `scrollIntoView`. It aligns against the full scroll-view viewport and does not know that the keyboard covers its lower portion, so the input can still land behind the keyboard.
2. Translate the application root. This would move the pinned header and would not provide a naturally scrollable keyboard-height content range.
3. Switch to legacy `x-input smart-scroll`. The app uses the current built-in input, and changing element families would reintroduce older asynchronous layout/value behavior.
4. Port LynxUI's spacer-and-measurement mechanism. This preserves the header, uses the existing single-child timeline structure, and scrolls only when the focused row overlaps the keyboard. This is the selected approach.

## Geometry and scrolling

While an edit input is focused, append a dedicated dynamic spacer after the existing FAB/safe-area spacer. Its height is the part of the keyboard that overlaps the timeline viewport.

Measure the app root, timeline viewport, and focused input in screen coordinates. Read the timeline's current absolute offset (`scrollY`, with `scrollTop` accepted for newer native backends). With a `16px` comfort gap:

```text
visibleBottom = min(timeline.bottom, root.bottom - keyboardHeight)
overlap = max(0, input.bottom + 16 - visibleBottom)
targetScrollY = max(0, currentScrollY + overlap)
spacerHeight = max(0, keyboardHeight - max(0, root.bottom - timeline.bottom))
```

If `overlap` is zero, do not move the list. Otherwise call `scrollTo({ offset: targetScrollY, smooth: true })`. The call intentionally omits `index`: on iOS an indexed call adds the first child's origin, and this timeline already has `10px` top padding.

`boundingClientRect` uses `relativeTo: 'screen'` plus transform-aware flags because day and Todo positions are rendered with ancestor transforms. Every native `invoke` includes a failure callback so an input disappearing during an asynchronous query cannot trigger a native red screen.

## Events and races

The edit input listens to both `keyboard` and `keyboardheightchange`; the existing normalizer accepts both payloads. The global `keyboardstatuschanged` listener remains a fallback and routes to the active editor when one exists.

Both element events can report the same height. Absolute `currentScrollY + overlap` positioning is idempotent, and a generation token prevents an older measurement from scrolling after focus has moved or editing has ended.

Focus re-runs avoidance when a keyboard is already open, which covers moving directly between Todo inputs without a fresh keyboard-show event. Blur/confirm delays clearing the spacer by roughly the keyboard dismissal duration; starting another edit cancels that cleanup. The list is not forced back to its former position.

## Verification

- Unit-test overlap, no-op, pre-scrolled, viewport-bottom-gap, and invalid-height geometry.
- Unit-test the SelectorQuery adapter for transform-aware screen measurements, `getScrollInfo`, offset-only `scrollTo`, and failure-safe cancellation.
- Add source regressions for both edit keyboard events and the dynamic spacer.
- Run all tests, TypeScript, and production Lynx/Web builds.
- On the iOS simulator, edit both an already-visible Todo and the last Todo in a long list. Record and assert that the last input's bottom is at least `16px` above the keyboard top, that the header stays fixed, and that the timeline remains manually scrollable.
