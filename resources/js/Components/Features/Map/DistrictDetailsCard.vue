<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Avatar from 'primevue/avatar'
import Chip from 'primevue/chip'
import Badge from 'primevue/badge'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { DISTRICT_INTEREST_OPTIONS, districtInterestLabel } from '@/utils/districtGeo'
import type { DistrictDetails, DistrictResident } from '@/types/entities/District'

const props = defineProps<{ open: boolean; district: DistrictDetails | null; residents: DistrictResident[]; pending: DistrictResident[]; invited: DistrictResident[]; loading: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'close'): void
  (e: 'join'): void
  (e: 'leave'): void
  (e: 'accept-invite'): void
  (e: 'decline-invite'): void
  (e: 'cancel-invite', userId: number): void
  (e: 'approve', userId: number): void
  (e: 'reject', userId: number): void
  (e: 'kick', userId: number): void
  (e: 'delete'): void
  (e: 'save', v: { name: string; description: string | null; interest: string }): void
  (e: 'chat', conversationId: number): void
  (e: 'invite'): void
  (e: 'open-pin', pin: any): void
}>()

const tab = ref('main')
const editing = ref(false)
const editName = ref('')
const editDescription = ref('')
const editInterest = ref('neighbors')

watch(
  () => props.district?.id,
  () => {
    tab.value = 'main'
    editing.value = false
  },
)

watch(
  () => props.open,
  (v) => {
    if (v) {
      tab.value = 'main'
      editing.value = false
    }
  },
)

const isOwner = computed(() => props.district?.role === 'owner')
const isMember = computed(() => props.district?.role === 'member')
const isGuest = computed(() => props.district?.role === 'guest')
const isPending = computed(() => props.district?.role === 'pending')
const isInvited = computed(() => props.district?.role === 'invited')
const canChat = computed(() => (isOwner.value || isMember.value) && Number(props.district?.conversation_id) > 0)

function startEdit(): void {
  editName.value = props.district?.name ?? ''
  editDescription.value = props.district?.description ?? ''
  editInterest.value = String(props.district?.interest ?? 'neighbors')
  editing.value = true
}

function saveEdit(): void {
  const clean = editName.value.trim()
  if (clean.length < 3) {
    return
  }
  editing.value = false
  emit('save', { name: clean, description: editDescription.value.trim() || null, interest: editInterest.value })
}

function close(): void {
  emit('update:open', false)
  emit('close')
}

