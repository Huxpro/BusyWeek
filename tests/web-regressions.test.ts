import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { loadTimeline, saveTimeline } from '../src/store.ts'

const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const appCss = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
const dayPickerSource = readFileSync(
  new URL('../src/components/DayPickerSheet.vue', import.meta.url),
  'utf8',
)
const datePickerSource = readFileSync(
  new URL('../src/components/DatePickerSheet.vue', import.meta.url),
  'utf8',
)
const dayPickerCss = readFileSync(
  new URL('../src/components/daypicker.css', import.meta.url),
  'utf8',
)
const storeSource = readFileSync(new URL('../src/store.ts', import.meta.url), 'utf8')
const webHost = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8')

test('the assembled web runtime maps Lynx textarea to x-textarea', () => {
  const client = readFileSync(
    new URL(
      '../node_modules/@lynx-js/web-core/dist/client_prod/static/js/client.js',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(client, /textarea\s*:\s*["']x-textarea["']/)
})

test('the web host enables the x-textarea lynxinput bridge before typing', () => {
  assert.match(webHost, /querySelector\(['"]#addpage-ta['"]\)/)
  assert.match(webHost, /addEventListener\(['"]lynxinput['"]/)
})

test('web persistence uses localStorage when the native module is unavailable', async () => {
  const previousNativeModules = globalThis.NativeModules
  const previousLocalStorage = globalThis.localStorage
  const values = new Map<string, string>()

  Object.defineProperty(globalThis, 'NativeModules', {
    configurable: true,
    value: undefined,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key: string) {
        return values.get(key) ?? null
      },
      setItem(key: string, value: string) {
        values.set(key, value)
      },
    },
  })

  try {
    const expected = {
      '2026-07-14': {
        date: '2026-07-14',
        todos: [
          {
            id: 'web-persistence',
            date: '2026-07-14',
            dayType: 0,
            done: false,
            text: 'survives reload',
          },
        ],
      },
    }

    saveTimeline(expected)

    assert.equal(values.get('busyWeek'), JSON.stringify(expected))
    assert.deepEqual(await loadTimeline(), expected)
  } finally {
    Object.defineProperty(globalThis, 'NativeModules', {
      configurable: true,
      value: previousNativeModules,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: previousLocalStorage,
    })
  }
})

test('missing storage is distinct from an explicitly stored empty timeline', async () => {
  const previousNativeModules = globalThis.NativeModules
  const previousLocalStorage = globalThis.localStorage
  const values = new Map<string, string>()

  Object.defineProperty(globalThis, 'NativeModules', {
    configurable: true,
    value: undefined,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key: string) {
        return values.get(key) ?? null
      },
      setItem(key: string, value: string) {
        values.set(key, value)
      },
    },
  })

  try {
    assert.equal(await loadTimeline(), null)

    values.set('busyWeek', '{}')
    assert.deepEqual(await loadTimeline(), {})

    values.set('busyWeek', '{not valid json')
    assert.equal(await loadTimeline(), null)
  } finally {
    Object.defineProperty(globalThis, 'NativeModules', {
      configurable: true,
      value: previousNativeModules,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: previousLocalStorage,
    })
  }
})

test('the web host exposes localStorage through NativeLocalStorageModule', () => {
  assert.match(webHost, /nativeModulesMap/)
  assert.match(webHost, /NativeLocalStorageModule/)
  assert.match(webHost, /onNativeModulesCall/)
  assert.match(webHost, /localStorage\.getItem/)
  assert.match(webHost, /localStorage\.setItem/)
})

test('store reads Lynx lexical NativeModules before global fallbacks', () => {
  assert.match(storeSource, /typeof NativeModules !== 'undefined'/)
  assert.match(storeSource, /\? NativeModules/)
})

test('uses one app-bar show-completed control instead of filter tabs', () => {
  assert.doesNotMatch(appSource, /class="filters"/)
  assert.doesNotMatch(appSource, /activeFilter/)
  assert.match(appSource, /class="completed-toggle"/)
  assert.match(appSource, /showCompleted/)
  assert.match(appSource, /stored \?\? createStarterTimeline\(getTodayDate\(\)\)/)
})

test('completed visibility starts enabled', () => {
  assert.match(appSource, /const showCompleted = ref\(true\)/)
})

test('the hidden Web menu is triggered by the header brand', () => {
  assert.doesNotMatch(webHost, /class="ovf-btn"/)
  assert.doesNotMatch(webHost, /id="ovf-btn"/)
  assert.match(webHost, /querySelector\(['"]\.brand['"]\)/)
  assert.match(webHost, /brand\.addEventListener\(['"]click['"]/)
  assert.match(webHost, /brand\.addEventListener\(['"]keydown['"]/)
})

test('native scroll views use bounded single linear content children', () => {
  assert.match(
    appSource,
    /<scroll-view[^>]*class="timeline"[^>]*>\s*<view class="timeline-content">/s,
  )
  assert.match(appCss, /\.timeline\s*\{[^}]*height:\s*0/s)
  assert.match(
    appCss,
    /\.timeline-content\s*\{[^}]*display:\s*linear[^}]*linear-direction:\s*column/s,
  )
  assert.match(
    dayPickerSource,
    /<scroll-view[^>]*class="dp-list"[^>]*>\s*<view class="dp-content">/s,
  )
  assert.match(
    dayPickerCss,
    /\.dp-content\s*\{[^}]*display:\s*linear[^}]*linear-direction:\s*column/s,
  )
})

test('native scroll views keep explicit legacy direction attributes', () => {
  assert.match(
    appSource,
    /<scroll-view[^>]*id="timeline-scroll"[^>]*class="timeline"[^>]*scroll-orientation="vertical"[^>]*:scroll-y="true"/s,
  )
  assert.match(
    dayPickerSource,
    /<scroll-view[^>]*id="day-picker-scroll"[^>]*class="dp-list"[^>]*scroll-orientation="vertical"[^>]*:scroll-y="true"/s,
  )
})

test('the composer uses the native textarea placeholder and compact keyboard spacing', () => {
  assert.doesNotMatch(appSource, /class="bw-text addpage-ph"/)
  assert.match(
    appSource,
    /<textarea[\s\S]*?id="addpage-ta"[\s\S]*?placeholder="又有事情忙啦？"[\s\S]*?\/>/,
  )
  assert.match(appCss, /\.addpage-input::placeholder\s*\{[^}]*color:/s)
  assert.match(
    webHost,
    /\.addpage-input:not\(\[l-e-name\]\)::part\(textarea\)::placeholder\s*\{[^}]*color:/s,
  )
  assert.match(
    appSource,
    /'addpage--keyboard':\s*keyboardHeight\s*>\s*0/,
  )
  assert.match(
    appCss,
    /\.addpage--keyboard\s+\.addpage-bottom\s*\{[^}]*padding-bottom:\s*8px/s,
  )
  assert.match(
    appCss,
    /\.addpage-bottom\s*\{[^}]*padding-bottom:\s*calc\(28px\s*\+\s*env\(safe-area-inset-bottom\)\)/s,
  )
})

test('the composer consumes its native keyboard event without the vue-lynx global bridge', () => {
  assert.match(
    appSource,
    /<textarea[\s\S]*?id="addpage-ta"[\s\S]*?@keyboard="onComposerKeyboard"[\s\S]*?\/>/,
  )
  assert.match(
    appSource,
    /function onComposerKeyboard\([\s\S]*?keyboardHeight\.value\s*=\s*getElementKeyboardHeight\(event\)/,
  )
})

test('tapping the composer explicitly restores native focus after a picker blur', () => {
  assert.match(
    appSource,
    /<view class="addpage-input-wrap"\s+@tap="focusComposer">/,
  )
})

test('closed picker sheets unmount their native full-screen hit-test layers', () => {
  assert.match(
    dayPickerSource,
    /<view[\s\S]*?v-if="open"[\s\S]*?class="sheet-root"[\s\S]*?:class="\{ 'sheet-root--open': open \}"/,
  )
  assert.match(
    datePickerSource,
    /<view[\s\S]*?v-if="open"[\s\S]*?class="sheet-root"[\s\S]*?:class="\{ 'sheet-root--open': open \}"/,
  )
})

test('the composer keeps its picker and adds a legacy-compatible quick-day scroller', () => {
  assert.match(
    appSource,
    /id="quick-days-scroll"[^>]*class="quick-days"[^>]*scroll-orientation="horizontal"[^>]*:scroll-x="true"/s,
  )
  assert.match(appSource, /@tap="pickQuickDay\(offset\)"/)
  assert.match(appSource, /quickDayOffsets/)
  assert.match(appSource, /selectedDayOffset/)
  assert.match(appSource, /@tap="openDayPicker"/)
  assert.match(appSource, /@tap="openDatePicker"/)
  assert.match(appCss, /\.quick-days\s*\{[^}]*height:\s*50px/s)
  assert.match(
    appCss,
    /\.quick-day\s*\{[^}]*flex-shrink:\s*0[^}]*height:\s*44px/s,
  )
})

test('only the todo body starts editing and the final row has no duplicate divider', () => {
  assert.match(
    appSource,
    /class="checkbox-hit"[\s\S]*?@tap\.stop="checkTodo\(todo\)"/,
  )
  assert.match(
    appSource,
    /class="todo-body"[^>]*@tap="startEdit\(todo\)"/s,
  )
  assert.doesNotMatch(
    appSource,
    /class="bw-text todo-text"[^>]*@tap="startEdit\(todo\)"/s,
  )
  assert.match(
    appSource,
    /class="delete"[^>]*@tap\.stop="removeTodo\(day\.key, todo\.id\)"/s,
  )
  assert.doesNotMatch(appCss, /\.todo:active/)
  assert.doesNotMatch(
    appCss,
    /\.todo--editing\s*\{[^}]*background-color:/s,
  )
  assert.match(
    appSource,
    /'todo--last':\s*todoIndex\s*===\s*day\.todos\.length\s*-\s*1/,
  )
  assert.match(
    appCss,
    /\.todo--last\s*\{[^}]*border-bottom-width:\s*0/s,
  )
})

test('todo editing routes both native keyboard events into timeline avoidance', () => {
  assert.match(appSource, /keepTodoEditAboveKeyboard/)
  assert.match(appSource, /const editKeyboardHeight = ref\(0\)/)
  assert.match(
    appSource,
    /<input[\s\S]*?v-else[\s\S]*?@focus="onEditFocus\(todo\.id\)"[\s\S]*?@keyboard="onEditKeyboard\(todo\.id, \$event\)"[\s\S]*?@keyboardheightchange="onEditKeyboard\(todo\.id, \$event\)"[\s\S]*?\/>/,
  )
  assert.match(
    appSource,
    /function onKeyboardStatus\([\s\S]*?editingId\.value[\s\S]*?setEditKeyboardHeight/,
  )
})

test('timeline gains a temporary keyboard spacer with delayed race-safe cleanup', () => {
  assert.match(appSource, /id="app-root"\s+class="app"/)
  assert.match(
    appSource,
    /<view class="timeline-spacer"\s*\/>\s*<view\s+class="edit-keyboard-spacer"\s+:style="editKeyboardSpacerStyle"\s*\/>/s,
  )
  assert.match(
    appSource,
    /const editKeyboardSpacerStyle = computed\([\s\S]*?editKeyboardSpacerHeight\.value/,
  )
  assert.match(appSource, /setTimeout\([\s\S]*?320/)
  assert.match(appSource, /editAvoidanceGeneration/)
  assert.match(
    appCss,
    /\.edit-keyboard-spacer\s*\{[^}]*height:\s*0[^}]*width:\s*100%/s,
  )
})

test('unmount invalidates in-flight edit keyboard avoidance work', () => {
  const start = appSource.indexOf('onUnmounted(() => {')
  const end = appSource.indexOf('\n})', start)
  const unmountBlock = appSource.slice(start, end + 3)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  assert.match(unmountBlock, /editAvoidanceGeneration \+= 1/)
  assert.match(unmountBlock, /editingId\.value = null/)
  assert.match(unmountBlock, /editKeyboardHeight\.value = 0/)
  assert.match(unmountBlock, /editKeyboardSpacerHeight\.value = 0/)
})

test('Clear-style motion gives retained todos and day cards explicit slots', () => {
  assert.match(appSource, /createTimelineMotionLayout/)
  assert.match(appSource, /const motionLayout = computed/)
  assert.match(appSource, /class="day-list"[\s\S]*:style="dayListStyle"/)
  assert.match(appSource, /class="day-slot"[\s\S]*:style="daySlotStyle\(day\.key\)"/)
  assert.match(appSource, /class="day-todos"[\s\S]*:style="dayTodosStyle\(day\.key\)"/)
  assert.match(appSource, /class="todo-slot"[\s\S]*:style="todoSlotStyle\(day\.key, todo\.id\)"/)
  assert.match(appCss, /\.day-list\s*\{[^}]*position:\s*relative[^}]*transition:\s*height/s)
  assert.match(appCss, /\.day-slot\s*\{[^}]*position:\s*absolute[^}]*transition:\s*transform/s)
  assert.match(appCss, /\.todo-slot\s*\{[^}]*position:\s*absolute[^}]*transition:\s*transform/s)
  assert.match(appCss, /\.todo-enter-active\s+\.todo/)
  assert.match(appCss, /\.day-enter-active\s+\.day-group/)
})

test('Clear-style removal keeps the departing layer above movers and avoids empty-state pushdown', () => {
  assert.match(
    appCss,
    /\.todo-leave-active,\s*\.day-leave-active\s*\{[^}]*z-index:\s*2/s,
  )
  assert.match(
    appSource,
    /<\/TransitionGroup>\s*<!--[\s\S]*?-->\s*<view v-if="isEmpty" class="empty">[\s\S]*?<view class="timeline-spacer"/,
  )
})

test('todo insertion and removal are owned by an explicit Vue transition group', () => {
  assert.match(appSource, /<TransitionGroup\b[^>]*name="todo"/s)
  assert.match(appSource, /<TransitionGroup\b[^>]*:duration="\{ enter: 280, leave: 200 \}"/s)
  assert.match(appSource, /class="day-todos"/)
  assert.match(appCss, /\.todo-enter-active/)
  assert.match(appCss, /\.todo-leave-active/)
  assert.match(appCss, /\.todo-enter-from/)
  assert.match(appCss, /\.todo-leave-to/)
})

test('desktop CSS preserves the legacy centered timeline and floating composer', () => {
  assert.match(webHost, /busyweek-web-responsive/)
  assert.match(webHost, /@media[^\{]*\(min-width:\s*640px\)/)
  assert.match(webHost, /\.timeline[^\{]*\{[^}]*width:\s*70%[^}]*margin-left:\s*15%/s)
  assert.match(webHost, /\.addpage[^\{]*\{[^}]*width:\s*500px[^}]*height:\s*60%[^}]*right:\s*86px[^}]*bottom:\s*63px/s)
  assert.match(webHost, /transform:\s*translateY\(100vh\)/)
  assert.match(webHost, /@media[^\{]*\(min-width:\s*1000px\)/)
  assert.match(webHost, /\.timeline[^\{]*\{[^}]*width:\s*57%[^}]*margin-left:\s*21\.5%/s)
})

test('the Web menu opens from the left and desktop pickers become anchored panels', () => {
  assert.match(
    webHost,
    /\.ovf\s*\{[^}]*left:\s*12px[^}]*right:\s*auto/s,
  )
  assert.match(
    webHost,
    /\.ovf-menu\s*\{[^}]*left:\s*0[^}]*right:\s*auto[^}]*transform-origin:\s*top left/s,
  )
  assert.match(
    webHost,
    /\.sheet-panel:not\(\[l-e-name\]\)\s*\{[^}]*width:\s*500px[^}]*align-self:\s*flex-end[^}]*margin-right:\s*86px[^}]*margin-bottom:\s*63px[^}]*border-radius:\s*18px/s,
  )
  assert.match(
    webHost,
    /\.sheet-root--open:not\(\[l-e-name\]\)\s+\.sheet-panel:not\(\[l-e-name\]\)\s*\{[^}]*opacity:\s*1[^}]*translateY\(0\)\s*scale\(1\)/s,
  )
  assert.match(
    webHost,
    /\.dp-list:not\(\[l-e-name\]\)\s*\{[^}]*height:\s*208px/s,
  )
  assert.match(
    webHost,
    /\.dp-content:not\(\[l-e-name\]\)\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/s,
  )
  assert.match(
    webHost,
    /\.dp-item:not\(\[l-e-name\]\)\s*\{[^}]*width:\s*50%/s,
  )
})

test('motion has a reduced-motion fallback', () => {
  assert.match(webHost, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  assert.match(webHost, /\.todo-enter-active[\s\S]*transition-duration:\s*0\.01ms/)
  assert.match(webHost, /\.addpage[^}]*transition-duration:\s*0\.01ms/s)
  assert.match(webHost, /\.completed-toggle-label[^}]*transition-duration:\s*0\.01ms/s)
  assert.match(webHost, /\.completed-toggle-track[^}]*transition-duration:\s*0\.01ms/s)
  assert.match(webHost, /\.completed-toggle-thumb[^}]*transition-duration:\s*0\.01ms/s)
  assert.match(webHost, /\.day-slot[^}]*transition-duration:\s*0\.01ms/s)
  assert.match(webHost, /\.todo-slot[^}]*transition-duration:\s*0\.01ms/s)
  assert.match(webHost, /\.day-list[^}]*transition-duration:\s*0\.01ms/s)
  assert.match(webHost, /\.day-todos[^}]*transition-duration:\s*0\.01ms/s)
  assert.doesNotMatch(webHost, /\.filter-indicator/)
})
