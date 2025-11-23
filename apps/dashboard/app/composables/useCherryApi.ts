import type { NitroFetchOptions } from 'nitropack'

export const useCherryApi = () => {
  const { selectedProjectId } = useProjectState()
  const toast = useToast()
  const { logout } = useAuth()
  const config = useRuntimeConfig()
  
  const headers = useRequestHeaders(['cookie'])

  const fetchApi = async <T>(endpoint: string, opts: NitroFetchOptions<any> & { skipProject?: boolean } = {}) => {
    const params: Record<string, any> = { ...(opts.params || {}) }

    // Auto-inject Project ID if available
    if (selectedProjectId.value && !opts.skipProject) {
      params.project_id = selectedProjectId.value
    }

    const baseURL = import.meta.server ? config.apiBase : config.public.apiBase;

    return await $fetch<T>(endpoint, {
      ...opts,
      
      baseURL,
      
      params,
      
      headers: {
        ...headers, // Pass the 'cookie' header to the API
        ...(opts.headers as any),
      },

      async onResponseError({ response }) {
        // Handle 401 (Unauthorized) globally
        if (response.status === 401) {
          await logout() 
        }
        if (response.status === 403) {
          toast.add({ 
            title: 'Access Denied', 
            description: 'You do not have permission.', 
            color: 'error' 
          })
        }
      }
    })
  }

  return { fetchApi }
}