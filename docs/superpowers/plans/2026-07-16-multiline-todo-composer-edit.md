# Multiline Todo and Composer Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render uncapped multiline Todos with smooth variable-height motion, and replace inline editing with a long-press full composer that can edit text and date on Native and Web.

**Architecture:** Keep data mutation and row geometry in small pure TypeScript modules covered by Node tests. Resolve a stable text-measurement facade to `lynx-pretext` or browser Pretext per Rspeedy environment, then correct its prediction with the renderer's `<text layout>` event. Reuse one draft-based composer for create/edit, and add a testable Web-only 500ms pointer bridge because the pinned Web Core does not synthesize Lynx `longpress`.

**Tech Stack:** Vue Lynx 0.4, TypeScript 5.9, Rspeedy/Rsbuild multi-environment aliases, `lynx-pretext@0.0.1`, `@chenglou/pretext@0.0.8`, Node `node:test`, Lynx DevTool, iOS Simulator.

---

## File map

- Create `src/todoComposer.ts`: immutable create/edit/delete/move domain operations.
- Create `src/todoTextLayout.ts`: pure row-height and event-normalization rules.
- Create `src/textLayoutBackend.lynx.ts`: cached `lynx-pretext` adapter.
- Create `src/textLayoutBackend.web.ts`: capability-guarded cached Canvas Pretext adapter.
- Create `src/text-layout-backend.d.ts`: stable virtual-module contract.
- Create `web/todo-longpress.js`: testable 500ms pointer recognizer and DOM installer.
- Create `tests/todo-editor.test.ts`, `tests/todo-text-layout.test.ts`, `tests/web-longpress.test.ts`.
- Modify `src/App.vue`: shared composer intent/drafts, long press, width probe, renderer correction, and dynamic row styles.
- Modify `src/App.css`: variable-height rows, hidden measurement probe, long-press feedback, and 14px keyboard spacing.
- Modify `src/timelineMotion.ts` and `tests/timeline-motion.test.ts`: prefix-sum variable-height motion.
- Modify `lynx.config.ts`, `package.json`, and `package-lock.json`: environment backends and pinned dependencies.
- Modify `web/index.html` and `scripts/assemble-web.mjs`: install and publish the Web long-press bridge.
- Modify `src/starterTimeline.ts`, `tests/starter-timeline.test.ts`, and `tests/web-regressions.test.ts`: copy and structural regressions.
- Delete `src/nativeInput.ts`, `src/todoKeyboardAvoidance.ts`, `tests/native-input.test.ts`, and `tests/todo-keyboard-avoidance.test.ts`: superseded inline-editor code.

### Task 1: Pure composer mutations

**Files:**
- Create: `tests/todo-editor.test.ts`
- Create: `src/todoComposer.ts`

- [ ] **Step 1: Write failing create/edit/move/delete tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  commitComposerDraft,
  createComposerDraft,
} from '../src/todoComposer.ts'
import type { Timeline } from '../src/types.ts'

function fixture(): Timeline {
  return {
    '2026-07-16': {
      date: '2026-07-16',
      todos: [{
        id: 'a', date: '2026-07-16', dayType: 0,
        done: true, text: 'original',
      }],
    },
  }
}

test('edit draft is isolated until save', () => {
  const timeline = fixture()
  const draft = createComposerDraft(timeline, {
    kind: 'edit', todoId: 'a', sourceDate: '2026-07-16',
  }, '2026-07-20')
  draft.text = 'changed'
  assert.equal(timeline['2026-07-16'].todos[0].text, 'original')
})

test('moving an edit preserves identity and completion', () => {
  const result = commitComposerDraft(fixture(), {
    kind: 'edit', todoId: 'a', sourceDate: '2026-07-16',
  }, { text: ' moved ', date: '2026-07-18' }, {
    today: '2026-07-16', idFactory: () => 'unused',
  })
  assert.equal(result['2026-07-16'], undefined)
  assert.deepEqual(result['2026-07-18'].todos[0], {
    id: 'a', date: '2026-07-18', dayType: 2,
    done: true, text: 'moved',
  })
})
```

Add separate tests for same-day order preservation, missing target no-op, blank edit deletion, blank create default text, and cancel (never calling commit) leaving the serialized timeline unchanged.

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/todo-editor.test.ts`

Expected: module-not-found failure for `src/todoComposer.ts`.

- [ ] **Step 3: Implement immutable composer helpers**

