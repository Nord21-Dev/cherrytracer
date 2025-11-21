export default defineNuxtRouteMiddleware(async (to) => {
    const { user } = useAuth()
    
    // Only run checks if we are logged in
    if (user.value) {
        const { projects, isLoading } = useProject()
        
        // We might need to wait for hydration if projects are empty but loading
        if (isLoading.value) return 

        // If no projects exist, and we aren't already on the onboarding page
        if (projects.value.length === 0 && to.path !== '/onboarding') {
            return navigateTo('/onboarding')
        }

        // If projects exist, and we try to go to onboarding manually, kick back to home
        if (projects.value.length > 0 && to.path === '/onboarding') {
            return navigateTo('/')
        }
    }
})