// nuxt.config.ts
const isProd = process.env.NODE_ENV === 'production'

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    modules: ['@nuxt/eslint', '@nuxt/ui', '@vueuse/nuxt', '@nuxt/icon'],
    css: ['~/assets/css/main.css'],

    // Dev only – in Docker you use nginx
    devServer: {
        port: 3001
    },

    // Correct runtimeConfig: server vs client
    runtimeConfig: {
        // Used on the server (SSR, server routes)
        // In Docker, call the API container directly
        apiBase: isProd ? 'http://api:3000' : 'http://localhost:3000',

        public: {
            // Used in the browser
            // In Docker, hit nginx at /api (which proxies to api:3000)
            apiBase: isProd ? '/api' : 'http://localhost:3000/api'
        }
    },

    icon: {
        localApiEndpoint: '/_nuxt_icon'
    },

    ui: {
        theme: {
            defaultVariants: {
                color: 'neutral'
            }
        }
    },

    nitro: {
        // Only proxy /api in local dev – NOT in production
        routeRules: isProd
            ? {}
            : {
                '/api/**': {
                    proxy: 'http://localhost:3000/api/**'
                }
            }
    },

    vite: {
        server: {
            hmr: {
                port: 24679
            }
        }
    }
})
