<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Dialog from 'primevue/dialog'
import { useProfileMenu } from '@/composables/useProfileMenu'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

const props = defineProps<{ userId: number | string; userName?: string; buttonClass?: string }>()
const emit = defineEmits<{ (e: 'share'): void; (e: 'block'): void; (e: 'remove'): void; (e: 'report'): void }>()

const pm = useProfileMenu()
const menuAnchor = pm.menu
const { menuPt } = useDropdownMenuStyle()

function onToggle(e: Event): void {
  pm.open(e, { id: props.userId, name: props.userName })
}

async function onShare(): Promise<void> {
  emit('share')
  await pm.share()
}

async function onCopy(): Promise<void> {
  await pm.copyLink()
}
</script>
<template>
  <span class="inline-flex shrink-0">
    <Button
      icon="pi pi-ellipsis-h"
      aria-label="Ещё"
      title="Ещё"
      :class="buttonClass || '!rounded-xl !w-11 shrink-0 !bg-violet-600/10 dark:!bg-violet-500/15 !border-0 !text-violet-600 dark:!text-violet-300'"
      @click="onToggle"
    />
    <Menu ref="menuAnchor" :model="[{ label: 'Поделиться профилем', icon: 'pi pi-share-alt', command: onShare }, { label: 'Скопировать ссылку', icon: 'pi pi-link', command: onCopy }, { label: 'Пожаловаться', icon: 'pi pi-flag', class: 'danger-item !text-red-600', command: () => emit('report') }, { separator: true }, { label: 'Заблокировать', icon: 'pi pi-ban', class: 'danger-item !text-red-600', command: () => emit('block') }, { label: 'Удалить из друзей', icon: 'pi pi-user-minus', class: 'danger-item !text-red-600', command: () => emit('remove') }]" :popup="true" :pt="menuPt" />
    <Dialog v-model:visible="pm.sheetOpen.value" position="bottom" :draggable="false" :modal="true" :dismissable-mask="true" :show-header="false" :pt="{ root: { class: '!rounded-t-[24px] !rounded-b-none !border-0 !m-0 !max-h-[80dvh] w-full sm:!max-w-[360px]' }, content: { class: '!p-2 !pb-[calc(0.5rem+var(--sab))]' } }">
      <div class="px-2 pb-2 space-y-1">
        <button type="button" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-stone-50 dark:hover:bg-white/5 text-[15px] font-medium text-left" @click="onShare"><i class="pi pi-share-alt text-violet-600"></i>Поделиться профилем</button>
        <button type="button" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-stone-50 dark:hover:bg-white/5 text-[15px] font-medium text-left" @click="onCopy"><i class="pi pi-link text-stone-500"></i>Скопировать ссылку</button>
        <button type="button" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 text-[15px] font-medium text-left text-red-600" @click="pm.close(); emit('report')"><i class="pi pi-flag"></i>Пожаловаться</button>
        <button type="button" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 text-[15px] font-medium text-left text-red-600" @click="pm.close(); emit('block')"><i class="pi pi-ban"></i>Заблокировать</button>
        <button type="button" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 text-[15px] font-medium text-left text-red-600" @click="pm.close(); emit('remove')"><i class="pi pi-user-minus"></i>Удалить из друзей</button>
        <button type="button" class="w-full px-4 py-3.5 rounded-2xl bg-stone-100 dark:bg-white/10 text-[15px] font-medium mt-1" @click="pm.close()">Отмена</button>
      </div>
    </Dialog>
  </span>
</template>
