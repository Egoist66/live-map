<script setup lang="ts">
import { useAppNotifications } from '@/composables/useAppNotifications'
const { toasts, remove, openToast } = useAppNotifications()
</script>
<template>
  <div class="fixed top-[calc(var(--app-header-md)+var(--sat)+0.5rem)] sm:top-4 right-3 sm:right-4 left-3 sm:left-auto z-[9999] sm:w-[380px] flex flex-col gap-3 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        @click="openToast(t)"
        class="pointer-events-auto group cursor-pointer bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.16)] p-3.5 flex gap-3 items-center hover:scale-[1.01] active:scale-[0.99] transition-all"
      >
        <div class="relative shrink-0">
          <img v-if="t.avatar" :src="t.avatar" class="w-11 h-11 rounded-full object-cover border border-stone-200 dark:border-zinc-700 bg-stone-100" :alt="t.title" />
          <span v-else class="w-11 h-11 rounded-full grid place-items-center border border-stone-200 dark:border-zinc-700 text-lg" :class="t.type==='sos' ? 'bg-red-600 text-white' : t.type==='match' ? 'bg-pink-500 text-white' : t.type==='message' ? 'bg-violet-600 text-white' : t.type==='pin' ? 'bg-rose-500 text-white' : t.type==='report' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'"><i :class="[t.icon || 'pi pi-bell', 'text-base']" /></span>
          <span
            v-if="t.avatar"
            class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 shadow text-white text-xs"
            :class="t.type==='message' ? 'bg-violet-600' : t.type==='pin' ? 'bg-rose-500' : t.type==='sos' ? 'bg-red-600' : t.type==='match' ? 'bg-pink-500' : t.type==='report' ? 'bg-red-600' : 'bg-amber-500'"
          >
            <i :class="[t.icon || 'pi pi-bell', 'text-[10px]']" />
          </span>
          <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900 animate-[ping_1.6s_ease-out_infinite] opacity-60"></span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="w-7 h-7 rounded-full bg-violet-50 dark:bg-violet-500/15 grid place-items-center text-violet-600 dark:text-violet-300 shrink-0"><i class="pi pi-bell text-xs animate-[swing_1.2s_ease-in-out_infinite]"></i></span>
            <span class="text-[13px] font-bold text-ink-900 dark:text-white truncate">{{ t.title }}</span>
            <span class="text-[11px] text-stone-400 shrink-0">сейчас</span>
          </div>
          <div class="text-[13px] leading-4 text-stone-600 dark:text-zinc-300 truncate mt-0.5">{{ t.body }}</div>
        </div>
        <button @click.stop="remove(t.id)" class="shrink-0 w-8 h-8 grid place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-400 hover:text-stone-600 transition">
          <i class="pi pi-times text-xs"></i>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
<style scoped>
.toast-enter-active { transition: all 0.42s cubic-bezier(0.22,1,0.36,1); }
.toast-leave-active { transition: all 0.32s ease; }
.toast-enter-from { opacity: 0; transform: translateY(-12px) translateX(18px) scale(0.96); }
.toast-leave-to { opacity: 0; transform: translateX(22px) scale(0.98); }
.toast-move { transition: transform 0.36s ease; }
@keyframes swing { 0%,100%{transform:rotate(0)} 20%{transform:rotate(14deg)} 40%{transform:rotate(-10deg)} 60%{transform:rotate(8deg)} 80%{transform:rotate(-4deg)} }
</style>
