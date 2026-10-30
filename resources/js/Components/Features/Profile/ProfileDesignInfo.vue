<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import { useInfoTileModal } from '@/composables/useInfoTileModal'
import { useInfoTileStyle } from '@/composables/useInfoTileStyle'

const props = defineProps<{
  statusText: string
  online: boolean
  userName: string
  ageText: string
  genderLabel: string
  genderValue?: string | null
  residenceText: string
  bioText: string
  bioPreview: string
}>()

const modal = useInfoTileModal()
const tiles = useInfoTileStyle()

const tileCls = tiles.tileCls
const labelCls = tiles.labelCls
const valueCls = tiles.valueCls
const chevronCls = tiles.chevronCls
const genderIcon = computed(() => tiles.genderIconFor(props.genderValue))
</script>

<template>
  <section class="liquid-glass rounded-[24px] shadow-soft p-4 sm:p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-lg sm:text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">Общая информация</h2>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
      <button type="button" :class="tileCls" @click="modal.show('Статус', statusText)">
        <span :class="tiles.iconFor('status')">
          <span class="h-3.5 w-3.5 rounded-full bg-white/95 shadow-inner"></span>
        </span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Статус</span>
          <span :class="[valueCls, online ? '!text-emerald-600 dark:!text-emerald-400' : '!text-red-500 dark:!text-red-400']">{{ statusText }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button type="button" :class="tileCls" @click="modal.show('Имя', userName)">
        <span :class="tiles.iconFor('name')"><i class="pi pi-user"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Имя</span>
          <span :class="valueCls">{{ userName }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button v-if="ageText" type="button" :class="tileCls" @click="modal.show('Возраст', ageText)">
        <span :class="tiles.iconFor('age')"><i class="pi pi-gift"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Возраст</span>
          <span :class="valueCls">{{ ageText }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button v-if="genderLabel" type="button" :class="tileCls" @click="modal.show('Пол', genderLabel)">
        <span :class="tiles.iconFor('gender')"><i :class="genderIcon"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Пол</span>
          <span :class="valueCls">{{ genderLabel }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button type="button" :class="tileCls" @click="modal.show('Город', residenceText)">
        <span :class="tiles.iconFor('city')"><i class="pi pi-map-marker"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">Город</span>
          <span :class="valueCls">{{ residenceText }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>

      <button type="button" :class="tileCls" @click="modal.show('О себе', bioText || 'Пока пусто — расскажи о себе в настройках профиля')">
        <span :class="tiles.iconFor('bio')"><i class="pi pi-sparkles"></i></span>
        <span class="min-w-0 flex-1">
          <span :class="labelCls">О себе</span>
          <span :class="valueCls">{{ bioPreview || '—' }}</span>
        </span>
        <i :class="chevronCls"></i>
      </button>
    </div>

    <Dialog v-model:visible="modal.open.value" modal dismissableMask :closable="true" :draggable="false" :style="{ width: '320px', maxWidth: 'calc(100vw - 2rem)' }">
      <template #header><span class="font-bold">{{ modal.title.value }}</span></template>
      <p class="text-sm leading-relaxed break-words text-ink-900 dark:text-zinc-100">{{ modal.text.value }}</p>
    </Dialog>
  </section>
</template>
