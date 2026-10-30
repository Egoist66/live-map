<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { usePwaInstallGuide } from '@/composables/usePwaInstallGuide'

const guide = usePwaInstallGuide()

function onVisibleChange(nextVisible: boolean): void {
  if (!nextVisible) {
    guide.closeGuide()
  }
}
</script>

<template>
  <Dialog
    :visible="guide.guideOpen.value"
    modal
    dismissable-mask
    :draggable="false"
    :closable="true"
    :header="guide.title.value"
    :style="{ width: '400px', maxWidth: 'calc(100vw - 2rem)' }"
    @update:visible="onVisibleChange"
  >
    <p class="text-sm text-stone-500 dark:text-zinc-400 -mt-1 mb-3">
      {{ guide.subtitle.value }}
    </p>

    <Message
      v-if="guide.needsSafariRedirect.value"
      severity="warn"
      :closable="false"
      class="mb-3"
    >
      Ты сейчас не в Safari, а кнопка «На экран “Домой”» есть только там. Сначала открой ULove в Safari.
    </Message>

    <div class="space-y-2.5">
      <div
        v-for="(step, stepIndex) in guide.steps.value"
        :key="stepIndex"
        class="flex items-start gap-3 rounded-2xl border border-stone-200/70 dark:border-white/10 bg-stone-50 dark:bg-white/[0.03] px-4 py-3"
      >
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300">
          <i :class="[step.icon, 'text-sm']"></i>
        </span>
        <p class="text-sm min-w-0">
          <span class="mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full bg-ink-900 text-[11px] font-bold text-white dark:bg-white dark:text-[#0F121F] align-middle">
            {{ stepIndex + 1 }}
          </span>
          <span class="font-semibold dark:text-zinc-100">{{ step.title }}</span>
          <span class="block text-xs text-stone-500 dark:text-zinc-400 mt-0.5">{{ step.text }}</span>
        </p>
      </div>
    </div>

    <p v-if="guide.isIos.value" class="mt-3 text-xs text-stone-500 dark:text-zinc-400">
      После добавления запускай ULove с экрана «Домой» — откроется на весь экран без адресной строки, как приложение.
    </p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          v-if="guide.needsSafariRedirect.value"
          :label="guide.copyState.value === 'done' ? 'Ссылка скопирована' : 'Скопировать ссылку'"
          icon="pi pi-link"
          severity="secondary"
          rounded
          @click="guide.copyLink()"
        />
        <Button label="Понятно" rounded class="!border-0 !bg-ink-900 !text-sm !font-bold !text-white dark:!bg-white dark:!text-[#0F121F]" @click="guide.closeGuide()" />
      </div>
    </template>
  </Dialog>
</template>
