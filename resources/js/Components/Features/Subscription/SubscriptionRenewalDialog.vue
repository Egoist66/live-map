<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useSubscriptionRenewal } from '@/composables/useSubscriptionRenewal'

const renewal = useSubscriptionRenewal()
const confirmDecline = ref(false)

onMounted(() => void renewal.check())
</script>
<template>
  <Dialog :visible="renewal.visible.value" modal :closable="false" :draggable="false" header="Подписка заканчивается" :style="{ width: '420px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-white/10 overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-[#0F121F]' }, content: { class: '!px-5 !py-4 dark:!bg-[#0F121F]' }, footer: { class: '!px-5 !pb-5 max-sm:!pb-[calc(1.25rem+var(--sab))] !pt-1 !border-0 dark:!bg-[#0F121F]' } }">
    <div class="flex items-center gap-3">
      <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white grid place-items-center shrink-0"><i class="pi pi-crown" /></span>
      <div class="min-w-0">
        <div class="font-black text-[16px] tracking-tight dark:text-white">{{ renewal.planName.value }} · {{ renewal.status.value?.expired ? 'срок истёк' : `осталось ${renewal.status.value?.days_left} дн.` }}</div>
        <div class="text-xs text-stone-500 dark:text-zinc-400">Тариф {{ renewal.expiryLabel.value ? `до ${renewal.expiryLabel.value}` : 'подходит к концу' }} · {{ renewal.priceLabel.value }}</div>
      </div>
    </div>
    <p class="mt-3 text-sm text-stone-600 dark:text-zinc-300">
      <template v-if="renewal.status.value?.expired">Срок подписки вышел — сейчас действуют лимиты Free. Продли {{ renewal.planName.value }}, чтобы вернуть плюшки, или откажись — останешься на Free.</template>
      <template v-else>Продли сейчас — новый месяц добавится к текущему сроку, оплаченные дни не сгорят. Откажешься — тариф сразу станет Free.</template>
    </p>
    <Message v-if="renewal.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ renewal.error.value }}</Message>
    <template #footer>
      <div class="flex flex-col gap-2">
        <Button :label="`Продлить ${renewal.planName.value} · ${renewal.priceLabel.value}`" icon="pi pi-crown" rounded :loading="renewal.acting.value" class="w-full !bg-gradient-to-br !from-rose-500 !via-pink-500 !to-fuchsia-500 !border-0 !text-white !font-bold" @click="renewal.renew()" />
        <Button
          v-if="!confirmDecline"
          label="Отказаться и перейти на Free"
          severity="secondary"
          rounded
          outlined
          :disabled="renewal.acting.value"
          class="w-full"
          @click="confirmDecline = true"
        />
        <Button
          v-else
          label="Точно отказаться? Станет Free"
          severity="danger"
          rounded
          :loading="renewal.acting.value"
          class="w-full"
          @click="renewal.decline()"
        />
        <Button v-if="!renewal.status.value?.expired" label="Напомнить завтра" link size="small" class="!text-xs" @click="renewal.snooze()" />
      </div>
    </template>
  </Dialog>
</template>
