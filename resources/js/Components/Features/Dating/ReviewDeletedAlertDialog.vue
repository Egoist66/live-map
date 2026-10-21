<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useClientReady } from '@/composables/useClientReady'
import { useReviewDeletedAlert } from '@/composables/useReviewDeletedAlert'

const { isClientReady } = useClientReady()
const alert = useReviewDeletedAlert()
</script>
<template>
  <Dialog
    v-if="isClientReady"
    :visible="alert.open.value"
    @update:visible="() => alert.acknowledge()"
    modal
    :draggable="false"
    :closable="true"
    :style="{ width: '420px', maxWidth: '94vw' }"
    :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none overflow-hidden dark:!bg-zinc-900 dark:!border-zinc-700' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-zinc-900 dark:!text-white' }, content: { class: '!px-5 !py-4 dark:!bg-zinc-900' }, footer: { class: '!px-5 !pb-5 !pt-1 !border-0 dark:!bg-zinc-900' } }"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white grid place-items-center shrink-0"><i class="pi pi-star text-lg" /></span>
        <div class="min-w-0">
          <div class="font-black dark:text-white leading-tight">Твой отзыв удалён</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">ULove · модерация</div>
        </div>
      </div>
    </template>

    <div class="rounded-2xl bg-stone-100 dark:bg-zinc-800 px-4 py-3">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-0.5 text-amber-400 shrink-0" aria-hidden="true">
          <i v-for="i in 5" :key="i" :class="['text-[10px]', i <= (alert.alert.value?.rating ?? 0) ? 'pi pi-star-fill' : 'pi pi-star']" />
        </span>
        <Tag v-if="alert.alert.value?.authorName" :value="`автор: ${alert.alert.value.authorName}`" severity="secondary" class="!text-[10px] min-w-0 max-w-full" />
      </div>
      <p v-if="alert.alert.value?.targetName" class="mt-1.5 text-[13px] text-stone-600 dark:text-zinc-300">Оценка профиля: <b class="text-stone-800 dark:text-white">{{ alert.alert.value.targetName }}</b></p>
    </div>

    <p class="mt-3 text-[13px] leading-relaxed text-stone-600 dark:text-zinc-300">Отзыв <b>#{{ alert.alert.value?.reviewId }}</b> удалён модератором. Объяснение:</p>
    <blockquote class="mt-2 rounded-2xl border-l-[3px] border-orange-500 bg-stone-100 dark:bg-zinc-800 px-4 py-3 text-[13px] leading-relaxed text-stone-800 dark:text-zinc-100">
      {{ alert.alert.value?.reason }}
    </blockquote>
    <p class="mt-3 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">Это же объяснение ушло письмом на твою почту. Правила: отзыв — по делу, без мата и травли. Спорное решение — напиши в Настройки → Поддержка.</p>

    <template #footer>
      <Button
        label="Понятно"
        icon="pi pi-check"
        rounded
        class="w-full !font-bold !border-0 !bg-gradient-to-r !from-[#FD267D] !to-[#FF7854] !text-white"
        @click="alert.acknowledge()"
      />
    </template>
  </Dialog>
</template>
