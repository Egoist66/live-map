<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

defineProps<{ mgr: any }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2">
        <span class="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white grid place-items-center shrink-0"><i class="pi pi-megaphone text-sm" /></span>
        <div class="flex-1 min-w-0">
          <div class="font-black dark:text-white">Новости приложения</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">Публикация — в колокольчик всем + письмом в Telegram-бота (даже тем, кто не открыл приложение).</div>
        </div>
        <Button label="Создать" icon="pi pi-plus" size="small" rounded @click="mgr.openCreate()" />
      </div>

      <Message v-if="mgr.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ mgr.error.value }}</Message>

      <div v-if="mgr.loading.value" class="py-8 grid place-items-center">
        <span class="w-5 h-5 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
      </div>
      <div v-else-if="!mgr.items.value.length" class="mt-3 text-center py-6 text-sm text-stone-500 dark:text-zinc-400">Пока нет новостей — создайте первую.</div>
      <div v-else class="mt-3 space-y-2">
        <div v-for="u in mgr.items.value" :key="u.id" class="rounded-2xl border border-stone-200 dark:border-zinc-700 p-3">
          <div class="flex items-center gap-2 min-w-0">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-bold truncate dark:text-white">{{ u.title }}<span v-if="u.version" class="ml-1.5 text-[10px] font-bold text-stone-400">v{{ u.version }}</span></div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ (u.body || '').slice(0, 90) }}</div>
            </div>
            <Tag :value="u.is_published ? 'видно всем' : 'черновик'" :severity="u.is_published ? 'success' : 'secondary'" class="!text-[9px]" />
          </div>
          <div class="mt-2 flex items-center gap-2 flex-wrap">
            <span class="flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-400">Публикация <ToggleSwitch :modelValue="!!u.is_published" @update:modelValue="(v:boolean)=>mgr.togglePublish(u, v)" /></span>
            <span class="text-[11px] text-stone-400">👁 {{ u.reads_count ?? 0 }}</span>
            <span class="flex-1" />
            <Button icon="pi pi-pencil" size="small" rounded outlined @click="mgr.openEdit(u)" />
            <Button icon="pi pi-trash" size="small" rounded outlined severity="danger" :loading="mgr.deletingId.value === u.id" @click="mgr.remove(u.id)" />
          </div>
        </div>
      </div>

      <Dialog v-model:visible="mgr.showDialog.value" modal header="Новость приложения" :style="{ width: '520px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] overflow-hidden' } }">
        <div class="space-y-3">
          <div>
            <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Заголовок</label>
            <InputText v-model="mgr.formTitle.value" placeholder="Например: Тёмная тема и пины" class="w-full mt-1" maxlength="200" />
          </div>
          <div>
            <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Текст для модалки</label>
            <Textarea v-model="mgr.formBody.value" rows="6" autoResize placeholder="Что нового, что изменилось..." class="w-full mt-1" maxlength="10000" />
            <div class="text-[11px] text-stone-400 dark:text-zinc-500 mt-1 text-right">{{ mgr.formBody.value.length }} / 10000</div>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex-1 min-w-[140px]">
              <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Версия (необязательно)</label>
              <InputText v-model="mgr.formVersion.value" placeholder="1.2.0" class="w-full mt-1" maxlength="50" />
            </div>
            <label class="flex items-center gap-2 text-sm mt-5 cursor-pointer"><ToggleSwitch v-model="mgr.formPublish.value" /> Опубликовать сразу</label>
          </div>
          <label class="flex items-start gap-2 text-sm cursor-pointer rounded-2xl border border-stone-200 dark:border-zinc-700 p-3">
            <Checkbox v-model="mgr.formTelegram.value" :binary="true" inputId="appnews-tg" />
            <span>
              <span class="font-bold">Отправить в Telegram-бота всем</span>
              <span class="block text-xs text-stone-500 dark:text-zinc-400 mt-0.5">Полный текст новости 📰 придёт письмом прямо в бота — открывать приложение не нужно. Отключить могут в боте: /notify → Новости.</span>
            </span>
          </label>
          <Message v-if="!mgr.canSave()" severity="info" :closable="false" class="!rounded-2xl !text-xs">Минимум 3 символа в заголовке и 5 в тексте.</Message>
        </div>
        <template #footer>
          <Button label="Отмена" text @click="mgr.showDialog.value = false" />
          <Button :label="mgr.editingId.value ? 'Сохранить' : 'Создать'" rounded :loading="mgr.saving.value" :disabled="!mgr.canSave()" @click="mgr.save()" />
        </template>
      </Dialog>
    </template>
  </Card>
</template>
