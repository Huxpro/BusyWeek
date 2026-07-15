# Native Correctness and Responsive Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore repeatable Native composer focus and scrolling, tighten keyboard avoidance, add a quick horizontal day chooser, and finish the requested Web/todo interaction polish without changing BusyWeek's existing visual language.

**Architecture:** Keep the existing Vue Lynx component structure and make compatibility fixes at the element boundary. Every native scroll container will expose both the modern `scroll-orientation` attribute and an explicit boolean legacy `scroll-x`/`scroll-y` attribute, covering host/runtime differences without assuming the DevTool protocol version is the Lynx engine version. Composer focus recovery stays in `App.vue`, while desktop-only sheet placement remains in the Web host's injected media-query stylesheet so Native keeps its bottom-sheet presentation.

**Tech Stack:** Vue 3, Vue Lynx 0.4.0, legacy scroll-direction compatibility, Rspeedy, Node test runner, Lynx for Web.

---

## File map

- Modify `src/App.vue`: composer refocus surface, keyboard-open class, quick-day pills, legacy scroll attributes, todo hit targets, final-row class.
- Modify `src/App.css`: focus-overlay behavior, keyboard spacing, pills, row highlight removal, final-row border.
- Modify `src/components/DayPickerSheet.vue`: legacy vertical scroll compatibility.
- Modify `web/index.html`: left-anchored hidden menu and desktop picker-sheet adaptation.
- Modify `tests/web-regressions.test.ts`: source-level cross-platform regression coverage for all requested behaviors.
- Modify `docs/native-debug-notes.md`: record the legacy scroll-direction compatibility rationale and physical-device acceptance checks.

### Task 1: Lock the regressions down

**Files:**
- Modify: `tests/web-regressions.test.ts`

- [ ] **Step 1: Write failing source-level regression tests**

Add assertions that require:

```ts
assert.match(appSource, /id="timeline-scroll"[^>]*:scroll-y="true"/)
assert.match(dayPickerSource, /id="day-picker-scroll"[^>]*:scroll-y="true"/)
assert.doesNotMatch(appSource, /class="bw-text addpage-ph"/)
assert.match(appSource, /<textarea[\s\S]*placeholder="又有事情忙啦？"/)
assert.match(appCss, /\.addpage-input::placeholder\s*\{/)
assert.match(appSource, /'addpage--keyboard':\s*keyboardHeight\s*>\s*0/)
assert.match(appCss, /\.addpage--keyboard\s+\.addpage-bottom\s*\{[^}]*padding-bottom:\s*8px/s)
assert.match(appSource, /class="quick-days"[^>]*scroll-orientation="horizontal"[^>]*scroll-x/)
assert.match(appSource, /@tap="pickQuickDay\(offset\)"/)
assert.match(appSource, /class="todo-body"[^>]*@tap="startEdit\(todo\)"/)
assert.doesNotMatch(appCss, /\.todo:active/)
assert.match(appSource, /'todo--last':\s*todoIndex\s*===\s*day\.todos\.length\s*-\s*1/)
assert.match(appCss, /\.todo--last\s*\{[^}]*border-bottom-width:\s*0/s)
assert.match(webHost, /\.ovf\s*\{[^}]*left:\s*12px[^}]*right:\s*auto/s)
assert.match(webHost, /\.sheet-panel:not\(\[l-e-name\]\)\s*\{[^}]*width:\s*500px[^}]*align-self:\s*flex-end[^}]*margin-right:\s*86px[^}]*margin-bottom:\s*63px/s)
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test --experimental-strip-types tests/web-regressions.test.ts`

Expected: new assertions fail because the compatibility attributes, focus surface, quick pills, todo last-row treatment, left menu, and desktop sheet rules are absent.

### Task 2: Fix Native scroll and composer keyboard behavior

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.css`
- Modify: `src/components/DayPickerSheet.vue`
- Modify: `docs/native-debug-notes.md`

- [ ] **Step 1: Add backward-compatible scroll declarations**

Use both generations of the Lynx API with a real boolean value and stable inspection IDs:

```vue
<scroll-view id="timeline-scroll" class="timeline" scroll-orientation="vertical" :scroll-y="true">
<scroll-view id="day-picker-scroll" class="dp-list" scroll-orientation="vertical" :scroll-y="true">
```

`scroll-orientation` replaced the legacy direction flags in Lynx 3.0. Both declarations point in the same direction, while the explicit boolean avoids older Native hosts interpreting a bare attribute as an empty string. The DevTool-reported `sdkVersion` is not treated as proof of the engine version.

- [ ] **Step 2: Make the empty composer surface refocusable**

Remove the absolutely positioned sibling `<text class="addpage-ph">`, which can own Native hit testing after the first blur. Use the textarea's built-in placeholder so taps continue to target the input and native caret behavior remains untouched:

```vue
<textarea
  id="addpage-ta"
  ref="taEl"
  class="addpage-input"
  v-model="newTodoText"
  placeholder="又有事情忙啦？"
/>
```

```css
.addpage-input::placeholder {
  color: rgba(255, 255, 255, 0.68);
}
```

- [ ] **Step 3: Tighten the Native keyboard gap**

Add a state class driven only by the native keyboard event:

```vue
:class="{
  'addpage--open': state === 'INPUT',
  'addpage--keyboard': keyboardHeight > 0,
}"
```

Override the idle safe-area padding while the keyboard is open:

```css
.addpage--keyboard .addpage-bottom { padding-bottom: 8px; }
```

- [ ] **Step 4: Document the device-specific cause and acceptance checks**

Record that SDK 1.4.0 predates `scroll-orientation` and list the checks: scroll the timeline past the first viewport, scroll all eight day-picker rows, blur and retap the empty composer, and verify the controls sit about 8 px above the keyboard.

- [ ] **Step 5: Run the focused tests**

Run: `node --test --experimental-strip-types tests/web-regressions.test.ts`

Expected: the Native scroll/focus/keyboard assertions pass; later-task assertions may still fail.

### Task 3: Add the horizontal quick-day chooser

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.css`

