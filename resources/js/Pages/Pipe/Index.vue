<script setup lang="ts">
/**
 * Лента Pipes (/pipe) — Threads-подобный поток постов про отношения.
 *
 * Компонент — чистое отображение: вся логика в usePipeFeed/usePipeComposer.
 * Гость читает ленту; действия (композер, лайк, жалоба) ведут на логин.
 *
 * Свой layout задан явно (defineOptions), иначе персистентная обёртка
 * рендерит AuthenticatedLayout поверх мини-сайта — ULove-шапку с навбаром.
 */
import { computed, h, onMounted, ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import PipeThreadCard from '@/Components/Features/Pipe/PipeThreadCard.vue'
import PipeLayout from '@/Layouts/PipeLayout.vue'
import { usePipeFeed } from '@/composables/usePipeFeed'
import { usePipeComposer } from '@/composables/usePipeComposer'
import { usePipeFeedList } from '@/composables/usePipeFeedList'
import { usePipeShare } from '@/composables/usePipeShare'
import { pipeRoute } from '@/services/pipe.routes'
import type { PipeFilter, PipeThread } from '@/types/pipe'

defineOptions({
  layout: (createElement: typeof h, child: unknown) => createElement(PipeLayout, () => child),
})

const props = defineProps<{ threadId?: number | null }>()

const feed = usePipeFeed({ threadId: props.threadId ?? null })
const composer = usePipeComposer()
const { shareThread } = usePipeShare()
const composeOpen = ref(false)
const imagePicker = ref<{ clear: () => void } | null>(null)

const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Единый вид диалогов Pipe на мобилке и в тёмной теме:
 * скруглённая карта, на узких экранах — нижний лист на всю ширину
 * (важно перебить инлайновый width/maxWidth, иначе справа остаётся
 * зазор, как под скроллбар).
 */
const PIPE_DIALOG_PT = {
  root: { class: '!rounded-[24px] max-sm:!w-full max-sm:!max-w-full max-sm:!m-0 max-sm:!rounded-b-none max-sm:!bottom-0 max-sm:!top-auto max-sm:!translate-y-0 !border-stone-200 dark:!border-white/10 overflow-hidden !bg-white dark:!bg-[#0F121F]' },
  header: { class: '!p-5 !pb-0 !border-0' },
  title: { class: '!font-black !text-[17px] !tracking-tight' },
  content: { class: '!px-5 !py-4' },
  footer: { class: '!px-5 !pb-5 !pt-0 !border-0 !flex !gap-2' },
}

const editLeftLabel = computed(() => String(feed.editLeft.value))
const editOpen = computed(() => feed.editing.value !== null)
const hasFeed = computed(() => feed.store.threads.length > 0)

const feedHasMore = computed(() => feed.store.page < feed.store.lastPage)

/**
 * Списочная механика ленты: нативный скролл-контейнер фиксированной
 * высоты (см. .pipe-feed-viewport в <style>) + догрузка по sentinel.
 * Динамический VirtualScroller PrimeVue с мутирующим списком
 * (prepend/удаление/realtime) работает нестабильно — показывал
 * стоп-кадр из 3 карточек без скролла, поэтому заменён на обычный
 * v-for + IntersectionObserver, как во всех лентах приложения.
 */
const list = usePipeFeedList({
  store: feed.store,
  hasMore: () => feedHasMore.value,
  loadMore: () => feed.store.loadMoreThreads(),
})

/** Иконка нижнего таб-бара по вкладке (нативная навигация телефона). */
function tabIcon(value: PipeFilter): string {
  if (value === 'mine') return 'pi pi-user'
  if (value === 'saved') return 'pi pi-bookmark'
  return 'pi pi-align-left'
}

/** Поиск с дебаунсом: поллинг-пинает перезагрузку ленты. */
function onSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => feed.setSearch(searchInput.value.trim()), 400)
}

/** Кнопка «Ответить» на карточке: SPA-переход на страницу pipe. */
function openThread(thread: PipeThread): void {
  router.visit(pipeRoute('show', { thread: thread.id }))
}

function openCompose(): void {
  if (feed.isGuest.value) return feed.promptLogin()
  composer.reset()
  composeOpen.value = true
}

/** Открыть правку карточки (кнопка карандаш → usePipeFeed.startEdit). */
function openEdit(thread: PipeThread): void {
  feed.startEdit(thread)
}

