export const useMaintenance = () => {
    const isUpdating = useState('is-updating', () => false)
    const toast = useToast()

    const startPolling = () => {
        isUpdating.value = true
        let attempts = 0

        // Poll every 3 seconds
        const interval = setInterval(async () => {
            attempts++
            try {
                // Try to hit a public endpoint (no auth needed is safer for health checks)
                await $fetch('/', { timeout: 2000 })

                // If we get here, server is back!
                clearInterval(interval)
                isUpdating.value = false
                toast.add({ title: 'Update Complete', description: 'Cherrytracer has been updated!', color: 'success', icon: 'i-lucide-party-popper' })

                // Reload to fetch new JS bundles
                setTimeout(() => window.location.reload(), 1000)
            } catch (e) {
                // Still down, keep waiting
                if (attempts > 100) { // ~5 minutes timeout
                    clearInterval(interval)
                    isUpdating.value = false
                    toast.add({ title: 'Timeout', description: 'Server took too long to restart. Refresh manually.', color: 'warning' })
                }
            }
        }, 3000)
    }

    return { isUpdating, startPolling }
}
