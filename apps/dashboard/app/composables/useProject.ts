export const useProject = () => {
    const { selectedProjectId } = useProjectState()
    const toast = useToast()
    const { fetchApi } = useCherryApi()
    const config = useRuntimeConfig()
    const { user } = useAuth()

    const baseURL = import.meta.server ? config.apiBase : undefined

    // Fetch list of projects available to this admin
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}

    const { data: projects, status, refresh } = useFetch<any[]>('/api/projects', {
        key: 'projects-list',
        default: () => [],
        baseURL,
        headers: headers as any
    })

    const selectedProject = computed(() => {
        return projects.value.find((p: any) => p.id === selectedProjectId.value) || null
    })

    watch(
        projects,
        (newProjects) => {
            if (newProjects && newProjects.length > 0) {
                // If we have a selected project, verify it still exists
                const currentExists = selectedProjectId.value && newProjects.find((p: any) => p.id === selectedProjectId.value)

                if (!currentExists) {
                    // Try to use the user's last selected project
                    const lastProject = user.value?.lastProjectId && newProjects.find((p: any) => p.id === user.value.lastProjectId)

                    if (lastProject) {
                        selectedProjectId.value = lastProject.id
                    } else {
                        // Fallback to first project
                        selectedProjectId.value = newProjects[0].id
                    }
                }
            } else {
                selectedProjectId.value = null
            }
        },
        { immediate: true }
    )

    // Sync selection to user profile
    watch(selectedProjectId, async (newId) => {
        if (newId && user.value && user.value.lastProjectId !== newId) {
            try {
                await fetchApi('/api/auth/me', {
                    method: 'PATCH',
                    body: { lastProjectId: newId }
                })
                // Update local user state to avoid redundant calls
                user.value.lastProjectId = newId
            } catch (e) {
                // Silent fail
                console.error('Failed to sync project selection', e)
            }
        }
    })

    const createProject = async (name: string, icon: string) => {
        try {
            const res = await fetchApi<{ project: any }>('/api/projects', {
                method: 'POST',
                body: { name, icon },
                skipProject: true // Don't try to inject an ID we don't have yet
            })
            await refresh()
            selectedProjectId.value = res.project.id
            return res.project
        } catch (e) {
            toast.add({ title: 'Error', description: 'Could not create project', color: 'error' })
            throw e
        }
    }

    const updateProject = async (id: string, updates: { name?: string, icon?: string, allowedReferrers?: string[], regenerateServerKey?: boolean, regenerateBrowserKey?: boolean }) => {
        try {
            await fetchApi(`/api/projects/${id}`, {
                method: 'PATCH',
                body: updates
            })
            await refresh()
            toast.add({ title: 'Saved', description: 'Project updated successfully' })
        } catch (e) {
            toast.add({ title: 'Error', description: 'Update failed', color: 'error' })
        }
    }

    return {
        projects,
        selectedProjectId,
        selectedProject,
        isLoading: computed(() => status.value === 'pending'),
        refresh,
        createProject,
        updateProject
    }
}