```ts
import type { Timeline, Todo } from './types.js'
import { getDateDiff } from './util.js'

export type ComposerIntent =
  | { kind: 'create' }
  | { kind: 'edit'; todoId: string; sourceDate: string }

export interface ComposerDraft { text: string; date: string }
export interface CommitOptions { today: string; idFactory: () => string }

export function createComposerDraft(
  timeline: Timeline,
  intent: ComposerIntent,
  today: string,
): ComposerDraft {
  if (intent.kind === 'create') return { text: '', date: today }
  const todo = timeline[intent.sourceDate]?.todos.find(
    (item) => item.id === intent.todoId,
  )
  return todo ? { text: todo.text, date: todo.date } : { text: '', date: today }
}

export function commitComposerDraft(
  timeline: Timeline,
  intent: ComposerIntent,
  draft: ComposerDraft,
  options: CommitOptions,
): Timeline {
  const text = draft.text.trim()
  if (intent.kind === 'create') {
    const todo: Todo = {
      id: options.idFactory(), date: draft.date,
      dayType: getDateDiff(draft.date, options.today),
      done: false, text: text || '写点啥呀！',
    }
    const target = timeline[draft.date]
    return {
      ...timeline,
      [draft.date]: {
        date: draft.date,
        todos: [...(target?.todos ?? []), todo],
      },
    }
  }

  const source = timeline[intent.sourceDate]
  const index = source?.todos.findIndex((item) => item.id === intent.todoId) ?? -1
  if (!source || index < 0) return timeline
  const current = source.todos[index]
  const without = source.todos.filter((item) => item.id !== current.id)
  const next = { ...timeline }
  if (without.length) next[intent.sourceDate] = { ...source, todos: without }
  else delete next[intent.sourceDate]
  if (!text) return next

  const edited: Todo = {
    ...current,
    text,
    date: draft.date,
    dayType: getDateDiff(draft.date, options.today),
  }
  if (draft.date === intent.sourceDate) {
    const todos = [...source.todos]
    todos[index] = edited
    return { ...timeline, [intent.sourceDate]: { ...source, todos } }
  }
  const target = next[draft.date]
  next[draft.date] = {
    date: draft.date,
    todos: [...(target?.todos ?? []), edited],
  }
  return next
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/todo-editor.test.ts && node --test tests/*.test.ts`

Expected: all composer tests and the existing 44-test baseline pass.

- [ ] **Step 5: Commit the pure domain change**

```bash
git add src/todoComposer.ts tests/todo-editor.test.ts
git commit -m "feat: add draft-based todo composer mutations"
```

### Task 2: Arbitrary row heights and prefix-sum motion

**Files:**
- Create: `tests/todo-text-layout.test.ts`
- Create: `src/todoTextLayout.ts`
- Modify: `tests/timeline-motion.test.ts`
- Modify: `src/timelineMotion.ts`

- [ ] **Step 1: Write failing geometry tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TODO_MIN_ROW_HEIGHT,
  rowHeightFromTextHeight,
  rowHeightFromLayoutEvent,
} from '../src/todoTextLayout.ts'

test('row height has no line-count cap', () => {
  assert.equal(rowHeightFromTextHeight(20), 52)
  assert.equal(rowHeightFromTextHeight(40), 56)
  assert.equal(rowHeightFromTextHeight(80), 96)
  assert.equal(rowHeightFromTextHeight(160), 176)
})

test('invalid measurements use the minimum', () => {
  assert.equal(rowHeightFromTextHeight(Number.NaN), TODO_MIN_ROW_HEIGHT)
  assert.equal(rowHeightFromLayoutEvent({ detail: {} }), null)
})

test('renderer height corrects a prediction', () => {
  assert.equal(rowHeightFromLayoutEvent({
    detail: { lineCount: 4, size: { width: 180, height: 80 } },
  }), 96)
})
```

Update `tests/timeline-motion.test.ts` so rows `a=52`, `b=96`, and `c=72` use cumulative offsets; removing `b` must move the survivor, later day, and total height by exactly 96px. Add invalid/zero/NaN fallback assertions.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/todo-text-layout.test.ts tests/timeline-motion.test.ts`

Expected: missing `todoTextLayout.ts` and fixed-height offset assertion failures.

- [ ] **Step 3: Implement pure row geometry**

