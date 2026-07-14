import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { loadTimeline, saveTimeline } from '../src/store.ts'

const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const appCss = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
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

test('motion has a reduced-motion fallback', () => {
  assert.match(webHost, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  assert.match(webHost, /\.todo-enter-active[\s\S]*transition-duration:\s*0\.01ms/)
  assert.match(webHost, /\.addpage[^}]*transition-duration:\s*0\.01ms/s)
})
