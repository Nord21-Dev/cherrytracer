<script setup lang="ts">
const { isUpdating } = useMaintenance()
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- 🔮 Billion Dollar Update Overlay -->
    <div v-if="isUpdating" class="fixed inset-0 z-[9999] bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
        <div class="animate-bounce text-6xl mb-6">🍒</div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Upgrading System...</h2>
        <p class="text-gray-500 text-lg">Installing the latest version. This usually takes 30-60 seconds.</p>
        
        <div class="mt-8 w-64 h-1.5 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div class="h-full bg-primary-500 animate-[shimmer_2s_infinite_linear] w-1/2 rounded-full"></div>
        </div>
    </div>
  </UApp>
</template>

<style>
@keyframes shimmer {
  0% { transform: translateX(-150%); }
  100% { transform: translateX(250%); }
}
</style>