```ts
export const TODO_MIN_ROW_HEIGHT = 52
export const TODO_TEXT_LINE_HEIGHT = 20
export const TODO_VERTICAL_CHROME = 16

export function rowHeightFromTextHeight(textHeight: number): number {
  if (!Number.isFinite(textHeight) || textHeight <= 0) return TODO_MIN_ROW_HEIGHT
  return Math.max(TODO_MIN_ROW_HEIGHT, Math.ceil(textHeight) + TODO_VERTICAL_CHROME)
}

export function rowHeightFromLayoutEvent(event: unknown): number | null {
  const detail = (event as { detail?: { lineCount?: unknown; size?: { height?: unknown } } })?.detail
  const height = detail?.size?.height
  const lineCount = detail?.lineCount
  if (typeof lineCount !== 'number' || lineCount < 1) return null
  if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
    return rowHeightFromTextHeight(lineCount * TODO_TEXT_LINE_HEIGHT)
  }
  return rowHeightFromTextHeight(height)
}
```

- [ ] **Step 4: Convert motion to prefix sums**

Change the signature to:

```ts
export function createTimelineMotionLayout(
  visibleDays: VisibleDay[],
  rowHeights: Readonly<Record<string, number>> = {},
): TimelineMotionLayout
```

For each Todo, sanitize `rowHeights[id]` to at least 52, assign the current cursor to `todoOffsets[id]`, save the resolved value in `todoHeights[id]`, and advance the cursor. Set `todosHeight` to that cursor and use it in the day/total prefix sum.

- [ ] **Step 5: Run geometry and full suites GREEN**

Run: `node --test tests/todo-text-layout.test.ts tests/timeline-motion.test.ts && node --test tests/*.test.ts`

Expected: all tests pass with mixed row heights and exact removal deltas.

- [ ] **Step 6: Commit variable-height geometry**

```bash
git add src/todoTextLayout.ts src/timelineMotion.ts tests/todo-text-layout.test.ts tests/timeline-motion.test.ts
git commit -m "feat: support variable-height todo motion"
```

### Task 3: Platform-specific Pretext backends

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `lynx.config.ts`
- Create: `src/text-layout-backend.d.ts`
- Create: `src/textLayoutBackend.lynx.ts`
- Create: `src/textLayoutBackend.web.ts`
- Modify: `tests/web-regressions.test.ts`

- [ ] **Step 1: Add failing backend/config source regressions**

Assert that `lynx.config.ts` maps `@busyweek/text-layout-backend$` to the two wrapper files, both wrappers export `measureTodoText`, Web imports `@chenglou/pretext`, Native imports `lynx-pretext`, and the Web wrapper catches missing `OffscreenCanvas`/`Intl.Segmenter` by returning `null`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/web-regressions.test.ts`

Expected: alias/backend assertions fail because no wrappers exist.

- [ ] **Step 3: Install exact 0.x dependencies**

Run: `npm install --save-exact lynx-pretext@0.0.1 @chenglou/pretext@0.0.8`

Expected: both exact versions appear under `dependencies` and in `package-lock.json`.

- [ ] **Step 4: Add the virtual contract and cached wrappers**

```ts
declare module '@busyweek/text-layout-backend' {
  export interface TodoTextMeasurement {
    lineCount: number
    textHeight: number
  }
  export function measureTodoText(
    text: string,
    width: number,
  ): TodoTextMeasurement | null
  export function clearTodoTextMeasurementCache(): void
}
```

Each wrapper keeps `Map<string, ReturnType<typeof prepare>>`, calls `prepare(text, platformFont, { whiteSpace: 'pre-wrap' })` once, and calls `layout(prepared, width, 20)` on each width. It returns `null` on invalid width/result or exceptions. Web first checks Worker `OffscreenCanvas` and `Intl.Segmenter`; Native uses `15px` and Web uses the explicit BusyWeek sans-serif stack.

- [ ] **Step 5: Configure environment aliases**

```ts
import { fileURLToPath } from 'node:url'

const textBackend = (name: string) =>
  fileURLToPath(new URL(`./src/${name}`, import.meta.url))

