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
                <img src="/cherrytracer.png" alt="Cherrytracer Logo"
                    class="w-14 h-14 mx-auto drop-shadow-[0_8px_30px_rgba(0,0,0,0.15)]" />
                <div class="space-y-1">
                    <p class="text-xs font-semibold tracking-[0.3em] uppercase text-primary-500">Welcome back</p>
                    <p class="text-sm text-gray-600 dark:text-neutral-400">Sign in to continue tracing every
                        customer moment.</p>
                </div>
            </div>

            <UCard
                class="w-full border border-white/60 bg-white/90 dark:border-white/10 dark:bg-neutral-900/80 backdrop-blur-xl shadow-[0_30px_80px_-45px_rgba(15,23,42,0.8)] dark:shadow-[0_30px_90px_-45px_rgba(0,0,0,0.9)] transition-all duration-300 hover:-translate-y-0.5">
                <template #header>
                    <div class="text-center space-y-1">
                        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Sign in to Cherrytracer</h1>
                        <p class="text-sm text-gray-500 dark:text-neutral-400">Use your workspace credentials</p>
                    </div>
                </template>

                <form @submit.prevent="onSubmit" class="space-y-5">
                    <UFormField label="Email">
                        <UInput v-model="email" type="email" icon="i-lucide-mail" required autofocus
                            placeholder="you@example.com"
                            class="w-full rounded-2xl border border-gray-200/80 bg-white/80 text-gray-900 dark:border-white/10 dark:bg-neutral-900/60 dark:text-white" />
                    </UFormField>
                    <UFormField label="Password">
                        <UInput v-model="password" type="password" icon="i-lucide-lock" required placeholder="••••••••"
                            class="w-full rounded-2xl border border-gray-200/80 bg-white/80 text-gray-900 dark:border-white/10 dark:bg-neutral-900/60 dark:text-white" />
                    </UFormField>

                    <UButton type="submit" block :loading="loading" color="primary" size="lg"
                        class="h-12 text-sm tracking-wide">
                        Login
                    </UButton>

                    <div v-if="error" class="text-red-500 dark:text-red-400 text-xs text-center">
                        {{ error }}
                    </div>
                </form>
            </UCard>

            <div class="text-center text-xs">
                <UModal title="Forgot Password" description="Login to your server through SSH and execute the following command">
                    <span class="text-primary-500 hover:text-primary-400 cursor-pointer">Forgot password?</span>

                    <template #body>
                        <div class="space-y-4">
                            <pre class="bg-gray-100 dark:bg-neutral-800 p-4 rounded text-sm overflow-x-auto">docker exec -ti cherrytracer-api sh -c "bun run reset-password"</pre>
                        </div>
                    </template>
                </UModal>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login, loading } = useAuth()
const email = ref('')
const password = ref('')
const error = ref('')

const onSubmit = async () => {
    error.value = ''
    try {
        await login(email.value, password.value)
    } catch (e: any) {
        error.value = 'Invalid credentials'
    }
}
</script>
