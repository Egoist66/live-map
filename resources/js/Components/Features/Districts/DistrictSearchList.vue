<script setup lang="ts">
import Button from 'primevue/button'
import { useGlobalDistrictSearch } from '@/composables/useGlobalDistrictSearch'
import { districtInterestLabel } from '@/utils/districtGeo'
import type { District } from '@/types/entities/District'

defineProps<{ rows: District[] }>()
const emit = defineEmits<{ (e: 'open', id: number): void; (e: 'chat', row: District): void }>()

const districts = useGlobalDistrictSearch()
</script>
<template>
  <div
    v-for="row in rows"
    :key="row.id"
    @click="emit('open', row.id)"
    @keydown.enter="emit('open', row.id)"
    tabindex="0"
    role="link"
    class="flex items-center justify-between p-3 select-none cursor-pointer hover:bg-stone-50 dark:hover:bg-zinc-800/60 transition rounded-xl"
  >
    <div class="flex items-center gap-2.5 min-w-0">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-black text-white">{{ districts.letterOf(row.name) }}</span>
      <div class="min-w-0">
        <div class="text-sm font-medium truncate dark:text-white">{{ row.name }}</div>
        <div class="text-[11px] text-stone-500 truncate dark:text-zinc-400">{{ districtInterestLabel(row.interest) }} · {{ row.members_count }} уч.</div>
      </div>
    </div>
    <div class="flex gap-1.5 shrink-0 ml-2 items-center">
      <Button
        v-if="districts.canChat(row)"
        @click.stop="emit('chat', row)"
        rounded
        title="Открыть общий чат"
        aria-label="Открыть общий чат"
        icon="pi pi-comments"
        class="!w-9 !h-9 !p-0"
      />
      <Button
        v-if="districts.canJoin(row)"
        @click.stop="districts.joinDistrict(row)"
        :loading="Number(districts.joiningId.value) === Number(row.id)"
        rounded
        size="small"
        label="Вступить"
        icon="pi pi-user-plus"
        class="!border-0 !bg-blue-600 !text-xs !font-bold !text-white hover:!bg-blue-500"
      />
      <span
        v-else-if="row.role === 'pending'"
        title="Заявка отправлена"
        class="w-9 h-9 grid place-items-center rounded-full bg-stone-100 text-stone-400 dark:bg-zinc-800 dark:text-zinc-500"
      >
        <i class="pi pi-clock text-sm" />
      </span>
      <span
        v-else-if="row.role === 'member' || row.role === 'owner'"
        title="Вы уже в районе"
        class="w-9 h-9 grid place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      >
        <i class="pi pi-check text-sm" />
      </span>
    </div>
  </div>
</template>