environments: {
  lynx: { resolve: { alias: {
    '@busyweek/text-layout-backend$': textBackend('textLayoutBackend.lynx.ts'),
  } } },
  web: { resolve: { alias: {
    '@busyweek/text-layout-backend$': textBackend('textLayoutBackend.web.ts'),
  } } },
},
```

- [ ] **Step 6: Verify tests, types, both builds, and isolation**

Run:

```bash
node --test tests/web-regressions.test.ts
npx tsc -b
npm run build:web
test -s dist/main.lynx.bundle
test -s dist/main.web.bundle
! rg -a "OffscreenCanvas|Emoji_Presentation" dist/main.lynx.bundle
! rg -a "SegmenterPolyfill|getTextInfo\(seg" dist/main.web.bundle
```

Expected: tests/types/build pass; both bundles exist; each backend's unique markers are absent from the other platform bundle.

- [ ] **Step 7: Commit backend isolation**

```bash
git add package.json package-lock.json lynx.config.ts src/text-layout-backend.d.ts src/textLayoutBackend.lynx.ts src/textLayoutBackend.web.ts tests/web-regressions.test.ts
git commit -m "feat: add native and web text measurement backends"
```

### Task 4: Reuse the composer for long-press editing

**Files:**
- Modify: `src/App.vue`
- Modify: `tests/web-regressions.test.ts`
- Delete: `src/nativeInput.ts`
- Delete: `src/todoKeyboardAvoidance.ts`
- Delete: `tests/native-input.test.ts`
- Delete: `tests/todo-keyboard-avoidance.test.ts`

- [ ] **Step 1: Replace old inline-edit assertions with failing composer assertions**

Assert all of the following in `tests/web-regressions.test.ts`:

```ts
assert.match(appSource, /@longpress\.stop="openTodoEditor\(day\.key, todo\)"/)
assert.doesNotMatch(appSource, /class="todo-body"[^>]*@tap=/)
assert.doesNotMatch(appSource, /<input[\s\S]*?class="todo-input"/)
assert.doesNotMatch(appSource, /editingId|edit-keyboard-spacer/)
assert.match(appSource, /composerTitle/)
assert.match(appSource, /composerSubmitLabel/)
assert.match(appSource, /编辑事项/)
assert.match(appSource, /保存/)
```

Also assert that `openTodoEditor` copies text/date before the shared open/focus sequence and that submit assigns one `commitComposerDraft` result to `timeline.value`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/web-regressions.test.ts`

Expected: old inline editor is still present and new long-press/shared-composer assertions fail.

- [ ] **Step 3: Refactor App state and actions**

Import `ComposerIntent`, `createComposerDraft`, and `commitComposerDraft`. Replace add-only refs with:

```ts
const composerIntent = ref<ComposerIntent>({ kind: 'create' })
const composerText = ref('')
const composerDate = ref(getTodayDate())
const composerTitle = computed(() =>
  composerIntent.value.kind === 'edit' ? '编辑事项' : '添加事项',
)
const composerSubmitLabel = computed(() =>
  composerIntent.value.kind === 'edit' ? '保存' : '添加',
)
```

Implement a shared `openComposer(intent)` that creates an isolated draft, assigns text/date before `state = 'INPUT'`, awaits `nextTick`, calls `setComposerValue(composerText.value)`, then focuses. `openCreateComposer()` passes `{kind:'create'}`; `openTodoEditor(dayKey,todo)` passes the stable edit intent. `submitComposer()` calls `commitComposerDraft`, clears stale measured height for the edited id, assigns `timeline.value` once, dismisses the keyboard, closes picker flags, and closes the composer.

- [ ] **Step 4: Replace template edit interaction**

The Todo body becomes:

```vue
<view
  class="todo-body"
  @longpress.stop="openTodoEditor(day.key, todo)"
>
  <text
    class="bw-text todo-text"
    :class="{ 'todo-text--done': todo.done }"
    @layout="onTodoTextLayout(todo.id, $event)"
  >{{ todo.text }}</text>
</view>
```

Bind composer textarea/pickers to `composerText`/`composerDate`, render `{{ composerTitle }}` and `{{ composerSubmitLabel }}`, and submit through `submitComposer`.

- [ ] **Step 5: Remove the superseded inline stack**

Delete inline edit refs, keyboard generation/timer/spacer, `vFocus`, `startEdit`, `finishEdit`, and `onEdit*`. Simplify the global keyboard listener to update the composer only. Delete the two dead helper modules and their tests; keep `nativeKeyboard.ts` because the full composer still uses it.

- [ ] **Step 6: Run focused/full tests and typecheck**

Run: `node --test tests/todo-editor.test.ts tests/web-regressions.test.ts && node --test tests/*.test.ts && npx tsc -b`

