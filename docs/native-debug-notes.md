# Native debugging notes — input (v-model / addTodo / editTodo) + todo-row spacing

Reference dump for on-device debugging. Two open problems that **cannot be
reproduced in the headless web harness** (see "Why I can't verify" below), so
they need a physical Lynx Explorer / device.

Environment: `vue-lynx@0.4.0`, `@lynx-js/web-core` prod runtime, Vue `<script setup>`.

---

## Part A — v-model + addTodo + editTodo

### Current wiring (as of commit `f98dc10`)

**Composer** (`src/App.vue`, add page):
```html
<textarea id="addpage-ta" ref="taEl" class="addpage-input" v-model="newTodoText" />
```
**addTodo**:
```ts
function addTodo() {
  dismissKb()
  const date = newTodoDate.value
  const dayType = getDateDiff(date, getTodayDate())
  const text = newTodoText.value.trim() || '写点啥呀！'   // <-- empty => default
  const tl = timeline.value
  if (!tl[date]) tl[date] = { date, todos: [] }
  tl[date].todos.push({ id: genId(), date, dayType, done: false, text })
  closeInput()
}
```
**Todo row** (display as text, tap → edit input, v-focus focuses it):
```html
<text v-if="editingId !== todo.id" class="todo-text" @tap="startEdit(todo)">{{ todo.text }}</text>
<input v-else
       v-focus="'edit-' + todo.id"
       :id="'edit-' + todo.id"
       class="todo-input"
       v-model="todo.text"
       @blur="finishEdit(day.key, todo)"
       @confirm="finishEdit(day.key, todo)" />
```
```ts
function startEdit(todo) { editingId.value = todo.id }
function finishEdit(dayKey, todo) {
  if (editingId.value !== todo.id) return
  editingId.value = null
  todo.text = todo.text.trim()
  if (!todo.text) removeTodo(dayKey, todo.id)
}
// vFocus: on mount, deferred SelectorQuery focus via the id ATTRIBUTE + fail cb
const vFocus = {
  mounted(el, binding) {
    const id = binding?.value
    const focus = () => {
      el?.focus?.()
      if (typeof lynx === 'undefined' || !id) return
      try {
        lynx.createSelectorQuery().select(`#${id}`)
          .invoke({ method: 'focus', fail: () => {} }).exec()
      } catch {}
    }
    Promise.resolve().then(focus)
  },
}
```

### The back-and-forth (what changed, commit by commit)

| # | Commit | Change | Result |
|---|--------|--------|--------|
| 0 | `8fc3c6f` (baseline) | Composer `v-model`; todo = `<text>` display + `<input v-model>` edit-on-tap | **User: "was good"** |
| 1 | `c63dcee` "Polish" | Todo → **always** `<input v-model="todo.text">` (to get 1-tap edit) | **Regression**: added todo shows empty (native) / default (web) |
| 2 | `1b66e50` | Misdiagnosed v-model as broken; switched composer+todo to `:value` + `@input="x = $event.detail.value"` | Did not fix it (wrong theory) |
| 3 | `e8053b4` | Reverted to baseline structure (`<text>` + edit-input, composer `v-model`); added `v-focus` for 1-tap | Add works again in web harness; v-focus crashed on native |
| 4 | `f98dc10` | `v-focus` used `el.id` = Lynx **internal numeric** id (`#222`) → "no node" → **uncaught INVOKE_ERROR**. Fixed to use the id attribute (binding value) + `fail` cb + deferred | No more crash; 1-tap focus lands in web harness |

### My (corrected) understanding