function pinTime(pin: any): string {
  try {
    return new Date(pin.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}
</script>
<template>
  <Dialog :visible="open" modal dismissableMask :closable="true" :draggable="false" :breakpoints="{ '960px': '96vw', '640px': '100vw' }" :style="{ width: '960px', maxWidth: '96vw' }" class="!rounded-[20px] sm:!rounded-3xl max-sm:!rounded-b-none overflow-hidden" :pt="{ root: { class: 'max-sm:!m-0 !bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-white/10 !rounded-[20px] sm:!rounded-3xl overflow-hidden' }, mask: { class: 'max-sm:!items-end' }, content: { class: '!p-0 !bg-white dark:!bg-zinc-900 !max-h-[82dvh] !overflow-y-auto !rounded-b-[20px] sm:!rounded-b-3xl' }, header: { class: '!py-3 !px-3 sm:!px-5 !bg-white dark:!bg-zinc-900 !border-0' } }" @update:visible="(v:boolean)=>{ if(!v) close() }">
    <template #header>
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <div class="min-w-0">
          <div class="font-black text-[16px] tracking-tight truncate dark:text-white">{{ district?.name ?? 'Район' }}</div>
          <div class="text-[11px] text-stone-500 dark:text-zinc-400">UDistrict · {{ districtInterestLabel(district?.interest) }}</div>
        </div>
      </div>
    </template>
    <div v-if="district">
      <div class="relative overflow-hidden h-24 sm:h-28 bg-gradient-to-r from-violet-600 via-purple-700 to-indigo-800">
        <div class="pointer-events-none absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/15 blur-2xl"></div>
        <div class="pointer-events-none absolute -bottom-10 left-1/3 w-44 h-44 rounded-full bg-fuchsia-400/20 blur-2xl"></div>
      </div>
      <div class="relative px-4 sm:px-6">
        <div class="flex items-end gap-3 -mt-9">
          <span class="w-16 h-16 sm:w-20 sm:h-20 rounded-[20px] bg-white dark:bg-zinc-800 grid place-items-center text-3xl sm:text-4xl shrink-0 ring-4 ring-white dark:ring-zinc-900 shadow-float">🏘️</span>
          <div class="min-w-0 flex-1 pb-0.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200 rounded-full px-2.5 py-1">{{ districtInterestLabel(district.interest) }}</span>
              <span v-if="isOwner" class="text-[11px] font-bold bg-amber-400 text-stone-900 rounded-full px-2.5 py-1">ваш район</span>
              <span v-else-if="isMember" class="text-[11px] font-bold bg-emerald-400 text-stone-900 rounded-full px-2.5 py-1">вы житель</span>
              <span v-else-if="isPending" class="text-[11px] font-bold bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-zinc-200 rounded-full px-2.5 py-1">заявка отправлена</span>
              <span v-else-if="isInvited" class="text-[11px] font-bold bg-violet-600 text-white rounded-full px-2.5 py-1">вас пригласили</span>
            </div>
          </div>
        </div>
        <div v-if="!editing" class="mt-2.5 text-[22px] sm:text-[28px] font-black tracking-tight leading-tight text-stone-900 dark:text-white">{{ district.name }}</div>
        <InputText v-else v-model="editName" maxlength="80" placeholder="Название района" class="w-full !rounded-2xl mt-2.5" />
        <div class="mt-2 flex items-center gap-2 flex-wrap text-[12px] font-semibold">
          <span class="bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-zinc-200 rounded-full px-2.5 py-1">👥 {{ district.members_count }}</span>
          <span class="bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-zinc-200 rounded-full px-2.5 py-1">📍 {{ district.pins_count }}</span>
          <Link v-if="district.owner" :href="`/users/${district.owner.id}`" class="text-[11px] text-stone-500 dark:text-zinc-400 hover:text-violet-700 dark:hover:text-violet-200 hover:underline px-1">Владелец: {{ district.owner.name }}</Link>
        </div>
        <div v-if="editing" class="mt-3 flex flex-col gap-2">
          <Textarea v-model="editDescription" maxlength="500" rows="2" auto-resize placeholder="Чем тут занимаются" class="w-full !rounded-2xl !text-sm" />
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="o in DISTRICT_INTEREST_OPTIONS"
              :key="o.v"
              type="button"
              :class="['px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition active:scale-95 hover:border-violet-400 dark:hover:border-violet-400/60', editInterest === o.v ? 'bg-violet-700 text-white border-violet-700 shadow-glow hover:bg-violet-600' : 'bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-zinc-200 border-stone-200 dark:border-white/10 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-200']"
              @click="editInterest = o.v"
            >{{ o.i }} {{ o.l }}</button>
          </div>
          <div class="flex flex-col-reverse sm:flex-row gap-2">
            <Button label="Отмена" rounded outlined severity="secondary" size="small" class="flex-1 active:scale-[0.99] transition" @click="editing = false" />
            <Button label="Сохранить" icon="pi pi-check" rounded size="small" class="flex-[1.4] !bg-gradient-to-r !from-violet-700 !to-purple-900 !border-0 !shadow-glow !text-white hover:!opacity-90 hover:!brightness-110 active:scale-[0.99] transition" @click="saveEdit" />
          </div>
        </div>
      </div>
      <div v-if="!editing" class="relative px-4 sm:px-6">
          <div class="mt-3 flex gap-1.5 flex-wrap">
            <Button v-if="isGuest" label="Хочу в район" icon="pi pi-send" rounded size="small" class="!bg-gradient-to-r !from-violet-700 !to-purple-900 !border-0 !text-white !shadow-glow font-bold hover:!opacity-90 hover:!brightness-110 active:scale-95 transition" @click="emit('join')" />
            <Button v-if="isInvited" label="Принять" icon="pi pi-check" rounded size="small" severity="success" class="font-bold active:scale-95 transition" @click="emit('accept-invite')" />
            <Button v-if="isInvited" label="Отклонить" rounded outlined size="small" severity="secondary" class="hover:!bg-stone-100 dark:hover:!bg-white/10 active:scale-95 transition" @click="emit('decline-invite')" />
            <Button v-if="isMember || isPending" label="Выйти" rounded outlined size="small" severity="secondary" class="hover:!bg-stone-100 dark:hover:!bg-white/10 active:scale-95 transition" @click="emit('leave')" />
            <Button v-if="canChat" label="Общий чат" icon="pi pi-comments" rounded size="small" class="!bg-stone-900 dark:!bg-white dark:!text-stone-900 !border-0 hover:!opacity-90 active:scale-95 transition" @click="emit('chat', Number(district.conversation_id))" />
            <Button v-if="isOwner" label="Пригласить" icon="pi pi-user-plus" rounded size="small" outlined class="hover:!bg-violet-50 dark:hover:!bg-violet-950/40 active:scale-95 transition" @click="emit('invite')" />
            <Button v-if="isOwner && !editing" icon="pi pi-pencil" rounded size="small" outlined severity="secondary" title="Править" aria-label="Править район" class="!w-10 !h-10 !p-0 active:scale-95 transition" @click="startEdit" />
            <Button v-if="isOwner" icon="pi pi-trash" rounded size="small" severity="danger" title="Удалить район" aria-label="Удалить район" class="!w-10 !h-10 !p-0 active:scale-95 transition" @click="emit('delete')" />
          </div>
          <div class="h-3" />
        </div>
      <Tabs v-model:value="tab" class="px-2 sm:px-4">
        <TabList class="sticky top-0 z-10 !bg-white/95 dark:!bg-zinc-900/95 backdrop-blur rounded-none" :pt="{ activeBar: { class: '!bg-violet-600' } }">
          <Tab value="main" class="!text-[13px] sm:!text-sm !font-bold whitespace-nowrap !px-3 sm:!px-4 !py-3 !text-stone-600 dark:!text-zinc-300 hover:!text-violet-700 dark:hover:!text-violet-200 hover:!bg-violet-50 dark:hover:!bg-white/5">Главное</Tab>
          <Tab value="people" class="!text-[13px] sm:!text-sm !font-bold whitespace-nowrap !px-3 sm:!px-4 !py-3 !text-stone-600 dark:!text-zinc-300 hover:!text-violet-700 dark:hover:!text-violet-200 hover:!bg-violet-50 dark:hover:!bg-white/5">Жители · {{ residents.length }}</Tab>
          <Tab v-if="isOwner" value="requests" class="!text-[13px] sm:!text-sm !font-bold whitespace-nowrap !px-3 sm:!px-4 !py-3 !text-stone-600 dark:!text-zinc-300 hover:!text-violet-700 dark:hover:!text-violet-200 hover:!bg-violet-50 dark:hover:!bg-white/5">
            <span class="flex items-center gap-1.5">Заявки<Badge v-if="pending.length + invited.length" :value="String(pending.length + invited.length)" severity="danger" class="!text-[10px] !min-w-[20px] !h-5" /></span>
          </Tab>
        </TabList>
        <TabPanels class="!p-0 !bg-transparent">
          <TabPanel value="main">
            <div class="px-3 sm:px-4 py-3.5 flex flex-col gap-3.5">
              <p v-if="district.description" class="text-[13px] leading-relaxed text-stone-600 dark:text-zinc-300">{{ district.description }}</p>
              <p v-else class="text-[12px] text-stone-400 dark:text-zinc-500">Без описания — спроси у жителей, что тут происходит.</p>
              <div>
                <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 mb-1.5">Что тут делают</div>
                <div v-if="district.pins_locked" class="rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-white/[0.04] p-4 text-center">
                  <div class="text-2xl">🔒</div>
                  <div class="mt-1 text-[13px] font-bold dark:text-white">Пины скрыты</div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">Внутри {{ district.pins_count }} · видят только жители</div>
                  <Button v-if="isGuest" label="Хочу в район" icon="pi pi-send" rounded size="small" class="mt-2.5 !bg-gradient-to-r !from-violet-700 !to-purple-900 !border-0" @click="emit('join')" />
                  <Button v-if="isInvited" label="Принять приглашение" icon="pi pi-check" rounded size="small" severity="success" class="mt-2.5" @click="emit('accept-invite')" />
                </div>
                <div v-else-if="district.pins?.length" class="flex flex-col gap-1.5">
                  <button v-for="pin in district.pins" :key="pin.id" type="button" class="flex items-center gap-2.5 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-white/[0.04] p-2.5 text-left transition active:scale-[0.99] hover:border-violet-300 dark:hover:border-violet-500/50" @click="emit('open-pin', pin)">
                    <span class="min-w-0 flex-1"><span class="block text-[13px] font-bold truncate dark:text-white">{{ pin.title }}</span><span class="block text-[11px] text-stone-400 dark:text-zinc-500">{{ pin.category }} · 💬 {{ pin.comments_count ?? 0 }} · {{ pinTime(pin) }}</span></span>
                    <i class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0" />
                  </button>
                </div>
                <div v-else class="text-xs text-stone-400 dark:text-zinc-500 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700 p-3 text-center">Пока тихо — стань первым, кто поставит пин внутри</div>
              </div>
            </div>
          </TabPanel>
          <TabPanel value="people">
            <div class="px-3 sm:px-4 py-3.5">
              <div v-if="residents.length" class="grid grid-cols-1 min-[411px]:grid-cols-2 gap-2">
                <div v-for="r in residents" :key="r.id" class="flex items-center gap-2.5 rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/[0.06] p-2.5 transition hover:border-violet-300 dark:hover:border-violet-400/40 hover:bg-stone-50 dark:hover:bg-white/[0.09]">
                  <Link :href="`/users/${r.id}`" class="relative shrink-0 hover:opacity-85 transition">
                    <Avatar :image="r.avatar_url ?? undefined" :label="!r.avatar_url ? (r.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-10 !h-10 sm:!w-9 sm:!h-9" />
                    <span v-if="r.is_owner" class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 grid place-items-center ring-2 ring-white dark:ring-zinc-900" title="Владелец"><i class="pi pi-crown text-[8px] text-white" /></span>
                  </Link>
                  <Link :href="`/users/${r.id}`" class="min-w-0 flex-1 text-[13px] sm:text-sm font-bold truncate text-stone-900 dark:text-white hover:underline">{{ r.name }}</Link>
                  <Button v-if="isOwner && !r.is_owner" icon="pi pi-user-minus" rounded outlined severity="danger" size="small" title="Исключить" aria-label="Исключить жителя" class="!w-10 !h-10 sm:!w-9 sm:!h-9 !p-0 shrink-0 hover:!bg-red-50 dark:hover:!bg-red-950/40 active:scale-95 transition" @click="emit('kick', r.id)" />
                </div>
              </div>
              <div v-else class="text-xs text-stone-400 dark:text-zinc-500 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700 p-3 text-center">Пока только владелец</div>
            </div>
          </TabPanel>
          <TabPanel v-if="isOwner" value="requests">
            <div class="px-3 sm:px-4 py-3.5">
              <div v-if="invited.length" class="mb-3">
                <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 mb-1.5">Приглашены · ждут ответа</div>
                <div class="flex flex-col gap-2">
                  <div v-for="p in invited" :key="p.id" class="flex items-center gap-2.5 rounded-2xl border border-violet-200 dark:border-violet-400/30 bg-violet-50 dark:bg-violet-950/30 p-2.5 transition hover:border-violet-300 dark:hover:border-violet-400/50">
                    <Link :href="`/users/${p.id}`" class="shrink-0 hover:opacity-85 transition"><Avatar :image="p.avatar_url ?? undefined" :label="!p.avatar_url ? (p.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-11 !h-11 sm:!w-10 sm:!h-10" /></Link>
                    <Link :href="`/users/${p.id}`" class="min-w-0 flex-1 text-[13px] sm:text-sm font-bold truncate text-stone-900 dark:text-white hover:underline">{{ p.name }}</Link>
                    <Button label="Отозвать" rounded outlined severity="secondary" size="small" class="shrink-0 active:scale-95 transition" @click="emit('cancel-invite', p.id)" />
                  </div>
                </div>
              </div>
              <div v-if="pending.length" class="flex flex-col gap-2">
                <div v-for="p in pending" :key="p.id" class="flex items-center gap-2.5 rounded-2xl border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-950/30 p-2.5 transition hover:border-amber-300 dark:hover:border-amber-400/50">
                  <Link :href="`/users/${p.id}`" class="shrink-0 hover:opacity-85 transition"><Avatar :image="p.avatar_url ?? undefined" :label="!p.avatar_url ? (p.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-11 !h-11 sm:!w-10 sm:!h-10" /></Link>
                  <Link :href="`/users/${p.id}`" class="min-w-0 flex-1 text-[13px] sm:text-sm font-bold truncate text-stone-900 dark:text-white hover:underline">{{ p.name }}</Link>
                  <Button icon="pi pi-check" rounded size="small" title="Принять" aria-label="Принять заявку" class="!w-11 !h-11 sm:!w-10 sm:!h-10 !p-0 shrink-0 !bg-emerald-500 !border-0 hover:!bg-emerald-400 dark:hover:!bg-emerald-400 active:scale-95 transition" @click="emit('approve', p.id)" />
                  <Button icon="pi pi-times" rounded outlined severity="danger" size="small" title="Отклонить" aria-label="Отклонить заявку" class="!w-11 !h-11 sm:!w-10 sm:!h-10 !p-0 shrink-0 hover:!bg-red-50 dark:hover:!bg-red-950/40 active:scale-95 transition" @click="emit('reject', p.id)" />
                </div>
              </div>
              <div v-else-if="!invited.length" class="text-xs text-stone-400 dark:text-zinc-500 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700 p-3 text-center">Заявок нет — все жители на месте</div>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <div v-if="loading" class="px-4 pb-3 flex items-center justify-center gap-2 text-[11px] text-stone-400 dark:text-zinc-500"><i class="pi pi-spin pi-spinner"></i>Обновляем…</div>
      <div class="h-[calc(0.75rem+var(--sab))] sm:h-3" />
    </div>
  </Dialog>
</template>