Expected: new edit behavior and all surviving tests pass; TypeScript reports no errors.

- [ ] **Step 7: Commit the shared editor**

```bash
git add -A src tests
git commit -m "feat: edit todos in the full composer"
```

### Task 5: Integrate prediction, renderer correction, and dynamic CSS

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.css`
- Modify: `tests/web-regressions.test.ts`
- Modify: `src/starterTimeline.ts`
- Modify: `tests/starter-timeline.test.ts`

- [ ] **Step 1: Write failing integration/source regressions**

Assert a hidden `.todo-width-probe`, probe `layoutchange`, fallback `boundingClientRect`, use of `measureTodoText`, renderer `<text @layout>`, slot height binding, 14px keyboard padding, no fixed `.todo-slot/.todo/.checkbox-hit` 52px height, and starter copy mentioning long-press editing of text/date.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/starter-timeline.test.ts tests/web-regressions.test.ts`

Expected: every new measurement/spacing/copy assertion fails against the fixed-height UI.

- [ ] **Step 3: Add width and height registries in App**

```ts
const todoTextWidth = ref(0)
const correctedTodoHeights = ref<Record<string, number>>({})

const predictedTodoHeights = computed(() => {
  const heights: Record<string, number> = {}
  for (const day of visibleDays.value) {
    for (const todo of day.todos) {
      const measured = measureTodoText(todo.text, todoTextWidth.value)
      heights[todo.id] = correctedTodoHeights.value[todo.id]
        ?? rowHeightFromTextHeight(measured?.textHeight ?? 0)
    }
  }
  return heights
})
```

Pass this map to `createTimelineMotionLayout`. `todoSlotStyle` returns both `transform` and `height`; add `todoRowStyle` for the nested row. On a valid text layout event, immutably update only that id. When probe width changes by more than 0.5px, assign the width and clear corrections so the new prediction is used until fresh layout events arrive.

- [ ] **Step 4: Add exact-width probe and fallback query**

Mount one transparent absolute Todo row matching the day card geometry, with `@layoutchange` on its body. Normalize `detail.width`/`detail.size.width`; after `nextTick`, query `#todo-width-probe-body` with `boundingClientRect` and a failure callback. If both paths are unavailable, use a conservative 240px fallback so the list renders and renderer events can correct it.

- [ ] **Step 5: Make CSS variable-height and adjust keyboard rhythm**

Use inline slot/row heights with:

```css
.todo-slot { position: absolute; top: 0; left: 0; width: 100%; }
.todo { min-height: 52px; height: 100%; }
.checkbox-hit { min-height: 52px; height: 100%; }
.todo-text { width: 100%; line-height: 20px; word-break: break-word; }
.todo-width-probe { position: absolute; width: 94%; left: 3%; opacity: 0; pointer-events: none; }
.addpage--keyboard .addpage-bottom { padding-bottom: 14px; }
```

Remove `.todo-input`, `.todo--editing`, and edit-spacer styles. Add restrained pressed feedback to `.todo-body:active .todo-text` without changing checkbox/delete behavior.

- [ ] **Step 6: Run all tests, types, and build**

Run: `node --test tests/*.test.ts && npx tsc -b && npm run build`

Expected: all automated checks pass and both environment bundles build.

- [ ] **Step 7: Commit multiline layout integration**

```bash
git add src/App.vue src/App.css src/starterTimeline.ts tests/starter-timeline.test.ts tests/web-regressions.test.ts
git commit -m "feat: render uncapped multiline todos"
```

### Task 6: Testable Web long-press synthesis

**Files:**
- Create: `tests/web-longpress.test.ts`
- Create: `web/todo-longpress.js`
- Modify: `web/index.html`
- Modify: `scripts/assemble-web.mjs`
- Modify: `tests/web-regressions.test.ts`

- [ ] **Step 1: Write failing controller tests with an injected clock**

Cover: no trigger at 499ms, one trigger at 500ms, movement beyond 12px cancels, pointer up/cancel cancels, scroll cancels, wrong target does not start, and a second pointer cannot steal the active gesture.

```ts
const clock = createFakeClock()
const fired: unknown[] = []
const gesture = createTodoLongPressGesture({
  onLongPress: (target) => fired.push(target),
  setTimer: clock.setTimer,
  clearTimer: clock.clearTimer,
})
gesture.start({ pointerId: 1, target: body, x: 10, y: 10 })
clock.advance(499)
assert.equal(fired.length, 0)
clock.advance(1)
assert.deepEqual(fired, [body])
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/web-longpress.test.ts`

