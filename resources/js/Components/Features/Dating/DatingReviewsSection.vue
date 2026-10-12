<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { useDatingReviews } from '@/composables/useDatingReviews'
import { useProfileUrl } from '@/composables/useProfileUrl'
import ModeratedContent from '@/Components/Features/Moderation/ModeratedContent.vue'
import DatingRatingStars from '@/Components/Features/Dating/DatingRatingStars.vue'

const props = withDefaults(
  defineProps<{
    userId: number | null
    /** Готовая сводка с карточки: показываем сразу, список догружаем */
    seedAvg?: number | null
    seedCount?: number
    seedHidden?: boolean
    /** Смотрим свой профиль: подписи от первого лица */
    isOwn?: boolean
  }>(),
  { userId: null, seedAvg: null, seedCount: 0, seedHidden: false, isOwn: false },
)

const reviews = useDatingReviews(() => props.userId)

if (props.seedAvg != null || (props.seedCount ?? 0) > 0 || props.seedHidden) {
  reviews.summary.value = {
    avg: props.seedAvg,
    count: props.seedCount ?? 0,
    hidden: !!props.seedHidden,
  }
}

watch(
  () => props.userId,
  (id) => {
    if (id) {
      void reviews.load()
    }
  },
  { immediate: true },
)

const toast = (() => {
  try {
    return useToast()
  } catch {
    return null as any
  }
})()

const { userProfileUrl } = useProfileUrl()

/** Выбранные звёзды формы: стартуем с моей оценки. */
const picked = ref(0)

watch(
  () => reviews.myReview.value?.rating,
  (rating) => {
    if (typeof rating === 'number') {
      picked.value = rating
    }
  },
  { immediate: true },
)

const draft = ref('')

/** Текст моего отзыва для правки: подставляем при открытии формы. */
const editing = ref(false)

function startEdit(): void {
  picked.value = reviews.myReview.value?.rating ?? 0
  draft.value = reviews.myReview.value?.body ?? ''
  editing.value = true
}

function cancelEdit(): void {
  editing.value = false
  draft.value = ''
}

const bodyLeft = computed(() => 280 - draft.value.trim().length)

/** Звёзды заморожены: правится только текст, оценка шлётся пустой. */
const starsLocked = computed(() => reviews.starsLocked.value)

const canSave = computed(
  () =>
    draft.value.trim().length <= 280 &&
    !reviews.saving.value &&
    (starsLocked.value || (picked.value >= 1 && picked.value <= 5)),
)

async function onSave(): Promise<void> {
  const text = draft.value.trim()

  try {
    await reviews.save(starsLocked.value ? null : picked.value, text === '' ? null : text)
    editing.value = false
    draft.value = ''
    toast?.add({ severity: 'success', summary: 'Отзыв сохранён', detail: 'Спасибо за оценку', life: 2500 })
  } catch {
    toast?.add({ severity: 'error', summary: 'Не сохранилось', detail: reviews.error.value ?? 'Попробуй ещё раз', life: 3000 })
  }
}

async function onDelete(): Promise<void> {
  try {
    await reviews.remove()
    picked.value = 0
    editing.value = false
    toast?.add({ severity: 'success', summary: 'Отзыв удалён', life: 2500 })
  } catch {
    toast?.add({ severity: 'error', summary: 'Не удалилось', detail: reviews.error.value ?? 'Попробуй ещё раз', life: 3000 })
  }
}

/**
 * Короткая дата отзыва.
 */
function reviewDate(iso: string | null): string {
  if (!iso) return ''

  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}
</script>

