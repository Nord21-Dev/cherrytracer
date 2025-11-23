export const useAuth = () => {
    const user = useState<any>('auth-user', () => null)
    const loading = useState('auth-loading', () => false)
    const config = useRuntimeConfig()

    const resolveBaseURL = () => (import.meta.server ? config.apiBase : config.public.apiBase)

    const fetchUser = async () => {
        loading.value = true

        const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}

        try {
            const res = await $fetch<{ authenticated: boolean, user: any }>('/api/auth/me', {
                baseURL: resolveBaseURL(),
                headers
            })

            if (res.authenticated) {
                user.value = res.user
            } else {
                user.value = null
            }
        } catch (error) {
            user.value = null
        } finally {
            loading.value = false
        }
    }

    const login = async (email: string, password: string) => {
        loading.value = true
        try {
            await $fetch('/api/auth/login', {
                method: 'POST',
                body: { email, password },
                baseURL: resolveBaseURL()
            })
            await fetchUser()
            navigateTo('/')
        } catch (error: any) {
            throw error
        } finally {
            loading.value = false
        }
    }

    const logout = async () => {
        try {
            await $fetch('/api/auth/logout', {
                method: 'POST',
                baseURL: resolveBaseURL()
            })
        } finally {
            user.value = null
            navigateTo('/login')
        }
    }

    return {
        user,
        loading,
        fetchUser,
        login,
        logout
    }
}