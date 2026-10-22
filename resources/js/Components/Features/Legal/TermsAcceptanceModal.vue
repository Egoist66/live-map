<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { useTermsAcceptance } from '@/composables/useTermsAcceptance'
import { usePublicReference } from '@/composables/usePublicReference'

const { needsAcceptance, accepting, accept } = useTermsAcceptance()
const { page: offer, loading, load } = usePublicReference('offer')
const agreed = ref(false)
const dismissed = ref(false)
const visible = computed(() => needsAcceptance.value && !dismissed.value)

watch(needsAcceptance, (v) => {
  if (v) {
    agreed.value = false
    void load()
  }
}, { immediate: true })

router.on('navigate', (e: any) => {
  const url = String(e?.detail?.page?.url || '')
  if (!url.startsWith('/offer')) dismissed.value = false
})

/**
 * Уходит на полную оферту и прячет модалку.
 */
function goOffer(): void {
  dismissed.value = true
}

async function confirm(): Promise<void> {
  if (!agreed.value || accepting.value) return
  await accept()
}
</script>

<template>
  <Dialog :visible="visible" modal :closable="false" :draggable="false" :style="{ width: '560px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-zinc-700 dark:!bg-zinc-900 overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-zinc-900' }, content: { class: '!px-5 !pb-4 !pt-3 !max-h-[70dvh] !overflow-y-auto dark:!bg-zinc-900' }, footer: { class: '!px-5 !pb-5 max-sm:!pb-[calc(1.25rem+var(--sab))] !pt-1 !border-0 dark:!bg-zinc-900' } }">
    <template #header>
      <div class="flex items-center gap-3">
        <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white grid place-items-center shrink-0"><i class="pi pi-file-check"></i></span>
        <div class="min-w-0">
          <div class="font-black text-[17px] tracking-tight dark:text-white">Добро пожаловать в ULove!</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">Прочитай и прими публичную оферту</div>
        </div>
      </div>
    </template>
    <div class="rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/60 p-3.5 max-h-[38dvh] overflow-y-auto text-[13px] leading-relaxed text-stone-700 dark:text-zinc-300 whitespace-pre-wrap">{{ loading ? 'Загружаем текст оферты…' : (offer?.body || 'Текст оферты доступен по ссылке ниже.') }}</div>
    <div class="mt-3 space-y-1.5 text-[13px] text-stone-600 dark:text-zinc-300">
      <div class="flex gap-2"><span>📍</span><span>Приложение может запрашивать геолокацию для работы карты. Данные хранятся защищённо, другим видна только размытая позиция.</span></div>
      <div class="flex gap-2"><span>🔞</span><span>Раздел знакомств «Свайпы» — строго 18+. Указывай настоящую дату рождения.</span></div>
    </div>
    <div class="mt-2 text-[13px]"><Link href="/offer" class="font-semibold text-violet-600 dark:text-violet-400 hover:underline" @click="goOffer">Читать полную оферту →</Link></div>
    <template #footer>
      <label class="flex items-start gap-2.5 text-[13px] text-stone-600 dark:text-zinc-300 cursor-pointer select-none">
        <Checkbox v-model="agreed" :binary="true" class="mt-0.5 shrink-0" />
        <span>Я прочитал(а) оферту, мне всё понятно, я согласен(на) с условиями</span>
      </label>
      <Button label="Принимаю →" :disabled="!agreed" :loading="accepting" rounded class="w-full mt-3 !bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !py-3 !font-bold !border-0 disabled:opacity-40" @click="confirm" />
    </template>
  </Dialog>
</template>