<template>
  <div class="mt-4">
    <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Отзывы · рейтинг</div>

    <div v-if="reviews.loading.value" class="mt-2 flex items-center gap-2 text-xs text-stone-400 dark:text-zinc-500">
      <i class="pi pi-spin pi-spinner" aria-label="Загрузка отзывов" /> Грузим отзывы…
    </div>

    <template v-else>
      <div v-if="reviews.visible.value && (reviews.average.value != null || reviews.count.value > 0)" class="mt-2 flex items-center gap-2">
        <DatingRatingStars :avg="reviews.average.value" :count="reviews.count.value" tone="light" />
        <span class="text-xs text-stone-400 dark:text-zinc-500">{{ reviews.total.value > reviews.items.value.length ? ` · всего ${reviews.total.value}` : '' }}</span>
      </div>
      <p v-else-if="!reviews.visible.value" class="mt-2 text-xs text-stone-400 dark:text-zinc-500">{{ isOwn ? 'Ты скрыл(а) свой рейтинг (PRO).' : 'Человек скрыл свой рейтинг (PRO).' }}</p>
      <p v-else class="mt-2 text-xs text-stone-400 dark:text-zinc-500">Пока без оценок — стань первым, кто оценит после общения.</p>

      <div v-if="reviews.visible.value && reviews.items.value.length" class="mt-3 space-y-2">
        <div
          v-for="item in reviews.items.value"
          :key="item.id"
          class="rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-3 py-2.5"
        >
          <div class="flex items-center gap-2 min-w-0">
            <Avatar :image="item.author?.avatar_url ?? undefined" :label="!item.author?.avatar_url ? (item.author?.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-7 !h-7 !text-xs shrink-0" />
            <Link
              v-if="item.author"
              :href="userProfileUrl({ id: item.author.id, profile_slug: item.author.profile_slug })"
              class="min-w-0 flex-1 truncate text-[13px] font-bold text-stone-800 dark:text-zinc-100 hover:underline"
            >{{ item.author.name }}</Link>
            <span class="inline-flex items-center gap-0.5 text-amber-400 shrink-0" aria-hidden="true">
              <i v-for="i in 5" :key="i" :class="['text-[10px]', i <= item.rating ? 'pi pi-star-fill' : 'pi pi-star']" />
            </span>
            <span class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0">{{ reviewDate(item.created_at) }}</span>
          </div>
          <div v-if="item.body" class="mt-1.5 text-[13px] leading-snug text-stone-600 dark:text-zinc-300">
            <ModeratedContent :text="item.body" :moderation="item.moderation" />
          </div>
        </div>

        <Button
          v-if="reviews.hasMore.value"
          label="Показать ещё"
          text
          size="small"
          :loading="reviews.loadingMore.value"
          class="!px-0 !text-xs"
          @click="reviews.loadMore()"
        />
      </div>

      <div v-if="reviews.canReview.value" class="mt-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/70 dark:border-zinc-800 px-3 py-2.5">
        <div v-if="!editing && reviews.myReview.value" class="flex items-center gap-2">
          <span class="flex-1 text-xs text-stone-500 dark:text-zinc-400 min-w-0">Твоя оценка: <b class="text-amber-500">{{ reviews.myReview.value.rating }} ★</b><span v-if="reviews.myReview.value.body"> — «{{ reviews.myReview.value.body.slice(0, 60) }}»</span></span>
          <Button label="Изменить" text size="small" class="!px-2 !text-xs shrink-0" @click="startEdit()" />
          <Button v-if="reviews.isAdmin.value" icon="pi pi-trash" text severity="danger" size="small" class="!w-8 !h-8 !p-0 shrink-0" aria-label="Удалить отзыв" title="Удалить отзыв" :loading="reviews.saving.value" @click="onDelete()" />
        </div>

        <div v-else-if="!editing" class="flex items-center gap-2">
          <span class="flex-1 text-xs text-stone-500 dark:text-zinc-400">Вы общались — оцени человека</span>
          <Button label="Оценить" size="small" rounded class="!border-0 !bg-gradient-to-r !from-[#FD267D] !to-[#FF7854] !text-white" @click="startEdit()" />
        </div>

        <div v-else>
          <div v-if="starsLocked" class="flex items-center gap-1" aria-label="Оценка поставлена">
            <span class="inline-flex items-center gap-0.5 text-amber-400" aria-hidden="true">
              <i v-for="i in 5" :key="i" :class="['text-xl', i <= (reviews.myReview.value?.rating ?? 0) ? 'pi pi-star-fill' : 'pi pi-star']" />
            </span>
            <span class="ml-1 text-xs font-bold text-stone-500 dark:text-zinc-400">{{ reviews.myReview.value?.rating }} из 5 · звёзды уже поставлены</span>
          </div>
          <div v-else class="flex items-center gap-1" role="radiogroup" aria-label="Оценка">
            <button
              v-for="i in 5"
              :key="i"
              type="button"
              role="radio"
              :aria-checked="picked === i"
              :aria-label="`${i} из 5`"
              class="p-1 active:scale-90 transition"
              @click="picked = i"
            >
              <i :class="['text-xl', i <= picked ? 'pi pi-star-fill text-amber-400' : 'pi pi-star text-stone-300 dark:text-zinc-600']" />
            </button>
            <span v-if="picked > 0" class="ml-1 text-xs font-bold text-stone-500 dark:text-zinc-400">{{ picked }} из 5</span>
          </div>
          <Textarea
            v-model="draft"
            rows="2"
            maxlength="280"
            placeholder="Пара слов о человеке (необязательно)"
            class="w-full mt-2 !rounded-xl !text-sm"
          />
          <div class="mt-1.5 flex items-center gap-2">
            <span class="flex-1 text-[11px] text-stone-400 dark:text-zinc-500">Осталось {{ bodyLeft }}</span>
            <Button label="Отмена" text size="small" class="!text-xs" @click="cancelEdit()" />
            <Button label="Сохранить" size="small" rounded :disabled="!canSave" :loading="reviews.saving.value" class="!border-0 !bg-gradient-to-r !from-[#FD267D] !to-[#FF7854] !text-white disabled:!opacity-50" @click="onSave()" />
          </div>
        </div>
      </div>

      <Message v-if="reviews.error.value" severity="error" :closable="false" class="mt-2 !text-xs">{{ reviews.error.value }}</Message>
    </template>
  </div>
</template>
