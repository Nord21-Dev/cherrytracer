export const useProject = () => {
  const { selectedProjectId } = useProjectState()
  const toast = useToast()
  const { fetchApi } = useCherryApi()

  // Fetch list of projects available to this admin
  const { data: projects, status, refresh } = useFetch<any[]>('/api/projects', {
    key: 'projects-list',
    default: () => []
  })

  // Computed helper to get the full object
  const selectedProject = computed(() => {
    return projects.value.find((p: any) => p.id === selectedProjectId.value) || null
  })

  // Auto-select first project if none selected
  watch(projects, (newProjects) => {
    if (newProjects && newProjects.length > 0) {
      // If nothing selected, or selected ID doesn't exist anymore
      if (!selectedProjectId.value || !newProjects.find((p:any) => p.id === selectedProjectId.value)) {
        selectedProjectId.value = newProjects[0].id
      }
    } else {
      selectedProjectId.value = null
    }
  }, { immediate: true })

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

  const updateProject = async (id: string, updates: { name?: string, icon?: string }) => {
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