- **v-model DOES work.** vue-lynx `vModelText` (PR #121) + the created-hook
  ordering fix (PR #136) are present in `0.4.0`
  (`node_modules/vue-lynx/runtime/dist/index.js` has `makeVModelHandler`,
  `injectVModelEvent`, `el._vModelHandler`). It listens for the Lynx `input`
  event and reads `event.detail.value`.
- The regression in step 1 was **rendering every row as an `<input>`**, not the
  binding. Reverting the row to `<text>` display fixed the "added todo shows
  empty/default" symptom in the web harness.

### Why I can't verify on web (important)

- The **web-core PROD runtime ignores *synthetic* keyboard input** (Playwright
  `keyboard.type`). So I can never observe "real typing → v-model updates" in
  the headless harness — the inner `<textarea>` fills with text but the Lynx
  `input`/`lynxinput` event never fires from synthetic keys.
- What I CAN do: **manually dispatch the real `lynxinput` CustomEvent** the
  element would emit:
  ```js
  host.dispatchEvent(new CustomEvent('lynxinput',
    { detail:{ value:'开会讨论' }, bubbles:true, composed:true }))
  ```
  When I do that, `newTodoText` updates and the created todo renders "开会讨论".
  → the **binding is wired correctly**; I just can't drive it with fake keys.
- Also observed in the harness: the composer host never showed an
  `x-enable-...` attribute and synthetic typing produced no `lynxinput`. This
  is *expected* under synthetic input, but it's the thing to confirm on a real
  device — see below.

### What to check on the physical device

1. **Compose capture**: type in the add-page textarea, hit 添加 → does the new
   todo show the typed text (not `写点啥呀！`)? If it shows the default, real
   typing isn't reaching `newTodoText`.
   - If broken: confirm the `x-textarea`/`x-input` `input` event is *enabled*.
     web-core enables it by `addEventListener('lynxinput')` → the element's
     `enableEvent`. On native the analog is the element emitting `bindinput`.
     Quick probe: add `@input="e => console.log('IN', e.detail?.value)"`
     alongside `v-model` (PR #136 allows them to coexist) and watch the log
     while typing.
2. **Edit capture**: tap a todo → edit → change text → blur/confirm. Does
   `finishEdit`'s `todo.text.trim()` see the new text? (Same event path.)
3. **1-tap focus (`v-focus`)**: does one tap open the editor already focused
   with the keyboard up? The SelectorQuery focus is deferred one microtask —
   if it's still too early on native, the `fail` cb keeps it from crashing but
   focus won't land. If so, try: a longer defer (e.g. two microtasks / a
   `lynx` raf), or `selectUniqueID` instead of `select('#id')`.
4. Version sanity: `node_modules/vue-lynx` is `0.4.0`. Confirm it postdates
   PR #136 (merged 2026-04-04) — if the todo/compose value doesn't bind at
   all, a version mismatch is the first thing to rule out.

---

## Part B — todo rows: extra spacing on the FIRST and LAST row (native only)

### Symptom
Inside each day-card, there's extra vertical space **above the first todo**
(between the day-header and row 1) and **below the last todo** (between the
last row and the card's bottom edge). Middle rows are tight. **Web has none of
this** — measured in the harness: `day-header.bottom == todo0.top` (gap 0),
each `.todo` is exactly 52px, and `last-todo.bottom == day-group.bottom`
(gap 0). So it is a **native-only** rendering difference → almost certainly a
CSS property Lynx-native treats differently from Lynx-web.

### What I already tried (didn't fix it, per user)
- `.todo`: `min-height: 52px` + `.todo-body { padding: 13px 0 }`  →  changed to
  fixed `height: 52px` + `.todo-body` centers with no padding. (commit `c63dcee`)

### Current relevant CSS (`src/App.css`)
```css
.day-group {                 /* Lynx view = flex column by default */
  width: 94%; margin-left: 3%; margin-top: 10px;
  background-color: #fff; border-radius: 14px; overflow: hidden;
  box-shadow: 0px 3px 12px rgba(45,60,80,0.08);
  animation: group-in 0.42s cubic-bezier(0.22,1,0.36,1) both;   /* from: translateY(14px) scale(.98) */
}
.day-header { display:flex; flex-direction:row; align-items:center;
  justify-content:space-between; height:42px; border-bottom:1px solid #eef1f4; }
.todo { display:flex; flex-direction:row; align-items:center;
  height:52px; border-bottom:1px solid #f4f6f8;
  animation: todo-in 0.34s cubic-bezier(0.22,1,0.36,1) both;   /* from: translateY(-8px) */
}
.todo-body { flex:1; display:flex; flex-direction:column; justify-content:center; }
```

### Hypotheses to test on device (ranked)
1. **Entrance animations (most likely).** `todo-in` / `group-in` use
   `animation-fill-mode: both` with `transform: translateY(...)`. Transforms
   shouldn't affect layout, but Lynx-native's animation impl may handle the
   `both` fill / initial keyframe differently and leave a layout offset that
   shows only at the container ends.
   **Test: delete the two `animation:` lines** (`todo-in` on `.todo`,
   `group-in` on `.day-group`) and rebuild. If the gaps vanish → it's the
   animations (then reintroduce as opacity-only, no translate).
2. **Column `justify-content` default.** `.day-group` doesn't set it. If native
   defaults the column to something other than `flex-start` when the card is a
   hair taller than its content, extra space lands at top+bottom.
   **Test: add `display:flex; flex-direction:column; justify-content:flex-start;`
   to `.day-group`.**
3. **Row height inflation.** If a `.todo` is taller than 52px on native (e.g.
   `line-height`, `border` box-sizing, the `border-bottom` counted differently),
   `align-items:center` centers content and the surplus shows at the ends.
   **Test: give `.todo` a visible `background` + drop `border-bottom`
   temporarily and measure a single row's box in the Lynx element inspector —
   is it 52 or more? Where is the gap (header padding? row padding? margin?).**
4. `overflow:hidden` + `border-radius` + `box-shadow` on `.day-group` — least
   likely to add *internal* space, but worth toggling off to rule out.

### Suggested order on device
1. Strip the two `animation:` lines → rebuild → check. (fastest, highest-signal)
2. If still there: add explicit `justify-content:flex-start` to `.day-group`.
3. If still there: inspect the first `.todo` box in the Lynx devtool to see
   exactly which box (header / row / body) owns the extra pixels.

---

## Part C — follow-up: repeat focus, keyboard gap, and scrolling

### Empty composer could not be focused again

The composer previously drew its hint as an absolutely positioned sibling:

```html
<text class="addpage-ph">又有事情忙啦？</text>
<textarea id="addpage-ta" />
```

The first focus worked because `openInput()` invoked the native `focus` UI
method. After a blur, however, the empty-state text could own Native hit
testing. Web happened to put `x-textarea` on top, which explains why the same
sequence could not be reproduced there. The hint now uses the textarea's
built-in `placeholder` attribute and `::placeholder` styling, so no sibling can
intercept the second tap and native caret behavior remains intact.

### Composer controls sat too far above the keyboard

`keyboardHeight` already moves the page bottom to the keyboard top. The idle
bottom bar then added another `28px + safe-area-inset-bottom`, producing a
large double gap on iOS. Idle spacing is unchanged, but while the native
`keyboardstatuschanged` event reports an open keyboard, the bottom padding is
overridden to 8px.

### Scroll direction compatibility

The timeline and day picker previously declared only:

```html
scroll-orientation="vertical"
```

They now also pass the legacy direction as a real boolean:

```html
:scroll-y="true"
```

The quick-day strip similarly combines horizontal orientation with
`:scroll-x="true"`. `scroll-orientation` replaced `scroll-x` / `scroll-y` in
Lynx 3.0; keeping both same-direction declarations covers different Explorer
hosts without changing modern behavior. The `sdkVersion` reported by Lynx
DevTool is a protocol/client version and is **not** treated as proof of the
embedded Lynx engine version.

Stable inspection IDs:

- `#timeline-scroll`
- `#day-picker-scroll`
- `#quick-days-scroll`

### Physical-device acceptance

1. Open the composer, blur it through either picker, close the picker, then
   tap the still-empty textarea. The keyboard must return every time.
2. With the keyboard open, the bottom controls should end about 8px above the
   keyboard rather than above an additional safe-area-sized gap.
3. Populate enough todos to exceed one screen. Query `#timeline-scroll` with
   the scroll-view `getScrollInfo` UI method, call `scrollBy({ offset: 120 })`,
   and verify the resulting vertical offset is greater than zero; then confirm
   the same movement with a real finger drag.
4. Open the day picker. Its eight 52px rows exceed the 320px viewport; repeat
   `getScrollInfo` / `scrollBy` on `#day-picker-scroll` and finish with a real
   finger drag to the final option.
5. Horizontally drag `#quick-days-scroll` through all eight pills and select a
   later day. The existing full day and calendar pickers must remain usable.
