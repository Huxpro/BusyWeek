import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'

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
const lynxConfigSource = readFileSync(
  new URL('../lynx.config.ts', import.meta.url),
  'utf8',
)
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { dependencies?: Record<string, string> }

function readOptionalSource(relativePath: string): string {
  const sourceUrl = new URL(relativePath, import.meta.url)
  return existsSync(sourceUrl) ? readFileSync(sourceUrl, 'utf8') : ''
}

function getFunctionSource(name: string): string {
  const signature = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`)
  const match = signature.exec(appSource)
  assert.ok(match, `expected App.vue to define ${name}()`)

  const start = match.index
  const bodyStart = appSource.indexOf('{', start)
  assert.notEqual(bodyStart, -1, `expected ${name}() to have a body`)

  let depth = 0
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === '{') depth += 1
    if (appSource[index] !== '}') continue
    depth -= 1
    if (depth === 0) return appSource.slice(start, index + 1)
  }

  assert.fail(`expected ${name}() to have a closing brace`)
}

function getExecutableFunction<T extends (...args: any[]) => any>(
  name: string,
): T {
  const source = transpileModule(getFunctionSource(name), {
    compilerOptions: {
      module: ModuleKind.None,
      target: ScriptTarget.ES2022,
    },
  }).outputText

  return Function(`${source}\nreturn ${name}`)() as T
}

const nativeTextLayoutBackendSource = readOptionalSource(
  '../src/textLayoutBackend.lynx.ts',
)
const webTextLayoutBackendSource = readOptionalSource(
  '../src/textLayoutBackend.web.ts',
)

test('Rspeedy maps the exact text-layout virtual request per environment', () => {
  assert.match(
    lynxConfigSource,
    /import\s*\{\s*fileURLToPath\s*\}\s*from\s*['"]node:url['"]/,
  )
  assert.match(
    lynxConfigSource,
    /lynx:\s*\{[\s\S]*?resolve:\s*\{[\s\S]*?alias:\s*\{[\s\S]*?['"]@busyweek\/text-layout-backend\$['"]:\s*fileURLToPath\(\s*new URL\(\s*['"]\.\/src\/textLayoutBackend\.lynx\.ts['"]\s*,\s*import\.meta\.url\s*,?\s*\)\s*,?\s*\)/,
  )
  assert.match(
    lynxConfigSource,
    /web:\s*\{[\s\S]*?resolve:\s*\{[\s\S]*?alias:\s*\{[\s\S]*?['"]@busyweek\/text-layout-backend\$['"]:\s*fileURLToPath\(\s*new URL\(\s*['"]\.\/src\/textLayoutBackend\.web\.ts['"]\s*,\s*import\.meta\.url\s*,?\s*\)\s*,?\s*\)/,
  )
})

test('both text-layout wrappers expose the stable measurement contract', () => {
  for (const source of [
    nativeTextLayoutBackendSource,
    webTextLayoutBackendSource,
  ]) {
    assert.match(source, /export function measureTodoText\(/)
    assert.match(source, /export function clearTodoTextMeasurementCache\(/)
  }
})

test('text-layout wrappers use their platform-specific Pretext packages', () => {
  assert.match(
    nativeTextLayoutBackendSource,
    /from\s*['"]lynx-pretext['"]/,
  )
  assert.match(
    webTextLayoutBackendSource,
    /from\s*['"]@chenglou\/pretext['"]/,
  )
  assert.match(
    nativeTextLayoutBackendSource,
    /const WHITE_SPACE = ['"]normal['"] as const/,
  )
  assert.match(
    webTextLayoutBackendSource,
    /const WHITE_SPACE = ['"]pre-wrap['"] as const/,
  )
})

test('the Web text-layout wrapper guards Canvas capabilities and package failures', () => {
  assert.match(webTextLayoutBackendSource, /OffscreenCanvas/)
  assert.match(webTextLayoutBackendSource, /Intl[\s\S]*?Segmenter/)
  assert.match(webTextLayoutBackendSource, /catch\s*\{/)
  assert.match(webTextLayoutBackendSource, /catch\s*\{[\s\S]*?return null/)
})

test('text-layout backends use pinned Pretext package versions', () => {
  assert.equal(packageJson.dependencies?.['lynx-pretext'], '0.0.1')
  assert.equal(packageJson.dependencies?.['@chenglou/pretext'], '0.0.8')
})

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
    /\.addpage--keyboard\s+\.addpage-bottom\s*\{[^}]*padding-bottom:\s*14px/s,
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

test('long-pressing only the todo body opens the full editor', () => {
  const todoBodyTag = appSource.match(/<view\s+class="todo-body"[^>]*>/)?.[0]

  assert.ok(todoBodyTag)
  assert.match(
    todoBodyTag,
    /@longpress\.stop="openTodoEditor\(day\.key, todo\)"/,
  )
  assert.doesNotMatch(todoBodyTag, /@tap(?:\.|=|\s)/)
  assert.match(
    appSource,
    /class="checkbox-hit"[\s\S]*?@tap\.stop="checkTodo\(todo\)"/,
  )
  assert.match(
    appSource,
    /class="delete"[^>]*@tap\.stop="removeTodo\(day\.key, todo\.id\)"/s,
  )
  assert.match(
    appSource,
    /<view\s+class="todo-body"[^>]*>[\s\S]*?<text[^>]*class="bw-text todo-text"[^>]*>[\s\S]*?\{\{ todo\.text \}\}[\s\S]*?<\/text>[\s\S]*?<\/view>/,
  )
  assert.doesNotMatch(appSource, /class="todo-input"/)
})

test('todo rows retain their divider and tap-isolation styling', () => {
  assert.doesNotMatch(appCss, /\.todo:active/)
  assert.match(
    appSource,
    /'todo--last':\s*todoIndex\s*===\s*day\.todos\.length\s*-\s*1/,
  )
  assert.match(
    appCss,
    /\.todo--last\s*\{[^}]*border-bottom-width:\s*0/s,
  )
})

test('the full composer owns create and edit drafts and labels', () => {
  assert.match(
    appSource,
    /from ['"]\.\/todoComposer\.js['"]/,
  )
  assert.match(appSource, /\btype ComposerIntent\b/)
  assert.match(appSource, /\bcreateComposerDraft\b/)
  assert.match(appSource, /\bcommitComposerDraft\b/)
  assert.match(
    appSource,
    /const composerIntent = ref<ComposerIntent>\(\{ kind: ['"]create['"] \}\)/,
  )
  assert.match(appSource, /const composerText = ref\(['"]['"]\)/)
  assert.match(
    appSource,
    /const composerDate = ref\(getTodayDate\(\)\)/,
  )
  assert.match(
    appSource,
    /const composerTitle = computed\([\s\S]*?kind === ['"]edit['"]\s*\? ['"]编辑事项['"]\s*:\s*['"]添加事项['"]/,
  )
  assert.match(
    appSource,
    /const composerSubmitLabel = computed\([\s\S]*?kind === ['"]edit['"]\s*\? ['"]保存['"]\s*:\s*['"]添加['"]/,
  )
  assert.match(appSource, /class="bw-text addpage-title">\{\{ composerTitle \}\}/)
  assert.match(
    appSource,
    /class="bw-text addpage-submit-text">\{\{ composerSubmitLabel \}\}/,
  )
  assert.match(appSource, /v-model="composerText"/)
  assert.match(appSource, /v-model="composerDate"/)
})

test('composer drafts are assigned before native setValue and focus', () => {
  const openComposer = getFunctionSource('openComposer')
  const openCreateComposer = getFunctionSource('openCreateComposer')
  const openTodoEditor = getFunctionSource('openTodoEditor')

  assert.match(
    openComposer,
    /createComposerDraft\(timeline\.value, intent, getTodayDate\(\)\)/,
  )
  const intentAssignment = openComposer.indexOf('composerIntent.value = intent')
  const textAssignment = openComposer.indexOf('composerText.value = draft.text')
  const dateAssignment = openComposer.indexOf('composerDate.value = draft.date')
  const stateOpen = openComposer.indexOf("state.value = 'INPUT'")
  const tick = openComposer.indexOf('await nextTick()')
  const setValue = openComposer.indexOf('setComposerValue(composerText.value)')
  const focus = openComposer.indexOf('focusComposer()')

  for (const [label, index] of [
    ['intent assignment', intentAssignment],
    ['text assignment', textAssignment],
    ['date assignment', dateAssignment],
    ['state open', stateOpen],
    ['nextTick', tick],
    ['setValue', setValue],
    ['focus', focus],
  ] as const) {
    assert.notEqual(index, -1, `expected openComposer() ${label}`)
  }
  assert.ok(intentAssignment < textAssignment)
  assert.ok(textAssignment < dateAssignment)
  assert.ok(dateAssignment < stateOpen)
  assert.ok(stateOpen < tick)
  assert.ok(tick < setValue)
  assert.ok(setValue < focus)

  assert.match(
    openCreateComposer,
    /openComposer\(\{ kind: ['"]create['"] \}\)/,
  )
  assert.match(
    openTodoEditor,
    /openComposer\(\{[\s\S]*?kind: ['"]edit['"][\s\S]*?todoId: todo\.id[\s\S]*?sourceDate: dayKey[\s\S]*?\}\)/,
  )
})

test('submitting commits once while cancel and back only discard the draft', () => {
  const submitComposer = getFunctionSource('submitComposer')
  const closeComposer = getFunctionSource('closeComposer')

  assert.equal(
    [...submitComposer.matchAll(/\bcommitComposerDraft\s*\(/g)].length,
    1,
  )
  assert.equal(
    [...submitComposer.matchAll(/\btimeline\.value\s*=/g)].length,
    1,
  )
  assert.match(
    submitComposer,
    /const nextTimeline = commitComposerDraft\([\s\S]*?timeline\.value = nextTimeline/,
  )
  assert.match(submitComposer, /today: getTodayDate\(\)/)
  assert.match(submitComposer, /idFactory: genId/)
  assert.match(submitComposer, /closeComposer\(\)/)
  assert.doesNotMatch(closeComposer, /commitComposerDraft/)
  assert.match(closeComposer, /dismissKb\(\)/)
  assert.match(closeComposer, /dayPickerOpen\.value = false/)
  assert.match(closeComposer, /datePickerOpen\.value = false/)
  assert.match(closeComposer, /state\.value = ['"]LIST['"]/)
  assert.match(
    appSource,
    /class="addpage-back"\s+@tap="closeComposer"/,
  )
  assert.match(
    appSource,
    /function onAddTouchEnd\([\s\S]*?closeComposer\(\)/,
  )
})

test('composer submission rejects re-entry before committing', () => {
  const submitComposer = getFunctionSource('submitComposer')
  const stateGuard = submitComposer.indexOf(
    "if (state.value !== 'INPUT') return",
  )
  const commit = submitComposer.indexOf('commitComposerDraft(')

  assert.notEqual(stateGuard, -1)
  assert.notEqual(commit, -1)
  assert.ok(stateGuard < commit)
})

test('native composer blur absorbs invocation failures', () => {
  const dismissKb = getFunctionSource('dismissKb')

  assert.match(
    dismissKb,
    /\.invoke\(\{\s*method: ['"]blur['"],\s*fail: \(\) => \{\}\s*\}\)/,
  )
})

test('inline edit state and keyboard avoidance are absent', () => {
  assert.doesNotMatch(appSource, /\beditingId\b/)
  assert.doesNotMatch(appSource, /edit-keyboard-spacer/)
  assert.doesNotMatch(appSource, /\beditKeyboard(?:Height|SpacerHeight|CleanupTimer)\b/)
  assert.doesNotMatch(appSource, /\beditAvoidanceGeneration\b/)
  assert.doesNotMatch(appSource, /\b(?:schedule|cancel)EditKeyboardCleanup\b/)
  assert.doesNotMatch(appSource, /\bsetEditKeyboardHeight\b/)
  assert.doesNotMatch(appSource, /\bvFocus\b|v-focus/)
  assert.doesNotMatch(
    appSource,
    /\b(?:startEdit|finishEdit|onEditFocus|onEditKeyboard)\b/,
  )
  assert.doesNotMatch(appSource, /nativeInput|todoKeyboardAvoidance/)
})

test('native keyboard updates remain scoped to the full composer', () => {
  const onKeyboardStatus = getFunctionSource('onKeyboardStatus')

  assert.match(
    onKeyboardStatus,
    /keyboardHeight\.value = status === ['"]on['"] \? height : 0/,
  )
  assert.doesNotMatch(onKeyboardStatus, /editing|Edit/)
  assert.match(
    appSource,
    /<textarea[\s\S]*?id="addpage-ta"[\s\S]*?@keyboard="onComposerKeyboard"[\s\S]*?@keyboardheightchange="onComposerKeyboard"[\s\S]*?\/>/,
  )
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

test('todo heights are predicted through the platform facade and renderer geometry', () => {
  assert.match(
    appSource,
    /import\s*\{[\s\S]*?clearTodoTextMeasurementCache[\s\S]*?measureTodoText[\s\S]*?\}\s*from\s*['"]@busyweek\/text-layout-backend['"]/,
  )
  assert.match(
    appSource,
    /import\s*\{[\s\S]*?rowHeightFromLayoutEvent[\s\S]*?rowHeightFromTextHeight[\s\S]*?\}\s*from\s*['"]\.\/todoTextLayout\.js['"]/,
  )
  assert.match(appSource, /const TODO_WIDTH_FALLBACK = 240/)
  assert.match(
    appSource,
    /const todoTextWidth = ref\(TODO_WIDTH_FALLBACK\)/,
  )
  assert.match(
    appSource,
    /const correctedTodoHeights = ref<Record<string, number>>\(\{\}\)/,
  )
  assert.match(
    appSource,
    /const predictedTodoHeights = computed\([\s\S]*?visibleDays\.value[\s\S]*?measureTodoText\(todo\.text,\s*todoTextWidth\.value\)[\s\S]*?rowHeightFromTextHeight\(\s*measurement\?\.textHeight\s*\?\?\s*0,?\s*\)[\s\S]*?correctedTodoHeights\.value\[todo\.id\]/,
  )
  assert.match(
    appSource,
    /createTimelineMotionLayout\(\s*visibleDays\.value,\s*predictedTodoHeights\.value,?\s*\)/,
  )
  assert.match(
    appSource,
    /onUnmounted\([\s\S]*?clearTodoTextMeasurementCache\(\)/,
  )
})

test('one invisible exact-geometry probe resolves the todo text width', () => {
  assert.equal(
    [...appSource.matchAll(/class="todo-width-probe"/g)].length,
    1,
  )
  assert.match(
    appSource,
    /class="todo-width-probe"[^>]*accessibility-element="false"[^>]*user-interaction-enabled="false"/,
  )
  assert.match(
    appSource,
    /class="todo-width-probe"[\s\S]*?class="checkbox-hit"[\s\S]*?id="todo-width-probe-body"[\s\S]*?class="todo-body"[\s\S]*?@layoutchange="onTodoWidthProbeLayout"[\s\S]*?class="delete"/,
  )
  assert.match(
    appSource,
    /event[\s\S]*?\.detail\?\.width[\s\S]*?\.detail\?\.size\?\.width/,
  )

  const measureTodoWidthProbe = getFunctionSource('measureTodoWidthProbe')
  assert.match(measureTodoWidthProbe, /createSelectorQuery\(\)/)
  assert.match(
    measureTodoWidthProbe,
    /\.select\(['"]#todo-width-probe-body['"]\)/,
  )
  assert.match(
    measureTodoWidthProbe,
    /\.invoke\(\{[\s\S]*?method:\s*['"]boundingClientRect['"][\s\S]*?success:[\s\S]*?fail:\s*\(\)\s*=>\s*\{\}/,
  )
  assert.match(
    appSource,
    /onMounted\(async\s*\(\)\s*=>\s*\{[\s\S]*?await nextTick\(\)[\s\S]*?measureTodoWidthProbe\(\)/,
  )
  assert.match(
    appSource,
    /Math\.abs\(width\s*-\s*todoTextWidth\.value\)\s*<=\s*0\.5/,
  )
  assert.match(
    appSource,
    /todoTextWidth\.value\s*=\s*width[\s\S]*?correctedTodoHeights\.value\s*=\s*\{\}/,
  )
})

test('todo text layout tokens and binding currentness distinguish every renderer generation', () => {
  const createToken = getExecutableFunction<
    (todoId: string, editGeneration: number, widthRevision: number) => string
  >('createTodoTextLayoutToken')
  const isCurrentBinding = getExecutableFunction<
    (
      bindings: Map<string, unknown>,
      todoId: string,
      candidate: unknown,
    ) => boolean
  >('isCurrentTodoTextLayoutBinding')

  const base = createToken('todo-1', 0, 0)
  assert.equal(createToken('todo-1', 0, 0), base)
  assert.notEqual(createToken('todo-2', 0, 0), base)
  assert.notEqual(createToken('todo-1', 1, 0), base)
  assert.notEqual(createToken('todo-1', 0, 1), base)

  const bindings = new Map<string, unknown>()
  const stale = { key: base }
  const current = { key: createToken('todo-1', 1, 0) }
  bindings.set('todo-1', stale)
  assert.equal(isCurrentBinding(bindings, 'todo-1', stale), true)
  bindings.set('todo-1', current)
  assert.equal(isCurrentBinding(bindings, 'todo-1', stale), false)
  assert.equal(isCurrentBinding(bindings, 'todo-1', current), true)
  bindings.delete('todo-1')
  assert.equal(isCurrentBinding(bindings, 'todo-1', current), false)
})

test('renderer layout corrects predictions without stale edit heights or loops', () => {
  assert.match(
    appSource,
    /<text[\s\S]*?class="bw-text todo-text"[\s\S]*?:key="getTodoTextLayoutBinding\(todo\.id\)\.key"[\s\S]*?@layout="getTodoTextLayoutBinding\(todo\.id\)\.onLayout"/,
  )

  const onTodoTextLayout = getFunctionSource('onTodoTextLayout')
  assert.match(
    onTodoTextLayout,
    /rowHeightFromLayoutEvent\(event\)/,
  )
  assert.match(onTodoTextLayout, /if \(height === null\) return/)
  assert.match(
    onTodoTextLayout,
    /Math\.abs\(currentHeight\s*-\s*height\)\s*<=\s*0\.5/,
  )
  assert.match(
    onTodoTextLayout,
    /correctedTodoHeights\.value\s*=\s*\{[\s\S]*?\.\.\.correctedTodoHeights\.value,[\s\S]*?\[todoId\]:\s*height/,
  )

  const submitComposer = getFunctionSource('submitComposer')
  const correctionClear = submitComposer.indexOf(
    'clearCorrectedTodoHeight(composerIntent.value.todoId)',
  )
  const timelineAssignment = submitComposer.indexOf(
    'timeline.value = nextTimeline',
  )
  assert.notEqual(correctionClear, -1)
  assert.notEqual(timelineAssignment, -1)
  assert.ok(correctionClear < timelineAssignment)

  const clearCorrectedTodoHeight = getFunctionSource(
    'clearCorrectedTodoHeight',
  )
  assert.match(clearCorrectedTodoHeight, /delete nextHeights\[todoId\]/)
  assert.match(
    clearCorrectedTodoHeight,
    /correctedTodoHeights\.value\s*=\s*nextHeights/,
  )
})

test('per-Todo bindings remount edits and width changes while rejecting stale renderer events', () => {
  assert.match(
    appSource,
    /const todoTextLayoutRevision = ref\(0\)/,
  )
  assert.match(
    appSource,
    /const todoTextEditGenerations = new Map<string, number>\(\)/,
  )
  assert.match(
    appSource,
    /const todoTextLayoutBindings = new Map<string, TodoTextLayoutBinding>\(\)/,
  )

  const updateTodoTextWidth = getFunctionSource('updateTodoTextWidth')
  const correctionReset = updateTodoTextWidth.indexOf(
    'correctedTodoHeights.value = {}',
  )
  const revisionIncrement = updateTodoTextWidth.indexOf(
    'todoTextLayoutRevision.value += 1',
  )
  assert.notEqual(correctionReset, -1)
  assert.notEqual(revisionIncrement, -1)
  assert.ok(correctionReset < revisionIncrement)
  assert.match(updateTodoTextWidth, /todoTextLayoutBindings\.clear\(\)/)

  const refreshAfterEdit = getFunctionSource(
    'refreshTodoTextLayoutAfterEdit',
  )
  assert.match(
    refreshAfterEdit,
    /todoTextEditGenerations\.get\(todoId\)\s*\?\?\s*0/,
  )
  assert.match(
    refreshAfterEdit,
    /todoTextEditGenerations\.set\(todoId,\s*[^)]*\+\s*1\)/,
  )
  assert.match(refreshAfterEdit, /todoTextLayoutBindings\.delete\(todoId\)/)

  const getBinding = getFunctionSource('getTodoTextLayoutBinding')
  assert.match(
    getBinding,
    /createTodoTextLayoutToken\([\s\S]*?todoId[\s\S]*?todoTextEditGenerations\.get\(todoId\)\s*\?\?\s*0[\s\S]*?todoTextLayoutRevision\.value/,
  )
  assert.match(
    getBinding,
    /if \(currentBinding\?\.key === key\) return currentBinding/,
  )
  assert.match(
    getBinding,
    /isCurrentTodoTextLayoutBinding\(\s*todoTextLayoutBindings,\s*todoId,\s*binding,?\s*\)/,
  )
  assert.match(
    getBinding,
    /if\s*\(\s*!isCurrentTodoTextLayoutBinding[\s\S]*?\) return[\s\S]*?onTodoTextLayout\(todoId, event\)/,
  )

  const submitComposer = getFunctionSource('submitComposer')
  const editRefresh = submitComposer.indexOf(
    'refreshTodoTextLayoutAfterEdit(composerIntent.value.todoId)',
  )
  const correctionClear = submitComposer.indexOf(
    'clearCorrectedTodoHeight(composerIntent.value.todoId)',
  )
  const timelineAssignment = submitComposer.indexOf(
    'timeline.value = nextTimeline',
  )
  assert.notEqual(editRefresh, -1)
  assert.notEqual(correctionClear, -1)
  assert.notEqual(timelineAssignment, -1)
  assert.ok(editRefresh < timelineAssignment)
  assert.ok(correctionClear < timelineAssignment)

  const removeTodo = getFunctionSource('removeTodo')
  const removedBindingInvalidation = removeTodo.indexOf(
    'todoTextLayoutBindings.delete(id)',
  )
  const todoRemoval = removeTodo.indexOf('day.todos = day.todos.filter')
  assert.notEqual(removedBindingInvalidation, -1)
  assert.notEqual(todoRemoval, -1)
  assert.ok(removedBindingInvalidation < todoRemoval)

  assert.match(
    appSource,
    /<text[\s\S]*?class="bw-text todo-text"[\s\S]*?:key="getTodoTextLayoutBinding\(todo\.id\)\.key"[\s\S]*?@layout="getTodoTextLayoutBinding\(todo\.id\)\.onLayout"/,
  )
})

test('variable-height slots and rows retain motion geometry while leaving', () => {
  const todoSlotStyle = getFunctionSource('todoSlotStyle')
  const todoRowStyle = getFunctionSource('todoRowStyle')
  const resolveTodoLayoutHeight = getFunctionSource(
    'resolveTodoLayoutHeight',
  )

  assert.match(todoSlotStyle, /transform:\s*`translateY\(\$\{offset\}px\)`/)
  assert.match(todoSlotStyle, /height:\s*`\$\{height\}px`/)
  assert.match(todoRowStyle, /height:\s*`\$\{height\}px`/)
  assert.match(
    resolveTodoLayoutHeight,
    /motionLayout\.value\.days\[dayKey\]\?\.todoHeights\[todoId\]/,
  )
  assert.match(
    resolveTodoLayoutHeight,
    /lastTodoLayoutHeights\.get\(todoId\)/,
  )
  assert.match(
    appSource,
    /class="todo-slot"[\s\S]*?:style="todoSlotStyle\(day\.key, todo\.id\)"/,
  )
  assert.match(
    appSource,
    /class="todo"[\s\S]*?:style="todoRowStyle\(day\.key, todo\.id\)"/,
  )
})

test('multiline todo CSS is uncapped and the measurement probe is inert', () => {
  const todoSlotRule = appCss.match(/\.todo-slot\s*\{([^}]*)\}/s)?.[1]
  const todoRule = appCss.match(/\.todo\s*\{([^}]*)\}/s)?.[1]
  const checkboxHitRule = appCss.match(/\.checkbox-hit\s*\{([^}]*)\}/s)?.[1]
  const todoBodyRule = appCss.match(/\.todo-body\s*\{([^}]*)\}/s)?.[1]
  const todoTextRule = appCss.match(/\.todo-text\s*\{([^}]*)\}/s)?.[1]
  const probeRule = appCss.match(/\.todo-width-probe\s*\{([^}]*)\}/s)?.[1]

  assert.ok(todoSlotRule)
  assert.ok(todoRule)
  assert.ok(checkboxHitRule)
  assert.ok(todoBodyRule)
  assert.ok(todoTextRule)
  assert.ok(probeRule)
  assert.doesNotMatch(todoSlotRule, /(?:^|;)\s*height:\s*52px/)
  assert.match(todoRule, /min-height:\s*52px/)
  assert.match(todoRule, /height:\s*100%/)
  assert.doesNotMatch(todoRule, /(?:^|[;\n])\s*height:\s*52px/)
  assert.match(checkboxHitRule, /min-height:\s*52px/)
  assert.match(checkboxHitRule, /height:\s*100%/)
  assert.doesNotMatch(checkboxHitRule, /(?:^|[;\n])\s*height:\s*52px/)
  assert.match(todoBodyRule, /padding-top:\s*8px/)
  assert.match(todoBodyRule, /padding-bottom:\s*8px/)
  assert.match(todoTextRule, /width:\s*100%/)
  assert.match(todoTextRule, /flex-shrink:\s*0/)
  assert.match(todoTextRule, /line-height:\s*20px/)
  assert.match(todoTextRule, /white-space:\s*normal/)
  assert.match(todoTextRule, /word-break:\s*break-all/)
  assert.doesNotMatch(
    appCss,
    /white-space:\s*pre-wrap|word-break:\s*break-word/,
  )
  assert.doesNotMatch(todoTextRule, /max-height|max-lines|text-overflow|ellipsis/)
  assert.match(probeRule, /position:\s*absolute/)
  assert.match(probeRule, /width:\s*94%/)
  assert.match(probeRule, /left:\s*3%/)
  assert.match(probeRule, /opacity:\s*0/)
  assert.match(probeRule, /pointer-events:\s*none/)
  assert.match(
    appCss,
    /\.todo-body:active\s+\.todo-text\s*\{[^}]*(?:opacity|color):/s,
  )
  assert.match(
    webHost,
    /\.todo-text:not\(\[l-e-name\]\)\s*\{[\s\S]*?white-space:\s*pre-wrap;[\s\S]*?word-break:\s*break-word;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?\}/,
  )
})

test('obsolete inline-edit selectors are absent from app and Web host CSS', () => {
  for (const source of [appCss, webHost]) {
    assert.doesNotMatch(source, /\.(?:todo-input|todo--editing|edit-keyboard-spacer)\b/)
  }
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
