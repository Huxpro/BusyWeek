# Native Input and Todo Layout Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Remove the native-only todo-list edge gaps and make composer/edit input synchronization reliable in Lynx Explorer on iOS.

**Architecture:** Keep Vue `v-model` as the source of truth for user-generated input events. Add narrowly scoped native element synchronization only where vue-lynx 0.4.0 cannot propagate programmatic model changes, and wait for Vue Lynx's main-thread acknowledgement before querying newly rendered native elements. Collapse Vue's anonymous fragment boundary `<text>` nodes with a zero-height base rule while restoring semantic text through a compiler-supported class selector.

**Tech Stack:** Vue Lynx 0.4.0, Rspeedy, TypeScript, Lynx DevTool, Lynx Explorer on iOS.

---

### Task 1: Collapse native fragment anchors without collapsing visible text

**Files:**
- Modify: `src/base.css`
- Modify: `src/App.vue`
- Modify: `src/components/DayPickerSheet.vue`
- Modify: `src/components/DatePickerSheet.vue`

**Steps:**

1. Preserve the failing native measurement: each anonymous `v-for` boundary `<text>` is 14 px high, producing a 14 px gap before the first row and after the last row.
2. Give every intentional `<text>` element the shared `bw-text` class. Use a simple class selector because Lynx drops the attempted `text[class]` selector.
3. Set anonymous `text` elements to `height: 0px` and restore `.bw-text` to `height: auto`.
4. Rebuild and reload the native page.
5. Verify in Lynx DevTool that both anonymous boundary nodes are 0 px, visible labels retain non-zero layout, and consecutive todo row borders meet exactly.

### Task 2: Make native focus wait for the rendered element

**Files:**
- Modify: `src/App.vue`

**Steps:**

1. Record the current failing one-tap edit behavior when the microtask-scheduled selector query runs before the native input exists.
2. Import Vue Lynx `nextTick` and change the focus directive to await it before issuing the native `focus` UI method.
3. Keep the web `focus()` fallback and the native failure callback.
4. Build and verify that tapping a todo once focuses the newly mounted input and accepts device keyboard input.

### Task 3: Synchronize the reused composer textarea on native

**Files:**
- Modify: `src/App.vue`
- Update: `docs/native-debug-notes.md`

**Steps:**

1. Add temporary `input` logging beside `v-model`, focus the composer after `nextTick`, and verify that physical/native typing emits the expected value and updates the model.
2. Reopen the composer after adding a typed todo and capture the vue-lynx 0.4.0 failure: the model is empty but the reused native textarea can retain its prior UI value.
3. Add a small native UI-method helper that invokes textarea `setValue` after `nextTick`; call it with the reset model value when opening the composer. Keep web behavior unchanged.
4. Remove temporary logging.
5. Verify this sequence: type a non-default todo, add it, reopen the composer, confirm the textarea is empty, type a second todo, and add it.
6. Document the distinction between user-input `v-model` wiring and programmatic native value synchronization, with a reference to vue-lynx PR #203.

### Task 4: Regression verification

**Files:**
- Verify: `src/App.vue`
- Verify: `src/base.css`
- Verify: `src/components/DayPickerSheet.vue`
- Verify: `src/components/DatePickerSheet.vue`

**Steps:**

1. Run TypeScript checking with the repository-local compiler.
2. Run both Lynx and web production builds.
3. Verify the list, add flow, repeat-open reset, one-tap edit, and row geometry in native Lynx Explorer.
4. Retry the connected physical iPhone; if device trust/lock state still prevents automation, report that limitation separately from simulator-backed results.
