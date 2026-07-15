# Todo Edit Keyboard Avoidance Implementation Plan

> **For agentic workers:** Execute each task with test-driven development and verify fresh evidence before claiming completion.

**Goal:** Keep a focused Todo edit input visible above the iOS keyboard by scrolling the main timeline, without moving the pinned header or changing Web behavior.

**Architecture:** A pure geometry function calculates keyboard overlap and an absolute target scroll offset. A small SelectorQuery adapter measures the root, timeline, focused input, and current scroll position. `App.vue` owns edit keyboard state, a trailing spacer, event routing, race cancellation, and delayed cleanup.

**Tech Stack:** Vue Lynx 0.4, TypeScript, Lynx SelectorQuery, Node test runner, Rspeedy, iOS Simulator/WDA.

---

### Task 1: Specify keyboard-aware timeline geometry

**Files:**
- Create: `tests/todo-keyboard-avoidance.test.ts`
- Create: `src/todoKeyboardAvoidance.ts`

- [ ] Write tests for a covered bottom input, an already-visible input, a pre-scrolled list, a viewport above the screen bottom, and invalid keyboard heights.
- [ ] Run `node --test tests/todo-keyboard-avoidance.test.ts` and verify RED because the module does not exist.
- [ ] Implement the minimal pure calculation for spacer height, visible bottom, overlap, and absolute target scroll Y.
- [ ] Re-run the focused test and verify GREEN.

### Task 2: Add and test the native SelectorQuery adapter

**Files:**
- Modify: `src/todoKeyboardAvoidance.ts`
- Modify: `tests/todo-keyboard-avoidance.test.ts`

- [ ] Add failing tests that fake SelectorQuery and require three transform-aware screen rect queries, `getScrollInfo`, offset-only smooth `scrollTo`, no scroll for zero overlap, and cancellation before the final mutation.
- [ ] Run the focused test and verify RED.
- [ ] Implement promise-wrapped native invokes with success and fail callbacks and a current-generation guard.
- [ ] Re-run the focused test and verify GREEN.

### Task 3: Integrate edit keyboard state and the dynamic spacer

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.css`
- Modify: `tests/web-regressions.test.ts`

- [ ] Add failing source-regression assertions for edit `keyboard` and `keyboardheightchange` handlers, the dynamic trailing spacer, global-event routing, and delayed cleanup.
- [ ] Run the focused Web regression test and verify RED.
- [ ] Wire both element events, focus reuse, global fallback, generation cancellation, and approximately `320ms` delayed cleanup into the edit flow.
- [ ] Bind the dynamic spacer after the existing timeline spacer and keep it zero-height outside edit keyboard sessions.
- [ ] Run focused and complete tests and verify GREEN.

### Task 4: Static and production verification

**Files:**
- Verify only unless a discovered defect requires a focused fix.

- [ ] Run `git diff --check`.
- [ ] Run `node --test tests/*.test.ts`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build:web` and confirm both native and Web bundles emit.

### Task 5: iOS simulator behavior verification

**Files:**
- Create evidence under `artifacts/keyboard-avoidance/` (not part of the product commit unless intentionally documented).

- [ ] Load the dev bundle in Lynx Explorer on the iPhone 17 Pro simulator.
- [ ] Edit an upper Todo and verify the list does not jump unnecessarily.
- [ ] Edit the final Todo in an eleven-row list and verify its input bottom is at least `16px` above the keyboard top.
- [ ] While the keyboard remains open, manually scroll the timeline and verify it remains responsive.
- [ ] Capture a short recording and before/after screenshots; confirm the header stays fixed.

### Task 6: Publish the follow-up PR

- [ ] Review the complete diff and exclude generated/runtime evidence from the product commit unless useful to reviewers.
- [ ] Commit the implementation and documentation with an intentional message.
- [ ] Push the new branch and open a new PR against `master` with root cause, reference implementation, tests, and simulator evidence.
- [ ] Re-read the remote PR head/diff/checks and audit every requirement before handoff.
