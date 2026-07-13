/// <reference types="@lynx-js/rspeedy/client" />

/** Build-time flag: `true` in the web bundle, `false` in the native bundle. */
declare const __WEB__: boolean

declare module '@lynx-js/types' {
  interface GlobalProps {
    /**
     * Define your global properties in this interface.
     * These types will be accessible through `lynx.__globalProps`.
     */
  }
}

export {}
