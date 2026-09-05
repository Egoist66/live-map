<script setup lang="ts">
import Card from 'primevue/card'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import { avatarSrcFor } from '@/composables/useAvatar'

defineProps<{ admin: any }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Админ</h3>
      <p class="text-sm text-stone-500 mt-1">Скрытие профилей из поиска и удаление аккаунтов.</p>
      <div class="mt-5 space-y-4 max-w-xl">
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold dark:text-white">Скрыть мой профиль из поиска</div>
                <p class="text-xs text-stone-500 mt-1 leading-relaxed">Тебя не найдут через поиск, не откроют профиль и не увидят твои пины. Для остальных админов ты всё равно виден.</p>
              </div>
              <ToggleSwitch :modelValue="admin.selfHidden.value" @update:modelValue="(v:boolean)=>admin.toggleSelf(v)" :disabled="admin.selfLoading.value" class="shrink-0" :pt="{ root: { class: '!shrink-0' } }" />
            </div>
            <Message v-if="admin.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ admin.error.value }}</Message>
          </template>
        </Card>
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Скрыть / удалить чужой аккаунт</div>
            <p class="text-xs text-stone-500 mt-1">Найди по имени или email (мин. 2 символа). Скрытый пропадает из поиска, профиля и карты у обычных пользователей.</p>
            <div class="relative w-full mt-3">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm" />
              <input :value="admin.query.value" @input="admin.query.value = ($event.target as HTMLInputElement).value" placeholder="Имя или email..." class="w-full rounded-full border border-stone-200 pl-9 pr-9 py-2.5 text-sm outline-none focus:outline-none focus:border-stone-300 focus:ring-0 focus-visible:outline-none" />
              <i v-if="admin.searching.value" class="pi pi-spin pi-spinner absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm" />
            </div>
            <div v-if="admin.results.value.length" class="mt-3 divide-y border rounded-2xl overflow-hidden">
              <div v-for="u in admin.results.value" :key="u.id" class="flex items-center justify-between gap-2 p-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  <Avatar :image="avatarSrcFor(u)" shape="circle" size="normal" class="!w-9 !h-9 [&_img]:object-cover" />
                  <div class="min-w-0">
                    <div class="text-sm font-medium truncate">{{ u.name }}</div>
                    <div class="text-xs text-stone-500 truncate">{{ u.email }} · {{ u.plan }}</div>
                    <Tag v-if="u.is_hidden_from_search" value="скрыт" class="!bg-stone-200 !text-stone-600 !border-0 !text-[9px] !mt-1" />
                  </div>
                </div>
                <div class="flex gap-1.5 shrink-0 items-center">
                  <Button @click="admin.toggleUser(u)" :loading="admin.togglingId.value === u.id" :label="u.is_hidden_from_search ? 'Показать' : 'Скрыть'" size="small" rounded :outlined="!u.is_hidden_from_search" class="!text-xs" :severity="u.is_hidden_from_search ? 'success' : 'secondary'" />
                  <Button @click="admin.askDelete(u)" :disabled="u.is_admin" icon="pi pi-trash" size="small" rounded outlined severity="danger" title="Удалить вообще" />
                </div>
              </div>
            </div>
            <div v-else-if="admin.query.value.trim().length >= 2 && !admin.searching.value" class="mt-3 text-center py-4 text-sm text-stone-500">Ничего не найдено</div>
          </template>
        </Card>
      </div>
      <Dialog :visible="!!admin.confirmDelete.value" @update:visible="(v:boolean)=>{ if(!v) admin.closeConfirm() }" modal header="Удалить аккаунт?" :style="{ width: '400px', maxWidth: '94vw' }">
        <p class="text-sm text-stone-600">Удалить <b>{{ admin.confirmDelete.value?.name }}</b> ({{ admin.confirmDelete.value?.email }}) вообще? Это нельзя отменить.</p>
        <template #footer>
          <Button label="Отмена" text @click="admin.closeConfirm()" />
          <Button label="Удалить" severity="danger" :loading="admin.deletingId.value !== null" @click="admin.doDelete()" />
        </template>
      </Dialog>
    </template>
  </Card>
</template>
