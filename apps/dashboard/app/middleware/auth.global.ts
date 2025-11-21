export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth()

  if (!user.value) {
    await fetchUser()
  }

  const publicRoutes = ['/login', '/setup']
  
  if (user.value && publicRoutes.includes(to.path)) {
    return navigateTo('/')
  }

  if (!user.value) {
    if (publicRoutes.includes(to.path)) return

    // Check if system needs setup (claimed?)
    try {
      const status = await $fetch<{ claimed: boolean }>('/api/auth/status')
      if (!status.claimed) {
        return navigateTo('/setup')
      }
    } catch (e) {
      // API down or error?
    }

    return navigateTo('/login')
  }
})
