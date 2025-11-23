<template>
    <div class="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-200 flex flex-col md:flex-row"
        :class="{ 'overflow-hidden': mobileMenuOpen }">
        <!-- Mobile Top Bar -->
        <header
            class="md:hidden sticky top-0 z-20 border-b border-gray-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-950/90 backdrop-blur">
            <div class="px-4 py-3 flex items-center justify-between">
                <button class="flex items-center gap-2" type="button" @click="closeMobileMenu"
                    aria-label="Go to dashboard home">
                    <img src="/cherrytracer.png" alt="Cherrytracer Logo" class="w-8 h-8" />
                    <span class="font-bold tracking-tight text-gray-900 dark:text-white">Cherrytracer</span>
                </button>
                <div class="flex items-center gap-2">
                    <UButton icon="i-lucide-sun" color="neutral" variant="ghost" size="xs" @click="toggleTheme"
                        class="dark:hidden" aria-label="Switch to light mode" />
                    <UButton icon="i-lucide-moon" color="neutral" variant="ghost" size="xs" @click="toggleTheme"
                        class="hidden dark:flex" aria-label="Switch to dark mode" />
                    <UButton icon="i-lucide-menu" color="neutral" variant="ghost" size="sm" @click="toggleMobileMenu"
                        :aria-expanded="mobileMenuOpen" aria-controls="mobile-nav" />
                </div>
            </div>
        </header>

        <!-- Sidebar -->
        <aside
            class="hidden md:flex w-64 border-r border-gray-200 dark:border-neutral-800 flex-col bg-gray-50/50 dark:bg-neutral-900/50 backdrop-blur-xl md:fixed md:inset-y-0 md:z-10">
            <!-- Brand -->
            <div class="p-4 flex items-center gap-2">
                <img src="/cherrytracer.png" alt="Cherrytracer Logo" class="w-8 h-8" />
                <span class="font-bold tracking-tight text-gray-900 dark:text-white">Cherrytracer</span>
            </div>

            <!-- Project Switcher -->
            <ClientOnly>
                <ProjectSwitcher />
            </ClientOnly>

            <!-- Nav -->
            <nav class="flex-1 px-2 mt-2">
                <UNavigationMenu orientation="vertical" :items="navigationItems">
                </UNavigationMenu>
            </nav>

            <ClientOnly>
                <NewVersionWidget />
            </ClientOnly>

            <ClientOnly>
                <StorageWidget />
            </ClientOnly>

            <!-- User Footer -->
            <div class="flex items-center p-4 border-t border-gray-200 dark:border-neutral-800">
                <div class="flex gap-2 px-2">
                    <UButton icon="i-lucide-sun" color="neutral" variant="ghost" size="xs" @click="toggleTheme"
                        class="dark:hidden flex-1" />
                    <UButton icon="i-lucide-moon" color="neutral" variant="ghost" size="xs" @click="toggleTheme"
                        class="hidden dark:flex flex-1" />
                </div>
                <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" block size="xs" @click="logout">
                    Sign Out
                </UButton>
            </div>
        </aside>

        <!-- Mobile Fullscreen Menu -->
        <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
            <div v-if="mobileMenuOpen" id="mobile-nav"
                class="md:hidden fixed inset-0 z-30 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl flex flex-col">
                <div
                    class="px-4 py-4 flex items-center justify-between border-b border-gray-200 dark:border-neutral-800">
                    <div class="flex items-center gap-2">
                        <img src="/cherrytracer.png" alt="Cherrytracer Logo" class="w-8 h-8" />
                        <span
                            class="font-bold tracking-tight text-gray-900 dark:text-white">Cherrytracer</span>
                    </div>
                    <UButton icon="i-lucide-x" color="neutral" variant="ghost" aria-label="Close menu"
                        @click="closeMobileMenu" />
                </div>

                <div class="flex-1 overflow-y-auto px-4 py-6 space-y-6">
                    <ClientOnly>
                        <ProjectSwitcher />
                    </ClientOnly>

                    <nav>
                        <UNavigationMenu orientation="vertical" :items="navigationItems">
                        </UNavigationMenu>
                    </nav>
                </div>

                <ClientOnly>
                    <NewVersionWidget />
                </ClientOnly>

                <ClientOnly>
                    <StorageWidget />
                </ClientOnly>

                <div class="px-4 py-4 border-t border-gray-200 dark:border-neutral-800 space-y-3">
                    <div class="flex gap-2">
                        <UButton icon="i-lucide-sun" color="neutral" variant="ghost" block size="sm"
                            @click="toggleTheme" class="dark:hidden">
                            Light
                        </UButton>
                        <UButton icon="i-lucide-moon" color="neutral" variant="ghost" block size="sm"
                            @click="toggleTheme" class="hidden dark:flex">
                            Dark
                        </UButton>
                    </div>
                    <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" block size="sm" @click="logout">
                        Sign Out
                    </UButton>
                </div>
            </div>
        </Transition>

        <!-- Main Content -->
        <main class="flex-1 w-full md:ml-64">
            <slot />
        </main>
    </div>
</template>

<script setup lang="ts">
const { logout, user } = useAuth()

const navigationItems = [
    { label: 'Dashboard', icon: 'i-lucide-home', to: '/' },
    { label: 'Logs', icon: 'i-lucide-audio-lines', to: '/logs' },
    { label: 'Traces', icon: 'i-lucide-audio-waveform', to: '/traces' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
]

const toggleTheme = () => {
    const colorMode = useColorMode()
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const mobileMenuOpen = ref(false)
const toggleMobileMenu = () => {
    mobileMenuOpen.value = !mobileMenuOpen.value
}
const closeMobileMenu = () => {
    mobileMenuOpen.value = false
}

const route = useRoute()
watch(
    () => route.fullPath,
    () => {
        mobileMenuOpen.value = false
    }
)

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        mobileMenuOpen.value = false
    }
}

const isClient = import.meta.client
if (isClient) {
    onMounted(() => {
        window.addEventListener('keydown', handleKeydown)
    })

    onBeforeUnmount(() => {
        window.removeEventListener('keydown', handleKeydown)
        document.documentElement.classList.remove('overflow-hidden')
    })

    watch(mobileMenuOpen, (open) => {
        document.documentElement.classList.toggle('overflow-hidden', open)
    })
}
</script>