import { defineConfig } from '@lynx-js/rspeedy'

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginVueLynx } from 'vue-lynx/plugin'

export default defineConfig({
  environments: {
    // Native (iOS/Android) — no web <select> / <input type="date">.
    lynx: { source: { define: { __WEB__: false } } },
    // Lynx Web Platform — native HTML form controls are available.
    web: { source: { define: { __WEB__: true } } },
  },
  plugins: [
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`
      },
    }),
    pluginVueLynx({
      optionsApi: false,
      enableCSSInlineVariables: true,
      enableCSSInheritance: true,
    }),
  ],
})
