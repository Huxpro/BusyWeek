# Completed Toggle, Starter Todos, and Native Scrolling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace list filters with a show-completed switch, seed only genuinely fresh starts, and make both native scroll views use Lynx-compatible bounded single-child layouts.

**Architecture:** Put deterministic starter-data creation and timeline projection in small pure TypeScript modules so behavior is unit-testable outside the renderer. Change persistence loading to return `null` only when the storage key is absent or invalid. Restructure each `<scroll-view>` around one linear direct child and explicitly bound the main flex scroller.

**Tech Stack:** TypeScript 5.9, Vue Lynx 0.4, Lynx `<scroll-view>`, Node test runner, Rspeedy.

---

## File map

- Create `src/starterTimeline.ts`: construct the three instructional todos for a supplied date.
- Create `src/timelineView.ts`: project stored timeline data according to `showCompleted`.
- Modify `src/store.ts`: preserve the difference between no value and an explicitly stored empty timeline.
- Modify `src/App.vue`: load starter data, replace filters with a toggle, and wrap timeline scroll content.
- Modify `src/App.css`: style the app-bar switch and bound the main scroller/linear wrapper.
- Modify `src/components/DayPickerSheet.vue`: add the single direct child required by Lynx scroll-view.
- Modify `src/components/daypicker.css`: give the day-picker wrapper linear column layout.
- Create `tests/starter-timeline.test.ts`: starter data behavior.
- Create `tests/timeline-view.test.ts`: completed visibility behavior.
- Modify `tests/web-regressions.test.ts`: persistence and structural regressions.

### Task 1: Fresh-start persistence and starter data

**Files:**
- Create: `src/starterTimeline.ts`
- Create: `tests/starter-timeline.test.ts`
- Modify: `src/store.ts`
- Modify: `tests/web-regressions.test.ts`

- [ ] **Step 1: Write failing starter and persistence tests**

```ts
test('creates three pending instructional todos for the supplied date', () => {
  const timeline = createStarterTimeline('2026-07-14')
  const todos = timeline['2026-07-14'].todos
  assert.deepEqual(todos.map((todo) => todo.text), [
    '打开右上角查看已完成',
    '点击文字编辑事项',
    '点击圆圈完成事项',
  ])
  assert.ok(todos.every((todo) => !todo.done && todo.dayType === 0))
})

test('missing storage is distinct from an explicitly stored empty timeline', async () => {
  localValues.delete('busyWeek')
  assert.equal(await loadTimeline(), null)
  localValues.set('busyWeek', '{}')
  assert.deepEqual(await loadTimeline(), {})
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/starter-timeline.test.ts tests/web-regressions.test.ts`

Expected: FAIL because `starterTimeline.ts` does not exist and missing storage still resolves to `{}`.

- [ ] **Step 3: Implement deterministic starter construction and nullable loading**

```ts
export function createStarterTimeline(date: string): Timeline {
  const texts = [
    '打开右上角查看已完成',
    '点击文字编辑事项',
    '点击圆圈完成事项',
  ]
  return {
    [date]: {
      date,
      todos: texts.map((text, index) => ({
        id: `starter-${index + 1}`,
        date,
        dayType: 0,
        done: false,
        text,
      })),
    },
  }
}
```

Change `parse` and `loadTimeline` to return `Timeline | null`, returning `null` for absent/malformed raw data and preserving parsed `{}`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/starter-timeline.test.ts tests/web-regressions.test.ts`

Expected: all focused tests pass.

### Task 2: Show-completed projection and app-bar toggle

**Files:**
- Create: `src/timelineView.ts`
- Create: `tests/timeline-view.test.ts`
- Modify: `src/App.vue`
- Modify: `src/App.css`
- Modify: `tests/web-regressions.test.ts`

- [ ] **Step 1: Write failing projection and structure tests**

```ts
test('hides completed todos until showCompleted is enabled', () => {
  assert.deepEqual(getVisibleDays(timeline, false)[0].todos.map((todo) => todo.id), ['active'])
  assert.deepEqual(getVisibleDays(timeline, true)[0].todos.map((todo) => todo.id), ['active', 'done'])
})

