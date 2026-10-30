<script setup lang="ts">
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import Checkbox from 'primevue/checkbox'

defineProps<{ hidden: any }>()
</script>
<template>
  <div class="!border !border-stone-200 dark:!border-white/10 !rounded-3xl !p-4 bg-white dark:bg-[#0F121F]">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="text-sm font-semibold dark:text-white flex items-center gap-2">
          Скрытые друзья
          <Tag :value="hidden.hiddenUnlimited.value ? '∞' : `${hidden.hiddenCount.value} / ${hidden.hiddenLimit.value ?? '∞'}`" class="!bg-stone-900 !text-white !border-0 !text-[10px]" />
          <Tag v-if="hidden.isAdmin.value" value="GOD" class="!bg-amber-500 !text-white !border-0 !text-[10px]" />
          <Tag v-else :value="(hidden.plan.value || 'free').toUpperCase()" class="!bg-violet-600 !text-white !border-0 !text-[10px]" />
        </div>
        <p class="text-xs text-stone-500 mt-1 leading-relaxed">Отметь, кого скрыть из списка для других. Free — 1, Pro — 3, Business — ∞.</p>
      </div>
    </div>
    <div class="mt-3 flex items-center gap-2">
      <InputText :modelValue="hidden.query.value" @update:modelValue="(v?:string)=>hidden.query.value=v||''" placeholder="Поиск друга…" size="small" class="w-full !rounded-2xl" />
    </div>
    <label class="mt-2 flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
      <Checkbox :modelValue="hidden.showHidden.value" @update:modelValue="(v:boolean)=>hidden.showHidden.value=v" binary size="small" />
      Показывать скрытых в списке
    </label>
    <Message v-if="hidden.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ hidden.error.value }}</Message>
    <Message v-if="!hidden.canHideMore.value && !hidden.hiddenUnlimited.value" severity="warn" :closable="false" class="!mt-3 !rounded-2xl !text-xs">Лимит исчерпан. Удали кого-то из скрытых или обнови тариф.</Message>
    <div v-if="hidden.loading.value" class="mt-3 text-xs text-stone-500">Загрузка…</div>
    <div v-else-if="!hidden.visibleFriends.value.length" class="mt-3 text-xs text-stone-500">Друзей нет</div>
    <div v-else class="mt-2 divide-y divide-stone-100 dark:divide-white/10 max-h-72 overflow-auto">
      <div v-for="f in hidden.visibleFriends.value" :key="f.id" class="flex items-center justify-between gap-3 py-2">
        <div class="min-w-0 flex items-center gap-2">
          <i :class="['pi text-xs', f.is_hidden ? 'pi-eye-slash text-stone-400' : 'pi-eye text-emerald-500']" />
          <span class="text-sm truncate dark:text-white" :class="f.is_hidden ? 'opacity-60' : ''">{{ f.other?.name || 'Без имени' }}</span>
          <Tag v-if="f.is_hidden" value="скрыт" class="!bg-stone-200 !text-stone-600 !border-0 !text-[10px]" />
        </div>
        <ToggleSwitch :modelValue="!!f.is_hidden" @update:modelValue="hidden.toggle(f.id, $event)" :disabled="!f.is_hidden && !hidden.canHideMore.value" />
      </div>
    </div>
  </div>
</template>
