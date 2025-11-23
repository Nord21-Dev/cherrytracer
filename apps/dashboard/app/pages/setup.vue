<template>
    <section
        class="relative isolate flex min-h-[calc(100vh-4rem)] w-full items-center justify-center overflow-hidden rounded-3xl bg-gray-50/70 dark:bg-neutral-950/70 px-3 py-10 sm:px-6">
        <div class="pointer-events-none absolute inset-0">
            <div
                class="absolute inset-0 blur-3xl opacity-90 transition-all dark:opacity-70 [background:radial-gradient(circle_at_15%_20%,rgba(255,140,200,0.55),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(107,141,255,0.4),transparent_55%),radial-gradient(circle_at_45%_80%,rgba(255,229,140,0.4),transparent_60%)] dark:[background:radial-gradient(circle_at_15%_20%,rgba(255,94,165,0.5),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(92,135,255,0.4),transparent_50%),radial-gradient(circle_at_50%_80%,rgba(255,174,113,0.45),transparent_60%)])">
            </div>
            <div
                class="absolute inset-x-0 top-1/3 h-2/3 opacity-60 dark:opacity-40 bg-[linear-gradient(rgba(148,163,184,0.25)_1px,transparent_0),linear-gradient(90deg,rgba(148,163,184,0.2)_1px,transparent_0)] bg-size-[140px_140px] mask-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.7))] transform-[perspective(1200px)_rotateX(72deg)_translateY(-5%)]">
            </div>
        </div>

        <div class="relative z-10 w-full max-w-md space-y-8 text-gray-900 dark:text-neutral-100">
            <div class="text-center space-y-3">
                <div class="text-6xl mb-4 animate-bounce">🍒</div>
                <div class="space-y-1">
                    <p class="text-xs font-semibold tracking-[0.3em] uppercase text-primary-500">Welcome</p>
                    <p class="text-sm text-gray-600 dark:text-neutral-400">Create your admin account to claim this instance.</p>
                </div>
            </div>

            <UCard
                class="w-full border border-white/60 bg-white/90 dark:border-white/10 dark:bg-neutral-900/80 backdrop-blur-xl shadow-[0_30px_80px_-45px_rgba(15,23,42,0.8)] dark:shadow-[0_30px_90px_-45px_rgba(0,0,0,0.9)] transition-all duration-300 hover:-translate-y-0.5">
                <template #header>
                    <div class="text-center space-y-1">
                        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Welcome to Cherrytracer</h1>
                        <p class="text-sm text-gray-500 dark:text-neutral-400">Setup your admin account</p>
                    </div>
                </template>

                <form @submit.prevent="onSubmit" class="space-y-5">
                    <UFormField label="Admin Email">
                        <UInput v-model="email" type="email" icon="i-lucide-mail" required 
                            class="w-full rounded-2xl border border-gray-200/80 bg-white/80 text-gray-900 dark:border-white/10 dark:bg-neutral-900/60 dark:text-white" />
                    </UFormField>
                    <UFormField label="Password">
                        <UInput v-model="password" type="password" icon="i-lucide-lock" required 
                            class="w-full rounded-2xl border border-gray-200/80 bg-white/80 text-gray-900 dark:border-white/10 dark:bg-neutral-900/60 dark:text-white" />
                    </UFormField>

                    <UButton type="submit" block :loading="loading" size="lg" color="primary"
                        class="h-12 text-sm tracking-wide">
                        Create Owner Account
                    </UButton>
                </form>
            </UCard>
        </div>
    </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { fetchUser } = useAuth()
const email = ref('')
const password = ref('')
const loading = ref(false)

const onSubmit = async () => {
    loading.value = true
    try {
        await $fetch('/api/auth/setup', {
            method: 'POST',
            body: { email: email.value, password: password.value },
        })
        await fetchUser()
        navigateTo('/')
    } catch (e) {
        alert('Setup failed. System might already be claimed.')
    } finally {
        loading.value = false
    }
}
</script>
