// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve } from 'node:path'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: [resolve(__dirname, 'app/assets/css/main.css')],

  devServer: {
    port: 3002
  },

  vite: {
    server: {
      hmr: {
        port: 24680
      }
    }
  }
})