/** Выбраны картинки в композере: сжать и добавить превью, сбросить выбор пикера. */
async function onPickImages(event: FileUploadSelectEvent): Promise<void> {
  await composer.addImages(event.files)
  imagePicker.value?.clear()
}

/** Опубликовать тред: true — бэк принял, диалог закрываем. */
async function submitCompose(): Promise<void> {
  const published = await composer.submit()
  if (published) composeOpen.value = false
}

/** Сохранить правку: true — бэк принял, форму закрываем. */
async function submitEdit(): Promise<void> {
  const saved = await feed.saveEdit()
  if (saved) feed.cancelEdit()
}

onMounted(() => {
  void feed.init()
})
</script>

<template>
  <Head title="Pipes — короткие посты про отношения и встречи" />
  <article class="pt-3 space-y-3">
    <header class="flex items-center justify-between gap-2">
      <div class="min-w-0">
        <h1 class="text-base font-black leading-tight tracking-tight sm:text-xl">
          <span class="sm:hidden">Поделитесь мыслями</span>
          <span class="hidden sm:inline">Делись своими мыслями и опытом</span>
        </h1>
      </div>
      <!-- Мобилка: круглый иконочный карандаш -->
      <Button
        icon="pi pi-pencil"
        outlined
        rounded
        aria-label="Новый pipe"
        class="shrink-0 !h-9 !w-9 !min-w-0 !p-0 sm:hidden"
        @click="openCompose"
      />
      <!-- Десктоп: кнопка с лейблом -->
      <!-- <Button
        label="Новый pipe"
        icon="pi pi-pencil"
        outlined
        rounded
        aria-label="Новый pipe"
        class="hidden sm:inline-flex"
        @click="openCompose"
      /> -->
    </header>

      <section class="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 max-w-full" aria-label="Поиск по ленте">
        <div class="hidden sm:block">
          <SelectButton
            :model-value="feed.store.filter"
            :options="feed.tabs.value"
            option-label="label"
            option-value="value"
            @update:model-value="feed.setFilter($event)"
          />
        </div>
        <span class="relative flex-1 min-w-0 w-full">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm" aria-hidden="true" />
          <InputText
            v-model="searchInput"
            @input="onSearch"
            placeholder="Поиск по pipes…"
            aria-label="Поиск по pipes"
            class="w-full !rounded-full !pl-9"
          />
        </span>
      </section>

      <div v-if="feed.store.authorId" class="flex items-center justify-between gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-300">
        <span>Pipes автора</span>
        <button class="underline hover:no-underline" @click="feed.clearAuthor()">Вся лента</button>
      </div>

      <div v-if="feed.store.loading" class="space-y-4" aria-busy="true" aria-label="Загрузка ленты">
        <div v-for="i in 3" :key="i" class="animate-pulse rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0F121F] p-5">
          <div class="h-4 w-1/3 rounded bg-stone-200 dark:bg-white/10" />
          <div class="mt-3 h-3 rounded bg-stone-100 dark:bg-white/[0.06]" />
          <div class="mt-2 h-3 w-2/3 rounded bg-stone-100 dark:bg-white/[0.06]" />
        </div>
      </div>

      <section
        v-else-if="!hasFeed"
        class="rounded-3xl border border-dashed border-stone-300 dark:border-white/10 bg-white dark:bg-[#0F121F] p-8 text-center"
      >
        <div class="text-3xl" aria-hidden="true">🧵</div>
        <h2 class="mt-2 font-bold text-stone-900 dark:text-white">Пока пусто</h2>
        <p class="mt-1 text-sm text-stone-500 dark:text-zinc-400">Создайте первый pipe — темы любые: первые свидания, доверие, истории со встречи.</p>
        <Button v-if="!feed.isGuest.value" label="Написать pipe" rounded class="mt-4" icon="pi pi-pencil" @click="openCompose" />
      </section>

      <!--
        Лента: нативный скролл-контейнер фиксированной высоты
        (.pipe-feed-viewport — вьюпорт минус шапка/поиск/таб-бар).
        Карточки — обычный v-for (DOM ограничен загруженными страницами),
        догрузка — sentinel в потоке + кнопка «Показать ещё».
      -->
      <section
        v-else
        :ref="list.scrollEl"
        class="pipe-feed-viewport relative overflow-y-auto overscroll-contain"
        aria-label="Список pipes"
      >
        <div class="w-full max-w-[540px] mx-auto">
          <!--
            Удаление с эффектом: во время запроса (removingIds) карточка
            блюрится и прижимается, после ответа бэка плавно гаснет и
            вылетает из списка. pointer-events-none — чтобы нельзя было
            дожать лайк/ответ по уходящей карточке.
          -->
          <div
            v-for="thread in feed.store.threads"
            :key="thread.id"
            class="w-full pb-3 transform-gpu transition-all duration-[500ms] ease-out"
            :class="feed.removingIds.value[thread.id] ? 'pointer-events-none scale-[0.97] opacity-0 blur-md' : 'opacity-100'"
          >
            <PipeThreadCard
              :thread="thread"
              :is-guest="feed.isGuest.value"
              :like-busy="Boolean(feed.likeBusy.value[thread.id])"
              :save-busy="Boolean(feed.saveBusy.value[thread.id])"
              @like="feed.toggleLike($event)"
              @save="feed.toggleSave($event)"
              @share="shareThread($event)"
              @delete="feed.removeThread($event)"
              @reply="openThread"
              @report="feed.reportThread(thread, $event)"
              @edit="openEdit"
            />
          </div>

          <InfiniteSentinel
            :sentinel="list.sentinel"
            :has-more="feedHasMore"
            :loading="Boolean(feed.store.loadingMore)"
          />

          <div v-if="feedHasMore && !feed.store.loadingMore" class="flex justify-center pb-3">
            <Button
              label="Показать ещё"
              rounded
              outlined
              size="small"
              @click="feed.store.loadMoreThreads()"
            />
          </div>
        </div>
      </section>

      <div class="h-4 sm:hidden" aria-hidden="true" />
    </article>

    <!-- Нижний таб-бар: нативная навигация телефона (только мобильные) -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/80 dark:border-white/10 bg-white/95 dark:bg-[#0F121F]/95 backdrop-blur-md sm:hidden"
      aria-label="Разделы ленты Pipes"
    >
      <div class="mx-auto flex max-w-[540px] items-stretch">
        <button
          v-for="tab in feed.tabs.value"
          :key="tab.value"
          type="button"
          class="flex flex-1 flex-col items-center gap-0.5 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] transition active:scale-95"
          :aria-current="feed.store.filter === tab.value ? 'page' : undefined"
          :aria-label="tab.label"
          @click="feed.setFilter(tab.value)"
        >
          <i
            :class="[tabIcon(tab.value), feed.store.filter === tab.value ? 'text-rose-600 dark:text-rose-400' : 'text-stone-400 dark:text-zinc-500']"
            class="text-lg"
            aria-hidden="true"
          />
          <span
            :class="feed.store.filter === tab.value ? 'font-bold text-rose-600 dark:text-rose-400' : 'font-semibold text-stone-500 dark:text-zinc-400'"
            class="text-[10px] leading-none"
          >
            {{ tab.label }}
          </span>
        </button>

        <!-- Возврат из Pipes в свой профиль ULove (на мобилке) -->
        <button
          type="button"
          class="flex flex-1 flex-col items-center gap-0.5 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] transition active:scale-95"
          :aria-label="feed.me.value ? 'Мой профиль в ULove' : 'Войти в ULove'"
          @click="feed.openMyProfile()"
        >
          <i class="pi pi-user text-lg text-stone-400 dark:text-zinc-500" aria-hidden="true" />
          <span class="text-[10px] font-semibold leading-none text-stone-500 dark:text-zinc-400">
            {{ feed.me.value ? 'Профиль' : 'Войти' }}
          </span>
        </button>
      </div>
    </nav>

    <Dialog
      v-model:visible="composeOpen"
      header="Новый pipe"
      modal
      :dismissable-mask="true"
      :close-on-escape="true"
      :style="{ width: '400px', maxWidth: '92vw' }"
      aria-label="Композер нового pipe"
      :pt="PIPE_DIALOG_PT"
    >
      <form class="space-y-3" @submit.prevent="submitCompose">
        <Textarea
          v-model="composer.body.value"
          :maxlength="500"
          auto-resize
          rows="4"
          placeholder="О чём поговорим? История, вопрос, совет…"
          class="w-full resize-none"
          aria-label="Текст нового pipe"
        />

        <div v-if="composer.images.value.length" class="flex flex-wrap gap-2">
          <div v-for="(image, index) in composer.images.value" :key="image.previewUrl" class="relative h-20 w-20">
            <img
              :src="image.previewUrl"
              alt=""
              class="h-full w-full rounded-xl border border-stone-200 object-cover dark:border-white/10"
            />
            <button
              type="button"
              class="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-stone-900/80 text-white shadow transition active:scale-90"
              aria-label="Убрать картинку"
              @click="composer.removeImage(index)"
            >
              <i class="pi pi-times text-[10px]" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 text-xs text-stone-400 dark:text-zinc-500">
          <FileUpload
            ref="imagePicker"
            mode="basic"
            custom-upload
            auto
            multiple
            accept="image/*"
            :max-file-size="10_000_000"
            :show-upload-button="false"
            choose-icon="pi pi-image"
            choose-label=" "
            :disabled="composer.freeSlots.value === 0"
            :aria-label="composer.freeSlots.value === 0 ? 'Лимит картинок достигнут' : 'Прикрепить картинки'"
            :pt="{
              root: { class: '!p-0' },
              pcChooseButton: { class: '!w-10 !h-10 !min-w-0 !p-0 !rounded-full !bg-transparent !border !border-stone-300 dark:!border-white/15 !text-stone-500 dark:!text-zinc-300 hover:!bg-stone-100 dark:hover:!bg-white/10' },
            }"
            @select="onPickImages"
          />
          <span class="tabular-nums" aria-live="polite">{{ composer.left.value }} символов осталось</span>
        </div>
        <label class="flex items-center justify-between rounded-2xl border border-stone-200 dark:border-white/10 px-3 py-2">
          <span class="min-w-0">
            <span class="block text-sm font-semibold">Опубликовать анонимно</span>
            <span class="block text-xs text-stone-500 dark:text-zinc-400">Аноним виден только вам</span>
          </span>
          <ToggleSwitch v-model="composer.isAnonymous.value" aria-label="Опубликовать анонимно" />
        </label>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" text rounded type="button" @click="composeOpen = false" />
          <Button
            label="Опубликовать"
            rounded
            type="submit"
            :disabled="!composer.canSubmit.value"
            :loading="composer.saving.value"
          />
        </div>
      </form>
    </Dialog>

    <Dialog
      :visible="editOpen"
      header="Редактировать pipe"
      modal
      :dismissable-mask="true"
      :close-on-escape="true"
      :style="{ width: '400px', maxWidth: '92vw' }"
      aria-label="Правка pipe"
      :pt="PIPE_DIALOG_PT"
      @update:visible="feed.cancelEdit()"
    >
      <form class="space-y-3" @submit.prevent="submitEdit">
        <Textarea
          v-model="feed.editText.value"
          :maxlength="500"
          auto-resize
          rows="4"
          placeholder="Текст pipe…"
          class="w-full resize-none"
          aria-label="Новый текст pipe"
        />
        <div class="flex items-center justify-between text-xs text-stone-400 dark:text-zinc-500">
          <span class="tabular-nums" aria-live="polite">{{ editLeftLabel }} символов осталось</span>
        </div>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" text rounded type="button" @click="feed.cancelEdit()" />
          <Button
            label="Сохранить"
            rounded
            type="submit"
            :disabled="feed.saving.value || feed.editText.value.trim().length === 0"
            :loading="feed.saving.value"
          />
        </div>
      </form>
    </Dialog>
</template>

<style scoped>
/*
 * Область скролла ленты: вьюпорт минус шапка, поиск и нижний таб-бар
 * (с safe-area). Задана обычным CSS, а не Tailwind-произвольным классом:
 * calc(100dvh-12.5rem-env(...)) без пробелов вокруг «−» — невалидный
 * CSS и браузер такое объявление отбрасывает (список схлопывался).
 */
.pipe-feed-viewport {
  height: calc(100dvh - 12.5rem - env(safe-area-inset-bottom));
}

@media (min-width: 640px) {
  .pipe-feed-viewport {
    height: calc(100dvh - 10rem);
  }
}

/*
 * Скролл внутри ленты невидим: полоса прокрутки скрыта (как в
 * Threads/Instagram), сама прокрутка — тач, колесо, клавиши — работает.
 */
.pipe-feed-viewport {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.pipe-feed-viewport::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* Табы фильтра на мобилке: одна строка с горизонтальным скроллом без скроллбара. */
:deep(.p-selectbutton) {
  flex-wrap: nowrap;
  max-width: 100%;
}

:deep(.p-togglebutton) {
  white-space: nowrap;
}
</style>
