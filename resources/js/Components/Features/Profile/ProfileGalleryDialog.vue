<script setup lang="ts">
import AppImage from '@/Components/Ui/Media/AppImage.vue'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

defineProps<{ gallery: any; isOwn: boolean; plan?: string }>()

const emit = defineEmits<{
  (e: 'make-main', photo: any): void
}>()
</script>
<template>
  <Dialog :visible="gallery.dialogOpen.value" @update:visible="(v:boolean)=>{ if(!v) gallery.closeDialog() }" modal dismissableMask :closable="true" :draggable="false" :breakpoints="{ '960px': '94vw', '640px': '100vw' }" :style="{ width: '760px' }" class="!rounded-3xl max-sm:!rounded-b-none" :pt="{ root: { class: 'max-sm:!m-0' }, mask: { class: 'max-sm:!items-end' }, content: { class: '!p-0' }, header: { class: '!py-3 !px-3 sm:!px-5' } }">
    <template #header>
      <span class="flex-1" />
    </template>
    <div class="px-3 sm:px-5 pb-[max(1rem,var(--sab))] max-h-[78dvh] overflow-y-auto overscroll-contain viewer-fullscreen-scroll">
      <p v-if="isOwn && gallery.isFull.value" class="text-xs text-stone-500 mt-1">Лимит {{ gallery.limit.value }} фото на тарифе{{ plan ? ` (${plan})` : '' }} — удали что-то, чтобы добавить новое.</p>
      <p v-else-if="isOwn" class="text-xs text-stone-500 mt-1">Осталось мест: {{ gallery.remaining.value }} из {{ gallery.limit.value }}.</p>
      <Message v-if="gallery.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ gallery.error.value }}</Message>
      <div v-if="gallery.loading.value" class="grid place-items-center py-10"><ProgressSpinner class="!w-8 !h-8" /></div>
      <div v-else-if="!gallery.photos.value.length" class="text-center py-10 text-stone-500 dark:text-zinc-400">
        <i class="pi pi-image text-3xl opacity-40" />
        <p class="text-sm mt-2 font-semibold">Пока пусто</p>
        <p class="text-xs mt-1">{{ isOwn ? 'Загрузи первое фото — оно появится здесь коллажем как в Instagram.' : 'Пользователь пока не добавил фото.' }}</p>
      </div>
      <div v-else class="grid grid-cols-3 gap-1 mt-3 sm:grid-cols-4 sm:gap-2 sm:auto-rows-[140px]">
        <button v-for="(p, i) in gallery.photos.value" :key="p.id" type="button" @click="gallery.open(p)" :class="['group relative aspect-square sm:aspect-auto overflow-hidden rounded-xl bg-stone-100 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-violet-500', gallery.mosaicClass(i)]" :title="p.caption || 'Фото'">
          <AppImage :src="p.url" :alt="p.caption || 'Фото'" class="block w-full h-full" img-class="block w-full h-full object-cover object-center select-none" />
          <span class="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition hidden sm:flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 text-white text-sm font-bold">
            <span class="flex items-center gap-1"><i :class="p.liked ? 'pi pi-heart-fill' : 'pi pi-heart'" />{{ p.likes_count }}</span>
            <span class="flex items-center gap-1"><i class="pi pi-comment" />{{ p.comments_count }}</span>
          </span>
          <span class="absolute inset-x-0 bottom-0 sm:hidden flex items-center gap-2.5 px-2 py-1.5 bg-gradient-to-t from-black/65 to-transparent text-white text-[11px] font-bold">
            <span class="flex items-center gap-1"><i :class="p.liked ? 'pi pi-heart-fill' : 'pi pi-heart'" class="text-[11px]" />{{ p.likes_count }}</span>
            <span class="flex items-center gap-1"><i class="pi pi-comment text-[11px]" />{{ p.comments_count }}</span>
          </span>
          <span v-if="p.liked && !(isOwn && !p.is_main)" class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 hidden sm:grid place-items-center text-white"><i class="pi pi-heart-fill text-[11px]" /></span>
          <span v-if="p.is_main" class="absolute left-1.5 top-1.5 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow">Главная</span>
          <span
            v-else-if="isOwn"
            role="button"
            tabindex="0"
            title="Сделать главной"
            aria-label="Сделать фото главной"
            class="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white transition hover:bg-violet-600 active:scale-95 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            @click.stop="emit('make-main', p)"
            @keydown.enter.stop.prevent="emit('make-main', p)"
          ><i class="pi pi-star text-xs" /></span>
        </button>
      </div>
    </div>
  </Dialog>
</template>
