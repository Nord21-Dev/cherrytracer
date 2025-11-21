<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-neutral-950 relative overflow-hidden">
    <!-- Background Glow -->
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/10 blur-[100px] rounded-full pointer-events-none" />

    <div class="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div class="text-center mb-8">
        <div class="text-6xl mb-4 animate-bounce">🍒</div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Let's set up your workspace</h1>
        <p class="text-neutral-400 mt-2 text-lg">Create your first project to get started.</p>
      </div>

      <UCard class="bg-neutral-900/80 backdrop-blur border-neutral-800 shadow-2xl">
        <form @submit.prevent="onSubmit" class="space-y-6">
          
          <!-- Icon Picker -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-neutral-300">Project Icon</label>
            <div class="grid grid-cols-5 gap-2">
              <button 
                v-for="icon in icons" 
                :key="icon"
                type="button"
                @click="form.icon = icon"
                class="h-12 rounded-lg text-xl flex items-center justify-center transition-all border"
                :class="form.icon === icon 
                  ? 'bg-primary-500/20 border-primary-500 text-white scale-110' 
                  : 'bg-neutral-800 border-transparent hover:bg-neutral-700 text-neutral-400'"
              >
                {{ icon }}
              </button>
            </div>
          </div>

          <!-- Name Input -->
          <UFormField label="Project Name" size="lg">
            <UInput 
                v-model="form.name" 
                placeholder="e.g. Acme Production" 
                icon="i-lucide-box" 
                autofocus
                class="text-lg"
            />
          </UFormField>

          <UButton 
            type="submit" 
            block 
            size="xl" 
            :loading="loading"
            :disabled="!form.name"
            color="primary"
            class="font-bold"
          >
            Create Workspace
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { createProject } = useProject()
const loading = ref(false)

const icons = ['🚀', '⚡️', '🔮', '🪐', '💎', '🍒', '🏰', '🐳', '👻', '🤖']

const form = reactive({
  name: '',
  icon: '🚀'
})

const onSubmit = async () => {
  loading.value = true
  try {
    await createProject(form.name, form.icon)
    navigateTo('/')
  } catch (e) {
    // error handled in composable
  } finally {
    loading.value = false
  }
}
</script>