<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
    <UCard class="w-full max-w-md bg-neutral-900 border-neutral-800 shadow-2xl shadow-primary-900/10">
      <template #header>
        <div class="text-center space-y-2">
            <span class="text-4xl">🍒</span>
            <h1 class="text-xl font-bold">Welcome to Cherrytracer</h1>
            <p class="text-neutral-400 text-sm">Create your admin account to claim this instance.</p>
        </div>
      </template>

      <form @submit.prevent="onSubmit" class="space-y-4">
        <UFormField label="Admin Email">
          <UInput v-model="email" type="email" icon="i-lucide-mail" required />
        </UFormField>
        <UFormField label="Password">
          <UInput v-model="password" type="password" icon="i-lucide-lock" required />
        </UFormField>
        
        <UButton type="submit" block :loading="loading" size="lg">
          Create Owner Account
        </UButton>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { fetchUser } = useAuth()
const config = useRuntimeConfig() 
const email = ref('')
const password = ref('')
const loading = ref(false)

const onSubmit = async () => {
  loading.value = true
  try {
    await $fetch('/api/auth/setup', {
      method: 'POST',
      body: { email: email.value, password: password.value },
      baseURL: config.public.apiBase,
    })
    // Refresh auth state to log in immediately
    await fetchUser()
    navigateTo('/')
  } catch (e) {
    alert('Setup failed. System might already be claimed.')
  } finally {
    loading.value = false
  }
}
</script>
