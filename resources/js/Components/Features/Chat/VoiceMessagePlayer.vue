<script setup lang="ts">
import Button from 'primevue/button'
import { useVoicePlayer } from '@/composables/useVoicePlayer'

const props = defineProps<{ src: string | null; duration?: number | null; own?: boolean }>()

const player = useVoicePlayer(props.duration ?? null)
</script>
<template>
  <div class="flex items-center gap-2 min-w-0 w-full max-w-[240px]">
    <audio v-if="src" :src="src" :ref="(el:any)=>{ player.audioRef.value = el }" preload="metadata" class="hidden" />
    <Button
      @click="player.toggle()"
      :icon="player.isPlaying.value ? 'pi pi-pause' : 'pi pi-play'"
      rounded
      :severity="own ? undefined : 'secondary'"
      :class="own ? '!bg-rose-900/10 !border-0 !text-rose-800 hover:!bg-rose-900/20 dark:!bg-white/20 dark:!text-white dark:hover:!bg-white/30' : ''"
      class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden"
      aria-label="Слушать голосовое"
    />
    <div class="flex-1 min-w-0">
      <div
        @click="player.seek($event)"
        class="relative h-1.5 rounded-full cursor-pointer"
        :class="own ? 'bg-rose-900/15 dark:bg-white/25' : 'bg-stone-200 dark:bg-white/20'"
        role="slider"
        aria-label="Прогресс"
      >
        <div
          class="absolute left-0 top-0 h-full rounded-full"
          :class="own ? 'bg-rose-600 dark:bg-white' : 'bg-violet-600'"
          :style="{ width: `${Math.round(player.progress.value * 100)}%` }"
        />
      </div>
      <div class="text-[11px] mt-1 tabular-nums" :class="own ? 'text-rose-800/70 dark:text-pink-100/70' : 'text-stone-400'">
        {{ player.isPlaying.value || player.current.value > 0 ? player.currentLabel.value : player.totalLabel.value }}
      </div>
      <div v-if="player.error.value" class="text-[11px] mt-0.5 text-red-500">{{ player.error.value }}</div>
    </div>
    <i class="pi pi-microphone shrink-0 text-sm" :class="own ? 'text-rose-800/60 dark:text-white/70' : 'text-stone-400'"></i>
  </div>
</template>