Expected: module-not-found failure for `web/todo-longpress.js`.

- [ ] **Step 3: Implement controller and DOM installer**

Export `createTodoLongPressGesture` with injected timer functions and `installTodoLongPress(root)`. The installer uses delegated capture listeners on the Lynx shadow root, finds `.todo-body` through `event.composedPath()`, starts only primary-button gestures, cancels on pointer move/up/cancel/lost capture, root scroll, document visibility change, and window blur, and dispatches:

```js
target.dispatchEvent(new CustomEvent('longpress', {
  bubbles: true,
  composed: true,
  detail: { clientX: x, clientY: y },
}))
```

Guard the root against duplicate installation. Suppress `contextmenu` only when the composed path contains `.todo-body`.

- [ ] **Step 4: Install and publish the module**

Convert the Web enhancement script to `type="module"`, import `installTodoLongPress` from `./todo-longpress.js`, and call it as soon as the shadow root exists, before the CSS-injection early return. Update `scripts/assemble-web.mjs` to copy the module beside `dist/index.html`.

- [ ] **Step 5: Run controller, source, and assembled-build verification**

Run:

```bash
node --test tests/web-longpress.test.ts tests/web-regressions.test.ts
npm run build:web
test -s dist/todo-longpress.js
```

Expected: fake-clock behavior passes and the assembled static Web app contains the module.

- [ ] **Step 6: Commit Web gesture parity**

```bash
git add web/todo-longpress.js web/index.html scripts/assemble-web.mjs tests/web-longpress.test.ts tests/web-regressions.test.ts
git commit -m "feat: synthesize todo long press on web"
```

### Task 7: Cross-platform acceptance and publication

**Files:**
- Modify as needed from verified defects only.
- Add verification screenshots to `docs/verification/port/` only if they are stable and useful; keep transient video/logs under `/tmp`.

- [ ] **Step 1: Run the complete static gate fresh**

```bash
git diff --check
node --test tests/*.test.ts
npx tsc -b
npm run build:web
test -s dist/main.lynx.bundle
test -s dist/main.web.bundle
test -s dist/todo-longpress.js
```

Expected: zero failures, clean diff, and all deliverables present.

- [ ] **Step 2: Verify Web at phone and desktop widths**

Serve `dist/`, clear `localStorage.busyWeek`, and test at 390×844 and 1024×844. Use short CJK, long CJK, spaced and unbroken Latin, emoji, and four explicit lines. Confirm full text, no overlap, width reflow, 550ms long press, prefilled edit composer/date, save/cancel, cross-date move preserving completion, checkbox/delete isolation, and smooth survivor/day displacement.

- [ ] **Step 3: Verify iOS Simulator**

Start `npm run dev`, open the printed `main.lynx.bundle?fullscreen=true` through Lynx DevTool client `localhost:8903` on iPhone 17 Pro simulator `EABC0BC7-12FE-4940-969C-FF3D6B9135F5`, and repeat the text/edit/date/cancel corpus. Confirm a drag before 500ms scrolls without opening edit. Measure shortcut→picker and picker→keyboard clearances as `14±2px`. Inspect Todo/day box models for four-plus lines and capture console warnings/errors.

- [ ] **Step 4: Fix any discovered defect with a new RED/GREEN cycle**

For each defect, first add the smallest failing unit or source regression, run it RED, implement the fix, then rerun it GREEN and repeat the full static gate.

- [ ] **Step 5: Review final diff against every specification requirement**

Check composer spacing, uncapped lines, Native long press, Web long press, text/date editing, draft cancellation, identity/completion preservation, variable-height animation, Native/Web scroll, fallback behavior, backend isolation, reduced motion, and removal of dead inline-editor code.

- [ ] **Step 6: Commit final verification fixes, push, and create PR**

```bash
git add -A
git commit -m "fix: polish multiline todo editing" # only when verification produced changes
git push -u origin codex/todo-composer-multiline
gh pr create --base master --head codex/todo-composer-multiline \
  --title "Improve multiline todos and long-press editing" \
  --body-file /tmp/busyweek-pr-body.md
```

Expected: a new ready-for-review PR targeting `master`, with test/build/Web/iOS evidence in the body.
