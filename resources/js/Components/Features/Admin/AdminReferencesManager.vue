<script setup lang="ts">
import { ref } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

defineProps<{ mgr: any }>()

const activeSlug = ref('contacts')
const fileInput = ref<HTMLInputElement | null>(null)
const uploadTarget = ref<any>(null)

const slugOptions = [
  { label: 'Контакты', value: 'contacts' },
  { label: 'Политика конфиденциальности', value: 'privacy' },
  { label: 'Публичная оферта', value: 'offer' },
]

const dialogTitles: Record<string, string> = {
  contacts: 'Контакты',
  privacy: 'Политика конфиденциальности',
  offer: 'Публичная оферта',
}

const inputClass = 'w-full mt-1 !bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-600 dark:!text-white dark:placeholder:!text-zinc-500'

function filteredItems(items: any[]) {
  return items.filter((item) => item.slug === activeSlug.value)
}

function askFile(item: any) {
  uploadTarget.value = item
  fileInput.value?.click()
}

function onFilePicked(mgr: any, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && uploadTarget.value) {
    mgr.uploadFile(uploadTarget.value, file)
  }
  input.value = ''
}
</script>

<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2">
        <span class="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white grid place-items-center shrink-0"><i class="pi pi-book text-sm" /></span>
        <div class="flex-1 min-w-0">
          <div class="font-black dark:text-white">Справочные данные</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">Контакты, политика и оферта — видны всем в футере.</div>
        </div>
        <Button label="Создать" icon="pi pi-plus" size="small" rounded @click="mgr.openCreate(activeSlug)" />
      </div>

      <div class="mt-3 flex gap-1.5 flex-wrap">
        <Button
          v-for="option in slugOptions"
          :key="option.value"
          :label="option.label"
          size="small"
          rounded
          :outlined="activeSlug !== option.value"
          :severity="activeSlug === option.value ? undefined : 'secondary'"
          @click="activeSlug = option.value"
        />
      </div>

      <Message v-if="mgr.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ mgr.error.value }}</Message>
      <input ref="fileInput" type="file" class="hidden" @change="(event:Event)=>onFilePicked(mgr, event)" />

      <div v-if="mgr.loading.value" class="py-8 grid place-items-center">
        <span class="w-5 h-5 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
      </div>
      <div v-else-if="!filteredItems(mgr.items.value).length" class="mt-3 text-center py-6 text-sm text-stone-500 dark:text-zinc-400">Нет записи — создайте первую.</div>
      <div v-else class="mt-3 space-y-2">
        <div v-for="item in filteredItems(mgr.items.value)" :key="item.id" class="rounded-2xl border border-stone-200 dark:border-zinc-700 p-3">
          <div class="flex items-center gap-2 min-w-0">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-bold truncate dark:text-white">{{ item.title }}</div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ (item.body || '').slice(0, 90) }}</div>
            </div>
            <Tag :value="item.is_published ? 'видно всем' : 'черновик'" :severity="item.is_published ? 'success' : 'secondary'" class="!text-[9px]" />
          </div>
          <div v-if="item.attachments?.length" class="mt-2 flex flex-wrap gap-1.5">
            <a
              v-for="(file, fileIndex) in item.attachments"
              :key="fileIndex"
              :href="file.url"
              target="_blank"
              class="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 rounded-full px-2.5 py-1 hover:underline"
            >
              <i class="pi pi-paperclip text-[10px]" />{{ file.name }}
            </a>
          </div>
          <div class="mt-2 flex items-center gap-2 flex-wrap">
            <span class="flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-400">Публикация <ToggleSwitch :modelValue="!!item.is_published" @update:modelValue="(toggleValue:boolean)=>mgr.togglePublish(item, toggleValue)" /></span>
            <span class="flex-1" />
            <Button icon="pi pi-paperclip" size="small" rounded outlined :loading="mgr.uploading.value" @click="askFile(item)" />
            <Button icon="pi pi-pencil" size="small" rounded outlined @click="mgr.openEdit(item)" />
          </div>
          <div v-if="item.attachments?.length" class="mt-2 space-y-1">
            <div v-for="(file, fileIndex) in item.attachments" :key="fileIndex" class="flex items-center gap-2 text-[11px] text-stone-500 dark:text-zinc-400">
              <span class="truncate flex-1">{{ file.name }}</span>
              <Button icon="pi pi-times" size="small" rounded text severity="danger" @click="mgr.removeFile(item, fileIndex)" />
            </div>
          </div>
        </div>
      </div>

      <Dialog
        v-model:visible="mgr.showDialog.value"
        modal
        :header="dialogTitles[mgr.formSlug.value] ?? 'Справочная страница'"
        :style="{ width: '720px', maxWidth: '96vw' }"
        :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-zinc-700 !bg-white dark:!bg-zinc-900' }, header: { class: '!bg-white dark:!bg-zinc-900 !text-ink-900 dark:!text-white !border-b !border-stone-200 dark:!border-zinc-800' }, content: { class: '!bg-white dark:!bg-zinc-900 !text-stone-700 dark:!text-zinc-200 !px-4 sm:!px-5' }, footer: { class: '!bg-white dark:!bg-zinc-900 !border-t !border-stone-200 dark:!border-zinc-800' } }"
      >
        <form class="space-y-3 py-1" @submit.prevent="mgr.save()">
          <div>
            <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Заголовок</label>
            <InputText v-model="mgr.title.value" v-bind="mgr.titleAttrs.value" placeholder="Заголовок страницы" :class="inputClass" :invalid="!!mgr.errors.value.title" maxlength="200" />
            <small v-if="mgr.errors.value.title" class="text-red-500 text-[11px]">{{ mgr.errors.value.title }}</small>
          </div>

          <div>
            <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Текст страницы</label>
            <Textarea v-model="mgr.body.value" v-bind="mgr.bodyAttrs.value" rows="8" autoResize placeholder="Основной текст страницы..." :class="inputClass" :invalid="!!mgr.errors.value.body" maxlength="100000" />
            <small v-if="mgr.errors.value.body" class="text-red-500 text-[11px]">{{ mgr.errors.value.body }}</small>
          </div>

          <template v-if="mgr.formSlug.value === 'privacy' || mgr.formSlug.value === 'offer'">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Версия документа</label>
                <InputText v-model="mgr.version.value" v-bind="mgr.versionAttrs.value" placeholder="Например: 1.0" :class="inputClass" :invalid="!!mgr.errors.value.version" maxlength="50" />
                <small v-if="mgr.errors.value.version" class="text-red-500 text-[11px]">{{ mgr.errors.value.version }}</small>
              </div>
              <div>
                <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Дата вступления в силу</label>
                <InputText v-model="mgr.effectiveDate.value" v-bind="mgr.effectiveDateAttrs.value" placeholder="Например: 01.01.2026" :class="inputClass" :invalid="!!mgr.errors.value.effective_date" maxlength="20" />
                <small v-if="mgr.errors.value.effective_date" class="text-red-500 text-[11px]">{{ mgr.errors.value.effective_date }}</small>
              </div>
            </div>
          </template>

          <template v-if="mgr.formSlug.value === 'contacts' || mgr.formSlug.value === 'offer'">
            <div class="text-xs font-bold tracking-widest uppercase text-stone-400 pt-1">Данные организации</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Компания (ООО)<span v-if="mgr.formSlug.value === 'contacts'" class="text-red-500"> *</span></label>
                <InputText v-model="mgr.companyName.value" v-bind="mgr.companyNameAttrs.value" placeholder="ООО «Пример»" :class="inputClass" :invalid="!!mgr.errors.value.company_name" maxlength="200" />
                <small v-if="mgr.errors.value.company_name" class="text-red-500 text-[11px]">{{ mgr.errors.value.company_name }}</small>
              </div>
              <div>
                <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">ИНН<span v-if="mgr.formSlug.value === 'contacts'" class="text-red-500"> *</span></label>
                <InputText v-model="mgr.inn.value" v-bind="mgr.innAttrs.value" placeholder="7700000000" :class="inputClass" :invalid="!!mgr.errors.value.inn" maxlength="12" />
                <small v-if="mgr.errors.value.inn" class="text-red-500 text-[11px]">{{ mgr.errors.value.inn }}</small>
              </div>
              <div>
                <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">ОГРН<span v-if="mgr.formSlug.value === 'contacts'" class="text-red-500"> *</span></label>
                <InputText v-model="mgr.ogrn.value" v-bind="mgr.ogrnAttrs.value" placeholder="1200000000000" :class="inputClass" :invalid="!!mgr.errors.value.ogrn" maxlength="15" />
                <small v-if="mgr.errors.value.ogrn" class="text-red-500 text-[11px]">{{ mgr.errors.value.ogrn }}</small>
              </div>
              <div>
                <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Телефон<span v-if="mgr.formSlug.value === 'contacts'" class="text-red-500"> *</span></label>
                <InputText v-model="mgr.phone.value" v-bind="mgr.phoneAttrs.value" placeholder="+7 ..." :class="inputClass" :invalid="!!mgr.errors.value.phone" maxlength="50" />
                <small v-if="mgr.errors.value.phone" class="text-red-500 text-[11px]">{{ mgr.errors.value.phone }}</small>
              </div>
              <div>
                <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Email<span v-if="mgr.formSlug.value === 'contacts'" class="text-red-500"> *</span></label>
                <InputText v-model="mgr.email.value" v-bind="mgr.emailAttrs.value" placeholder="info@example.com" :class="inputClass" :invalid="!!mgr.errors.value.email" maxlength="200" />
                <small v-if="mgr.errors.value.email" class="text-red-500 text-[11px]">{{ mgr.errors.value.email }}</small>
              </div>
              <div>
                <label class="text-xs font-bold text-stone-500 dark:text-zinc-400">Адрес<span v-if="mgr.formSlug.value === 'contacts'" class="text-red-500"> *</span></label>
                <InputText v-model="mgr.address.value" v-bind="mgr.addressAttrs.value" placeholder="г. ..., ул. ..." :class="inputClass" :invalid="!!mgr.errors.value.address" maxlength="500" />
                <small v-if="mgr.errors.value.address" class="text-red-500 text-[11px]">{{ mgr.errors.value.address }}</small>
              </div>
            </div>
          </template>

          <label class="flex items-center gap-2 text-sm cursor-pointer dark:text-zinc-200"><ToggleSwitch v-model="mgr.isPublished.value" v-bind="mgr.isPublishedAttrs.value" /> Опубликовать сразу</label>
        </form>
        <template #footer>
          <Button label="Отмена" text @click="mgr.showDialog.value = false" />
          <Button :label="mgr.editingId.value ? 'Сохранить' : 'Создать'" rounded type="submit" :loading="mgr.saving.value" :disabled="!mgr.meta.value.dirty || !mgr.meta.value.valid" @click="mgr.save()" />
        </template>
      </Dialog>
    </template>
  </Card>
</template>
