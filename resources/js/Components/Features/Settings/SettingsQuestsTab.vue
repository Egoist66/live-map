<script setup lang="ts">
import { onMounted } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Skeleton from 'primevue/skeleton'
import QuestRankBar from '@/Components/Features/Quests/QuestRankBar.vue'
import QuestCard from '@/Components/Features/Quests/QuestCard.vue'
import QuestPremiumModal from '@/Components/Features/Quests/QuestPremiumModal.vue'
import { useQuests } from '@/composables/useQuests'

const emit = defineEmits<{ (e: 'billing'): void }>()
const q = useQuests()

onMounted(async () => {
  await q.init()
})
</script>
<template>
  <div class="space-y-3">
    <QuestRankBar v-if="q.store.state" :rating="q.store.state.rating" />

    <Card v-if="q.store.loading" class="!bg-white dark:!bg-zinc-900 !rounded-3xl !shadow-soft !border-stone-200 dark:!border-zinc-800" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0 space-y-2' } }">
      <template #content><Skeleton height="3rem" class="!rounded-2xl" /><Skeleton height="3rem" class="!rounded-2xl" /><Skeleton height="3rem" class="!rounded-2xl" /></template>
    </Card>

    <Message v-if="q.store.error" severity="error" :closable="false" class="!rounded-2xl">{{ q.store.error }}</Message>

    <template v-if="q.store.state">
      <Message v-if="q.store.onCooldown" severity="warn" :closable="false" class="!rounded-2xl">
        🎉 PRO активен/недавно получен. Следующие задания — через {{ q.store.state.cooldown_days_left }} дн. Хочешь PRO раньше — купи в тарифе.
        <Button label="К тарифу" link size="small" @click="emit('billing')" />
      </Message>

      <Tabs :value="q.activeTrack.value" @update:value="(v:any)=>{ if (v === 'pins' || v === 'swipes') q.selectTrack(v) }">
        <TabList class="!bg-transparent !border-0 !gap-2" :pt="{ activeBar: { class: '!hidden' } }">
          <Tab value="pins" class="!bg-transparent !border-0 !p-0"><div :class="['flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold border', q.activeTrack.value === 'pins' ? '!bg-teal-600 !text-white !border-teal-600' : 'bg-white text-stone-600 border-stone-200']"><i class="pi pi-map-marker text-xs" />Пины · {{ q.store.pins?.completed_count }}/{{ q.store.pins?.total }}</div></Tab>
          <Tab value="swipes" class="!bg-transparent !border-0 !p-0"><div :class="['flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold border', q.activeTrack.value === 'swipes' ? '!bg-rose-500 !text-white !border-rose-500' : 'bg-white text-stone-600 border-stone-200']"><i class="pi pi-heart-fill text-xs" />Свайпы · {{ q.store.swipes?.completed_count }}/{{ q.store.swipes?.total }}</div></Tab>
        </TabList>
        <TabPanels class="!bg-transparent !p-0 !pt-3">
          <TabPanel value="pins">
            <div class="text-xs text-stone-500 dark:text-zinc-400 mb-2">Выбери один трек: либо пины, либо свайпы. Закрой все 5 — получишь PRO на {{ q.store.state.premium_days }} дней.</div>
            <ProgressBar :value="q.overallPercent.value" :show-value="false" class="!h-2 mb-3" />
            <div class="space-y-2">
              <QuestCard v-for="quest in q.store.pins?.quests" :key="quest.code" :quest="quest" />
            </div>
            <div class="mt-3 flex items-center gap-2 flex-wrap">
              <Button :label="q.store.pins?.is_complete ? 'Забрать PRO на неделю' : `Готово ${q.store.pins?.completed_count}/5`" icon="pi pi-crown" rounded :disabled="!q.store.state.can_claim.pins.allowed" :loading="q.store.claiming === 'pins'" @click="q.claimActive()" />
              <span v-if="!q.store.state.can_claim.pins.allowed" class="text-xs text-stone-500">{{ q.store.state.can_claim.pins.reason }}</span>
            </div>
          </TabPanel>
          <TabPanel value="swipes">
            <div class="text-xs text-stone-500 dark:text-zinc-400 mb-2">Выбери один трек: либо пины, либо свайпы. Закрой все 5 — получишь PRO на {{ q.store.state.premium_days }} дней.</div>
            <ProgressBar :value="q.overallPercent.value" :show-value="false" class="!h-2 mb-3" />
            <div class="space-y-2">
              <QuestCard v-for="quest in q.store.swipes?.quests" :key="quest.code" :quest="quest" />
            </div>
            <div class="mt-3 flex items-center gap-2 flex-wrap">
              <Button :label="q.store.swipes?.is_complete ? 'Забрать PRO на неделю' : `Готово ${q.store.swipes?.completed_count}/5`" icon="pi pi-crown" rounded :disabled="!q.store.state.can_claim.swipes.allowed" :loading="q.store.claiming === 'swipes'" @click="q.claimActive()" />
              <span v-if="!q.store.state.can_claim.swipes.allowed" class="text-xs text-stone-500">{{ q.store.state.can_claim.swipes.reason }}</span>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <div class="text-center">
        <Button label="Обновить прогресс" icon="pi pi-refresh" text size="small" :loading="q.store.loading" @click="q.store.refresh()" />
      </div>
    </template>

    <QuestPremiumModal :granted="q.store.justGranted" :premium-days="q.store.state?.premium_days ?? 7" @close="q.store.closeGranted()" @billing="emit('billing')" />
  </div>
</template>
