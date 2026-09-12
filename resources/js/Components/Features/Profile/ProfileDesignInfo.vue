<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { useInfoTileModal } from '@/composables/useInfoTileModal'

defineProps<{
  statusText: string
  online: boolean
  userName: string
  isOwn: boolean
  ageText: string
  genderLabel: string
  residenceText: string
  levelName: string
}>()

const emit = defineEmits<{
  (e: 'edit'): void
}>()

const modal = useInfoTileModal()

const tileCls = 'w-full flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-100/70 px-3 py-3 text-left transition hover:bg-stone-100 active:scale-[0.99] dark:border-zinc-800 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
const iconCls = 'grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white text-stone-500 dark:border-transparent dark:bg-zinc-800 dark:text-zinc-300'
const labelCls = 'block text-xs text-stone-500 dark:text-zinc-500'
const valueCls = 'block truncate text-sm font-bold text-ink-900 dark:text-zinc-100'
const chevronCls = 'pi pi-chevron-right shrink-0 text-xs text-stone-300 dark:text-zinc-600'
</script>

<template>
  <section class="rounded-[24px] border border-stone-200 bg-white shadow-soft p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex items-center justify-between">
      <h2 class="text-lg sm:text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">Общая информация</h2>
      <button
        v-if="isOwn"
        type="button"
        title="Редактировать"
        aria-label="Редактировать"
        class="grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-stone-100 text-stone-500 transition hover:bg-stone-200/70 active:scale-95 dark:border-zinc-800 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/[0.06]"
        @click="emit('edit')"
      >
        <i class="pi pi-pencil text-sm"></i>
      </button>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
      <button type="button" :class="tileCls" @click="modal.show('Статус', statusText)">
        <span :class="iconCls">
          <span class="h-3.5 w-3.5 rounded-full" :class="online ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-zinc-600'"></span>
        </span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Статус</span>
          <span :class="[valueCls, online ? '!text-emerald-600 dark:!text-emerald-400' : '']">{{ statusText }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button type="button" :class="tileCls" @click="modal.show('Имя', userName)">
        <span :class="iconCls"><i class="pi pi-user"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Имя</span>
          <span :class="valueCls">{{ userName }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button v-if="ageText" type="button" :class="tileCls" @click="modal.show('Возраст', ageText)">
        <span :class="iconCls"><i class="pi pi-gift"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Возраст</span>
          <span :class="valueCls">{{ ageText }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button v-if="genderLabel" type="button" :class="tileCls" @click="modal.show('Пол', genderLabel)">
        <span :class="iconCls"><i class="pi pi-id-card"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Пол</span>
          <span :class="valueCls">{{ genderLabel }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button type="button" :class="tileCls" @click="modal.show('Город', residenceText)">
        <span :class="iconCls"><i class="pi pi-map-marker"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Город</span>
          <span :class="valueCls">{{ residenceText }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button type="button" :class="tileCls" @click="modal.show('Уровень', levelName)">
        <span :class="iconCls"><i class="pi pi-star"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Уровень</span>
          <span :class="valueCls">{{ levelName }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>
    </div>

    <Dialog :visible="modal.open.value" @update:visible="(v:boolean)=>{ if(!v) modal.close() }" modal dismissableMask :closable="true" :draggable="false" :style="{ width: '320px', maxWidth: 'calc(100vw - 2rem)' }">
      <template #header><span class="font-bold">{{ modal.title.value }}</span></template>
      <p class="text-sm leading-relaxed break-words text-ink-900 dark:text-zinc-100">{{ modal.text.value }}</p>
    </Dialog>
  </section>
</template>