- [ ] **Step 1: Add a fixed set of relative-day choices and action**

```ts
const quickDayOffsets = [0, 1, 2, 3, 4, 5, 6, 7]
const selectedDayOffset = computed(() =>
  getDateDiff(newTodoDate.value, getTodayDate()),
)
function pickQuickDay(offset: number) {
  newTodoDate.value = getDiffDate(offset)
}
```

- [ ] **Step 2: Render direct horizontal scroll children**

Place a `scroll-view` above the existing day/date/add row and retain the existing picker buttons:

```vue
<scroll-view
  class="quick-days"
  scroll-orientation="horizontal"
  :scroll-x="true"
>
  <view
    v-for="offset in quickDayOffsets"
    :key="offset"
    class="quick-day"
    :class="{ 'quick-day--active': selectedDayOffset === offset }"
    @tap="pickQuickDay(offset)"
  >
    <text class="bw-text quick-day-text">{{ getPickerLabel(offset) }}</text>
  </view>
</scroll-view>
```

- [ ] **Step 3: Style compact, fixed-width pills**

Give the scroller a 50 px viewport, each pill a non-shrinking 44 px touch target, and use the existing translucent-white composer palette with a solid-white selected state.

- [ ] **Step 4: Run focused tests**

Run: `node --test --experimental-strip-types tests/web-regressions.test.ts`

Expected: quick-day compatibility and selection assertions pass.

### Task 4: Correct todo interaction boundaries and card edge

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.css`

- [ ] **Step 1: Make only the body start editing**

Change the row loop to expose `todoIndex`, move `@tap="startEdit(todo)"` from the text node to `.todo-body`, and use `@tap.stop` for checkbox and delete controls.

- [ ] **Step 2: Remove whole-row pressed/editing color**

Delete `.todo:active` and the background declaration from `.todo--editing`. Keep the class only for desktop delete-button visibility.

- [ ] **Step 3: Remove the duplicated final divider**

Apply:

```vue
'todo--last': todoIndex === day.todos.length - 1
```

and:

```css
.todo--last { border-bottom-width: 0; }
```

- [ ] **Step 4: Run focused tests**

Run: `node --test --experimental-strip-types tests/web-regressions.test.ts`

Expected: todo hit-target, highlight, and edge assertions pass.

### Task 5: Finish desktop Web adaptation

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Anchor the hidden menu to the header's left edge**

Set `.ovf` to `left: 12px; right: auto` and `.ovf-menu` to `left: 0; right: auto; transform-origin: top left`.

- [ ] **Step 2: Turn picker bottom sheets into desktop popovers**

Inside the existing `min-width: 640px` injected stylesheet add:

```css
.sheet-panel:not([l-e-name]) {
  width: 500px;
  align-self: flex-end;
  margin-right: 86px;
  margin-bottom: 63px;
  border-radius: 18px;
  padding-bottom: 12px;
  opacity: 0;
  transform: translateY(24px) scale(0.98);
  transform-origin: bottom right;
}
.sheet-root--open:not([l-e-name]) .sheet-panel:not([l-e-name]) {
  opacity: 1;
  transform: translateY(0) scale(1);
}
```

Also convert the day choices to a compact two-column desktop grid with a 208 px list viewport (`.dp-content { display:flex; flex-wrap:wrap }`, `.dp-item { width:50% }`). Keep the calendar in one 500 px panel so seven columns remain comfortably tappable.

- [ ] **Step 3: Run focused tests**

Run: `node --test --experimental-strip-types tests/web-regressions.test.ts`

Expected: all source-level regression tests pass.

### Task 6: Verify, build, inspect, and publish

**Files:**
- No additional production files expected.

- [ ] **Step 1: Run the full automated suite**

Run: `node --test --experimental-strip-types tests/*.test.ts`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Build Native and assembled Web artifacts**

Run: `npm run build && npm run build:web`

Expected: both commands exit 0 with `main.lynx.bundle` and assembled Web output.

- [ ] **Step 3: Verify Web interaction and responsive layout**

At mobile and desktop widths, confirm composer blur/retap, horizontal pills, picker selection, body-only edit targeting, checkbox independence, left menu placement, desktop picker geometry, and timeline scrolling.

- [ ] **Step 4: Verify on the physical iPhone**

Open the locally served `main.lynx.bundle?fullscreen=true` in Lynx Explorer and confirm the four Native checks from Task 2 plus quick-day horizontal scrolling and checkbox/edit separation.

- [ ] **Step 5: Review tracked diff and preserve unrelated files**

Run: `git status --short && git diff --check && git diff --stat`

Expected: only the files listed in this plan are tracked changes; pre-existing `artifacts/` and `docs/superpowers/plans/2026-07-14-native-input-layout-fixes.md` remain untracked and unstaged.

- [ ] **Step 6: Commit and push the deployment branch**

Stage only intended files, commit with `fix: finish native interactions and responsive pickers`, then push `HEAD:claude/vue-lynx-port-mxmd1y`.

Expected: the remote deployment branch advances and the updated preview build starts.
