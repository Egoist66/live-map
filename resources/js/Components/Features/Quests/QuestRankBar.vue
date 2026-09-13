<script setup lang="ts">
import Card from 'primevue/card'
import ProgressBar from 'primevue/progressbar'

defineProps<{ rating: any }>()
</script>
<template>
  <Card v-if="rating" class="!bg-gradient-to-br !from-violet-600 !via-fuchsia-600 !to-orange-500 !border-0 !rounded-3xl !shadow-soft !text-white" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-3">
        <span class="w-11 h-11 rounded-2xl bg-white/20 grid place-items-center shrink-0"><i :class="[rating.level_icon, 'text-lg']" /></span>
        <div class="min-w-0 flex-1">
          <div class="text-base font-black leading-tight">{{ rating.level_name }} · {{ rating.score }} очков</div>
          <div class="text-xs text-white/80">{{ rating.next?.code ? `До «${rating.next.name}»: ещё ${rating.next.needed} очков` : 'Максимальный ранг — ты легенда' }}</div>
        </div>
      </div>
      <ProgressBar v-if="rating.next?.code" :value="rating.next.percent" :show-value="false" class="!h-2 !mt-3 !bg-white/20" />
      <div class="mt-3 flex flex-wrap gap-1.5">
        <span v-for="r in rating.ranks" :key="r.code" :class="['text-[10px] font-bold px-2 py-1 rounded-full border', r.reached ? 'bg-white text-fuchsia-700 border-white' : 'bg-white/10 text-white/70 border-white/20']">
          {{ r.reached ? '✓ ' : '' }}{{ r.name }} · {{ r.points }}
        </span>
      </div>
    </template>
  </Card>
</template>
