// nuxt.config.ts
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    modules: ['@nuxt/eslint', '@nuxt/ui', '@vueuse/nuxt', '@nuxt/icon'],
    css: ['~/assets/css/main.css'],

    // Nur Defaults, echte Werte kommen über Env-Variablen (NUXT_API_BASE, NUXT_PUBLIC_API_BASE)
    runtimeConfig: {
        // server-side only
        apiBase: 'http://localhost:3000',     // wird in Docker von NUXT_API_BASE überschrieben
        public: {
            apiBase: '/api',                    // wird von NUXT_PUBLIC_API_BASE überschrieben
        },
    },

    icon: {
        localApiEndpoint: '/_nuxt_icon',
    },

    ui: {
        theme: {
            defaultVariants: {
                color: 'neutral',
            },
        },
    },

    nitro: {
        // In Produktion KEINE /api-Proxy-Regel – das macht nginx
        routeRules:
            process.env.NODE_ENV === 'development'
                ? {
                    '/api/**': { proxy: 'http://localhost:3000/api/**' },
                }
                : {},
    },
})
