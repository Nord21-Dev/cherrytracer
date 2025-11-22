const normalizeBaseUrl = (url?: string) => {
    if (!url) return undefined
    return url.endsWith('/') ? url.slice(0, -1) : url
}

const API_BASE_URL = normalizeBaseUrl(process.env.NUXT_API_URL) || 'http://localhost:3000'
const PUBLIC_API_BASE_URL = normalizeBaseUrl(process.env.NUXT_PUBLIC_API_BASE_URL) || '/api'

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    modules: ['@nuxt/eslint', '@nuxt/ui', '@vueuse/nuxt', '@nuxt/icon'],
    css: ['~/assets/css/main.css'],

    devServer: {
        port: 3001
    },

    runtimeConfig: {
        apiBase: API_BASE_URL,
        public: {
            apiBase: PUBLIC_API_BASE_URL
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
        // REMOVED: devProxy block (It causes the crash)
        
        routeRules: {
            '/api/**': { 
                proxy: `${API_BASE_URL}/api/**`
            },
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