<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

defineProps<{ mgr: any }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2">
        <span class="w-9 h-9 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white grid place-items-center shrink-0"><i class="pi pi-wrench text-sm" /></span>
        <div class="flex-1 min-w-0">
          <div class="font-black dark:text-white">Режим обслуживания</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">Закрывает приложение заглушкой для всех, кроме модераторов.</div>
        </div>
        <Tag :value="mgr.enabled.value ? 'включён' : 'выключен'" :severity="mgr.enabled.value ? 'danger' : 'success'" class="!text-[9px]" />
      </div>

      <Message v-if="mgr.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ mgr.error.value }}</Message>

      <div v-if="mgr.loading.value" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else class="mt-3 space-y-3">
        <label class="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-white/10 px-3.5 py-3 cursor-pointer">
          <span class="text-sm font-bold dark:text-white">Включить обслуживание</span>
          <ToggleSwitch :modelValue="mgr.enabled.value" @update:modelValue="(v:boolean)=>mgr.enabled.value=v" />
        </label>
        <div>
          <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Заголовок страницы</label>
          <InputText v-model="mgr.title.value" placeholder="Технические работы" class="w-full mt-1" maxlength="120" />
        </div>
        <div>
          <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Текст для пользователей</label>
          <Textarea v-model="mgr.message.value" rows="3" autoResize placeholder="Что случилось и когда вернёмся..." class="w-full mt-1" maxlength="1000" />
          <div class="text-[11px] text-stone-400 dark:text-zinc-500 mt-1 text-right">{{ mgr.message.value.length }} / 1000</div>
        </div>
        <Message v-if="mgr.enabled.value" severity="warn" :closable="false" class="!rounded-2xl !text-xs">Приложение закрыто для всех, кроме модераторов. Вход по паролю для остальных недоступен.</Message>
        <Button label="Сохранить" rounded :loading="mgr.saving.value" :disabled="!mgr.canSave()" @click="mgr.save()" class="!bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-0 !font-bold" />
      </div>
    </template>
  </Card>
</template>
