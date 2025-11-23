import type { NitroFetchOptions } from 'nitropack'

export const useCherryApi = () => {
    const { selectedProjectId } = useProjectState()
    const toast = useToast()
    const { logout } = useAuth()
    const config = useRuntimeConfig()

    const fetchApi = async <T>(
        endpoint: string,
        opts: NitroFetchOptions<any> & { skipProject?: boolean } = {}
    ) => {
        // strip our custom flag so it doesn't get passed to $fetch
        const { skipProject, ...fetchOptions } = opts as any

        const params: Record<string, any> = { ...(fetchOptions.params || {}) }

        // Auto-inject Project ID if available
        if (selectedProjectId.value && !skipProject) {
            params.project_id = selectedProjectId.value
        }

        // Server: talk directly to API container; Client: no baseURL -> relative /api/...
        const baseURL = import.meta.server ? config.apiBase : undefined
        const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

        return await $fetch<T>(endpoint, {
            ...fetchOptions,

            baseURL,
            params,

            headers: {
                ...(requestHeaders || {}),
                ...(fetchOptions.headers as any),
            },

            async onResponseError({ response }) {
                if (response.status === 401) {
                    await logout()
                }
                if (response.status === 403) {
                    toast.add({
                        title: 'Access Denied',
                        description: 'You do not have permission.',
                        color: 'error',
                    })
                }
            },
        })
    }

    return { fetchApi }
}