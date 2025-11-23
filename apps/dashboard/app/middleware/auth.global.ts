export default defineNuxtRouteMiddleware(async (to) => {
    const { user, fetchUser } = useAuth()
    const config = useRuntimeConfig()

    const publicRoutes = ['/login', '/setup']

    // 1. Public routes: no need to call the API if we're not logged in
    if (publicRoutes.includes(to.path)) {
        if (!user.value) {
            // Allow /login and /setup for unauthenticated users
            return
        }
        // Logged-in user should not see auth pages
        return navigateTo('/')
    }

    // 2. For all other routes, make sure we have the user state
    if (!user.value) {
        await fetchUser()
    }

    if (user.value) {
        return
    }

    // 3. Not logged in: check if instance is already claimed
    try {
        const baseURL = import.meta.server ? config.apiBase : undefined
        const status = await $fetch<{ claimed: boolean }>('/api/auth/status', { baseURL })

        if (!status.claimed) {
            return navigateTo('/setup')
        }
    } catch {
        // API down or error – fall through to /login
    }

    return navigateTo('/login')
})
