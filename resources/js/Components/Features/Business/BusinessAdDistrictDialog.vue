<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'

defineProps<{ ads: any }>()
</script>
<template>
  <Dialog
    :visible="!!ads.placeAd.value"
    @update:visible="(v:boolean)=>{ if(!v) ads.closePlaceDialog() }"
    modal
    :draggable="false"
    header="Разместить в районах?"
    :style="{ width: '440px', maxWidth: 'calc(100vw - 1.5rem)' }"
    :pt="{ root: { class: '!rounded-3xl !bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-700 overflow-hidden' }, header: { class: '!py-3 !px-4' }, title: { class: '!font-black !text-[16px] dark:!text-white' }, content: { class: '!px-4 !pb-2 dark:!bg-zinc-900' }, footer: { class: '!px-4 !py-3 dark:!bg-zinc-900' } }"
  >
    <p class="text-[13px] text-stone-500 dark:text-zinc-400">
      «{{ ads.placeAd.value?.title }}» увидят жители выбранных районов как новость компании.
      {{ ads.districtQuotaLabel.value }}.
    </p>
    <div v-if="ads.districtsLoading.value" class="mt-3 space-y-2">
      <Skeleton v-for="i in 3" :key="i" height="48px" class="!rounded-2xl" />
    </div>
    <div v-else-if="!ads.myDistricts.value.length" class="mt-3 rounded-2xl border-2 border-dashed border-stone-200 dark:border-zinc-700 p-4 text-center">
      <div class="text-sm font-bold dark:text-white">Нет районов</div>
      <div class="text-[13px] text-stone-500 dark:text-zinc-400 mt-1">Вступи в район — и реклама сможет выйти к его жителям.</div>
    </div>
    <div v-else class="mt-3 space-y-1.5 max-h-[40dvh] overflow-y-auto overscroll-contain">
      <label
        v-for="district in ads.myDistricts.value"
        :key="district.id"
        class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-3.5 py-2.5 cursor-pointer hover:border-indigo-400 transition"
      >
        <Checkbox :model-value="ads.placeDistrictIds.value.includes(Number(district.id))" :binary="true" @update:model-value="(v:boolean)=>{ const id = Number(district.id); ads.placeDistrictIds.value = v ? [...ads.placeDistrictIds.value, id] : ads.placeDistrictIds.value.filter((x:number)=>x!==id) }" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-bold truncate dark:text-white">{{ district.name }}</span>
        </span>
      </label>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="Позже" severity="secondary" text @click="ads.closePlaceDialog()" />
        <Button
          label="Разместить"
          icon="pi pi-send"
          :loading="ads.placing.value"
          :disabled="!ads.placeDistrictIds.value.length || ads.districtQuota.value.left <= 0"
          class="!bg-indigo-600 !border-indigo-600 hover:!bg-indigo-500"
          @click="ads.placeInDistricts()"
        />
      </div>
    </template>
  </Dialog>
</template>
