import { defineConfig } from '@lynx-js/rspeedy'
import { fileURLToPath } from 'node:url'

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginVueLynx } from 'vue-lynx/plugin'

export default defineConfig({
  environments: {
    // Native (iOS/Android) bundle.
    lynx: {
      resolve: {
        alias: {
          '@busyweek/text-layout-backend$': fileURLToPath(
            new URL('./src/textLayoutBackend.lynx.ts', import.meta.url),
          ),
        },
      },
    },
    // Lynx Web Platform bundle.
    web: {
      resolve: {
        alias: {
          '@busyweek/text-layout-backend$': fileURLToPath(
            new URL('./src/textLayoutBackend.web.ts', import.meta.url),
          ),
        },
      },
    },
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