test('uses one app-bar show-completed control instead of filter tabs', () => {
  assert.doesNotMatch(appSource, /class="filters"/)
  assert.match(appSource, /class="completed-toggle"/)
  assert.match(appSource, /showCompleted\.value|showCompleted = !showCompleted/)
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/timeline-view.test.ts tests/web-regressions.test.ts`

Expected: FAIL because the projection module and app-bar toggle do not exist.

- [ ] **Step 3: Implement projection and toggle**

```ts
export function getVisibleDays(timeline: Timeline, showCompleted: boolean): VisibleDay[] {
  return Object.keys(timeline)
    .sort()
    .map((key) => ({
      key,
      todos: timeline[key].todos.filter((todo) => showCompleted || !todo.done),
    }))
    .filter((day) => day.todos.length > 0)
}
```

In `App.vue`, replace `activeFilter` and `filters` with `const showCompleted = ref(false)`, load `stored ?? createStarterTimeline(getTodayDate())`, use `getVisibleDays`, and render a tappable `.completed-toggle` in `.app-bar`. Add a track and thumb whose active classes reflect `showCompleted`. Add a computed empty-state message for the all-completed-hidden case.

In `App.css`, set `.app-bar { justify-content: space-between; }`, group the logo in `.brand`, and add the switch label/track/thumb styles with a 44px minimum touch target and short transform/color transitions. Delete the filter bar styles.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/timeline-view.test.ts tests/web-regressions.test.ts`

Expected: all focused tests pass.

### Task 3: Native-compatible scroll-view children

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.css`
- Modify: `src/components/DayPickerSheet.vue`
- Modify: `src/components/daypicker.css`
- Modify: `tests/web-regressions.test.ts`

- [ ] **Step 1: Write failing structural regression tests**

```ts
test('native scroll views use bounded single linear content children', () => {
  assert.match(appSource, /<scroll-view class="timeline"[^>]*>\s*<view class="timeline-content">/s)
  assert.match(appCss, /\.timeline\s*\{[^}]*height:\s*0/s)
  assert.match(appCss, /\.timeline-content\s*\{[^}]*display:\s*linear[^}]*linear-direction:\s*column/s)
  assert.match(dayPickerSource, /<scroll-view class="dp-list"[^>]*>\s*<view class="dp-content">/s)
  assert.match(dayPickerCss, /\.dp-content\s*\{[^}]*display:\s*linear[^}]*linear-direction:\s*column/s)
})
```

- [ ] **Step 2: Run the structural test and verify RED**

Run: `node --test tests/web-regressions.test.ts`

Expected: FAIL because neither single-child wrapper exists and timeline height is unbounded.

- [ ] **Step 3: Implement the wrapper structure and bounded sizes**

Wrap all direct timeline children in `<view class="timeline-content">`. Wrap all day-picker rows in `<view class="dp-content">`. Add:

```css
.timeline { flex: 1; height: 0; width: 100%; padding-top: 10px; }
.timeline-content { display: linear; linear-direction: column; width: 100%; }
.dp-content { display: linear; linear-direction: column; width: 100%; }
```

Keep `.dp-list { height: 320px; }` and both vertical `scroll-orientation` attributes.

- [ ] **Step 4: Run structural tests and verify GREEN**

Run: `node --test tests/web-regressions.test.ts`

Expected: all structural regressions pass.

### Task 4: Full verification and publication

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full automated verification**

Run: `git diff --check && node --test tests/*.test.ts && npx tsc --noEmit && npm run build:web`

Expected: zero test failures, TypeScript exit 0, and successful Lynx/Web production bundles plus static assembly.

- [ ] **Step 2: Run browser behavior checks**

Serve `dist/`, then verify at mobile and desktop sizes:

- fresh localStorage shows exactly three starter todos and persists them;
- stored `{}` remains empty after reload;
- completing a todo hides it while the switch is off;
- enabling the switch shows pending and completed todos together;
- a long generated timeline scrolls vertically;
- the day selector scroll offset changes after a vertical wheel/drag;
- no page errors occur.

- [ ] **Step 3: Commit and push**

Stage only the planned source, test, and plan files. Preserve unrelated `artifacts/` and the pre-existing untracked plan. Commit with `feat: add completed toggle and starter todos` and push `HEAD` to `origin/claude/vue-lynx-port-mxmd1y` so the branch preview rebuilds.
