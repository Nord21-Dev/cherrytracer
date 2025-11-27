export default defineNuxtRouteMiddleware(async (to) => {
    const { user } = useAuth()
    
    // Only run checks if we are logged in
    console.log("Onboarding Middleware: User", user.value)
    if (user.value) {
        const { projects, isLoading } = useProject()
        console.log("Onboarding Middleware: ", { projects: projects.value, isLoading: isLoading.value, to: to.path })

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