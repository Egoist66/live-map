<script setup lang="ts">
import AppImage from '@/Components/Ui/Media/AppImage.vue'

defineProps<{
  photos: any[]
  loading: boolean
  addSlots: number
  uploading: boolean
  isOwn?: boolean
  mainBusy?: boolean
}>()

const emit = defineEmits<{
  (e: 'all'): void
  (e: 'open', photo: any): void
  (e: 'add'): void
  (e: 'make-main', photo: any): void
}>()
</script>

<template>
  <section class="rounded-[24px] border border-stone-200 bg-white shadow-soft p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex items-center justify-between">
      <h2 class="text-lg sm:text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">UGallery</h2>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone-500 transition hover:text-ink-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        @click="emit('all')"
      >
        Все фото <i class="pi pi-arrow-right text-xs"></i>
      </button>
    </div>

    <div v-if="loading && !photos.length" class="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
      <div v-for="n in 8" :key="`sk-${n}`" class="aspect-square animate-pulse rounded-xl bg-stone-200/70 dark:bg-zinc-800"></div>
    </div>
    <div v-else-if="photos.length || addSlots > 0 || uploading" class="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
      <button
        v-for="photo in photos"
        :key="photo.id"
        type="button"
        class="group relative aspect-square overflow-hidden rounded-xl bg-stone-100 transition active:scale-[0.97] dark:bg-zinc-800"
        @click="emit('open', photo)"
      >
        <!-- Сетка ~84px: грузим превью 480px (~40КБ), а не оригинал 1440px
             (~400КБ) — Lighthouse `image-delivery-insight`. thumb_url нет
             у старых фото (до бэкфилла) — откат на оригинал. aspect-square
             + размеры держат место (CLS). -->
        <AppImage :src="photo.thumb_url || photo.url" :alt="photo.caption || 'фото'" class="h-full w-full" img-class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.06]" />
        <span class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 transition duration-300 group-hover:opacity-100"></span>
        <span v-if="photo.is_main" title="Главная" aria-label="Главная фотография" class="absolute left-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-violet-600 text-white shadow"><i class="pi pi-star-fill text-xs" /></span>
        <span
          v-else-if="isOwn"
          role="button"
          tabindex="0"
          title="Сделать главной"
          aria-label="Сделать фото главной"
          :aria-disabled="mainBusy"
          class="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white transition hover:bg-violet-600 active:scale-95"
          @click.stop="emit('make-main', photo)"
          @keydown.enter.stop.prevent="emit('make-main', photo)"
        ><i :class="mainBusy ? 'pi pi-spin pi-spinner text-xs' : 'pi pi-star text-xs'"></i></span>
        <span class="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-1 items-center justify-center gap-3 pb-2 text-[11px] font-bold text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span class="flex items-center gap-1"><i :class="photo.liked ? 'pi pi-heart-fill' : 'pi pi-heart'" class="text-[11px]"></i>{{ photo.likes_count || 0 }}</span>
          <span class="flex items-center gap-1"><i class="pi pi-comment text-[11px]"></i>{{ photo.comments_count || 0 }}</span>
        </span>
      </button>
      <div v-if="uploading" class="grid aspect-square place-items-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        <span class="flex flex-col items-center gap-1.5"><i class="pi pi-spin pi-spinner text-xl"></i><span class="text-[10px] font-bold">Загрузка…</span></span>
      </div>
      <button
        v-for="n in addSlots"
        :key="`add-${n}`"
        type="button"
        title="Добавить фото"
        aria-label="Добавить фото"
        class="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-stone-300 text-stone-400 transition hover:border-blue-500 hover:bg-blue-500/5 hover:text-blue-500 active:scale-[0.97] dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-blue-400 dark:hover:text-blue-400"
        @click="emit('add')"
      >
        <span class="grid place-items-center"><i class="pi pi-plus text-xl"></i></span>
      </button>
    </div>
    <p v-else class="mt-3 rounded-2xl border border-dashed border-stone-300 px-4 py-6 text-center text-[13px] text-stone-500 dark:border-zinc-700 dark:text-zinc-400">
      Пока нет фотографий
    </p>
  </section>
</template>
