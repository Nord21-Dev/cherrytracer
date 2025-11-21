export const useProjectState = () => {
  const selectedProjectId = useCookie<string | null>('cherry_selected_project_id', {
    default: () => null,
    watch: true, // Reactively update cookie
    maxAge: 60 * 60 * 24 * 365, // 1 Year
    sameSite: 'lax'
  })

  return {
    selectedProjectId
  }
}