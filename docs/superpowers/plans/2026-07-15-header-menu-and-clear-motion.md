# Header Menu and Clear-Style Timeline Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show completed todos by default, move the Web overflow menu trigger into the app header, and animate retained todos/day cards into their new positions when content disappears.

**Architecture:** A pure timeline geometry module maps visible data to fixed-height day and todo slots. Vue renders those slots with explicit Y transforms so CSS can interpolate order changes even though Vue Lynx `TransitionGroup` lacks FLIP move support; nested card/row elements keep independent enter/leave motion. The Web host retains the overflow menu content but binds it to the Lynx shadow-root brand instead of a floating button.

**Tech Stack:** Vue Lynx 0.4, TypeScript, Lynx CSS transitions, Node test runner, Rspeedy, Lynx Web Platform.

---

### Task 1: Default completed visibility and hidden Web menu trigger

**Files:**
- Modify: `src/App.vue`
- Modify: `web/index.html`
- Modify: `tests/web-regressions.test.ts`

- [ ] **Step 1: Write failing source-regression assertions**

Assert that `showCompleted` initializes with `true`, `web/index.html` contains no `ovf-btn`, and the menu script queries `.brand` and handles keyboard activation.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern='completed visibility|header brand' tests/web-regressions.test.ts`

Expected: FAIL because the state is `false`, the button is present, and no brand binding exists.

- [ ] **Step 3: Implement the minimal state and host changes**

Change the state to:

```ts
const showCompleted = ref(true)
```

Remove the `.ovf-btn` markup and CSS. Keep `.ovf-menu`, bind `.brand` after the shadow root mounts, and toggle on click, Enter, or Space. Add `role="button"`, `tabindex="0"`, and `aria-label="更多"` to the Web shadow element.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --test-name-pattern='completed visibility|header brand' tests/web-regressions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue web/index.html tests/web-regressions.test.ts
git commit -m "feat: move web menu into header"
```

### Task 2: Deterministic Clear-style timeline geometry

**Files:**
- Create: `src/timelineMotion.ts`
- Create: `tests/timeline-motion.test.ts`

- [ ] **Step 1: Write failing geometry tests**

Use two days with fixed ids. Assert that todo offsets advance by `52`, day offsets include `10 + 42 + rows * 52`, and removing an earlier row changes both the next retained todo and the next day by exactly `52`.

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test tests/timeline-motion.test.ts`

Expected: FAIL with module-not-found for `src/timelineMotion.ts`.

- [ ] **Step 3: Implement the pure layout function**

Export `TODO_ROW_HEIGHT`, `DAY_HEADER_HEIGHT`, `DAY_GAP`, and `createTimelineMotionLayout(days)`. Return `{ height, days }`, where each day record contains `offset`, `todosHeight`, and a todo-id-to-offset map.

- [ ] **Step 4: Run the new test and verify GREEN**

Run: `node --test tests/timeline-motion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/timelineMotion.ts tests/timeline-motion.test.ts
git commit -m "feat: calculate timeline motion slots"
```

### Task 3: Render and animate retained positions

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.css`
- Modify: `web/index.html`
- Modify: `tests/web-regressions.test.ts`

- [ ] **Step 1: Write failing structure and motion assertions**

Assert that the template renders `.day-slot` and `.todo-slot` with layout-derived transforms and container heights. Assert that CSS absolutely positions both slots, transitions their transforms, applies enter/leave transforms to nested `.day-group`/`.todo`, and includes all new selectors in reduced-motion CSS.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern='Clear-style motion|reduced-motion' tests/web-regressions.test.ts`

Expected: FAIL because the slot structure and transitions do not exist.

- [ ] **Step 3: Integrate the layout into the Vue template**

Compute `motionLayout` from `visibleDays`. Give `.day-list` its calculated height, wrap every card in a keyed `.day-slot` with its calculated Y transform, give `.day-todos` its calculated height, and wrap every row in a keyed `.todo-slot` with its calculated Y transform.

- [ ] **Step 4: Add coordinated CSS motion**

Use `position: relative` on `.day-list`/`.day-todos`, absolute slots at `top: 0; left: 0`, and transform transitions around `260–300ms` with `cubic-bezier(0.22, 1, 0.36, 1)`. Move presence styles onto nested elements so slot transforms and exit transforms never overwrite each other. Add reduced-motion selectors for slot transforms and container heights.

- [ ] **Step 5: Run the focused and complete test suites**

Run: `node --test --test-name-pattern='Clear-style motion|reduced-motion' tests/web-regressions.test.ts && node --test tests/*.test.ts`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.vue src/App.css web/index.html tests/web-regressions.test.ts
git commit -m "feat: animate timeline reflow"
```

### Task 4: Build and behavior verification

**Files:**
- Verify only; no planned production edits.

- [ ] **Step 1: Run static and production checks**

Run: `git diff --check && node --test tests/*.test.ts && npx tsc --noEmit && npm run build:web`

Expected: zero failures; both `main.lynx.bundle` and `main.web.bundle` are emitted.

- [ ] **Step 2: Run the assembled Web app**

Serve `dist/`, clear storage, and verify completed todos are visible by default. Verify clicking the brand opens the menu, clicking the switch does not, and no floating overflow button exists.

- [ ] **Step 3: Verify timeline motion**

Load multiple completed and pending todos across two dates. Toggle completed visibility and delete a pending todo. Capture positions across animation frames and confirm retained todo and day-card Y positions interpolate rather than jump.

- [ ] **Step 4: Verify reduced motion**

Emulate `prefers-reduced-motion: reduce` and confirm slot/container transition durations resolve to approximately zero while all state changes still complete.

- [ ] **Step 5: Push the established remote branch and verify deployment**

Push `HEAD` to `origin/claude/vue-lynx-port-mxmd1y`, wait for the Vercel commit status, and confirm `/`, `/main.web.bundle`, and `/main.lynx.bundle` return HTTP 200.
