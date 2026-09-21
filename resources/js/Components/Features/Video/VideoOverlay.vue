<script setup lang="ts">
import { computed } from 'vue'
import { useVideoSession } from '@/composables/useVideoSession'
import { reactionsApi } from '@/services/reactions.api'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Dialog from 'primevue/dialog'

/**
 * Оверлей видеозвонка: вход в рулетку, поиск, дозвон и активный звонок.
 * Компонент только отображает useVideoSession, логика — в хуке и сторе.
 */

const v = useVideoSession()

const overlayPt = {
  root: { class: '!rounded-3xl !border-0 !bg-white dark:!bg-zinc-950 overflow-hidden' },
  header: { class: '!bg-white dark:!bg-zinc-950 !border-0 !pb-1' },
  content: { class: '!p-0 !bg-white dark:!bg-zinc-950 !max-h-[82dvh] !overflow-y-auto' },
}

const isRoulette = computed(() => v.store.call?.mode === 'roulette')
const isCaller = computed(() => !!v.store.call?.is_caller)
const peerName = computed(() => v.store.call?.peer.name ?? v.store.incoming?.peer.name ?? 'Собеседник')
const hasNotice = computed(() => !!(v.store.error || v.store.info || v.notice.value))

const elapsedLabel = computed(() => {
  const total = v.store.elapsedSec
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
})

/**
 * Пожаловаться на собеседника рулетки и листать дальше.
 * Жалоба уходит в существующую модерацию (/api/reports).
 */
async function reportAndNext(): Promise<void> {
  const peerId = v.store.call?.peer.id
  if (peerId) {
    try {
      await reactionsApi.report('user', peerId, 'abuse', 'Видео-рулетка')
    } catch {}
  }
  await v.nextRoulette()
}

/**
 * Закрытие диалога крестиком: в поиске — выйти из очереди,
 * в звонке — диалог немодально не закрывается (только hangup).
 */
function onClose(): void {
  v.closeOverlay()
}
</script>

<template>
  <Dialog
    :visible="v.overlayOpen.value"
    modal
    :closable="!v.store.inCall"
    :draggable="false"
    appendTo="body"
    class="w-[calc(100vw-2rem)] max-w-[520px]"
    :pt="overlayPt"
    @update:visible="(open: boolean) => { if (!open) onClose() }"
  >
    <template #header>
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 grid place-items-center text-white shrink-0">
          <i class="pi pi-video text-sm" />
        </span>
        <span class="font-black text-stone-900 dark:text-white truncate">Видео</span>
        <Chip v-if="v.store.status === 'active'" :label="elapsedLabel" icon="pi pi-clock" class="!rounded-full !text-xs shrink-0" />
      </div>
    </template>

    <div class="bg-white dark:bg-zinc-950 text-stone-900 dark:text-white">
      <div v-if="v.store.error" class="mx-4 mt-1 rounded-2xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-300">
        {{ v.store.error }}
      </div>
      <div v-if="v.store.info || v.notice.value" class="mx-4 mt-1 rounded-2xl bg-sky-500/10 border border-sky-500/30 px-4 py-2.5 text-sm text-sky-700 dark:text-sky-300">
        {{ v.store.info || v.notice.value }}
      </div>

      <!-- Вход в рулетку / ошибка прямого звонка -->
      <div v-if="v.store.status === 'idle'" class="p-5 sm:p-6 text-center">
        <template v-if="v.store.entryContext === 'direct'">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-stone-200 dark:bg-zinc-800 grid place-items-center text-stone-500 dark:text-zinc-300">
            <i class="pi pi-phone text-2xl" />
          </div>
          <div class="mt-4 text-lg font-black">Не получилось позвонить</div>
          <div class="mt-4 flex justify-center">
            <Button label="Понятно" rounded outlined severity="secondary" @click="v.closeOverlay()" />
          </div>
        </template>
        <template v-else>
          <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 grid place-items-center text-white">
            <i class="pi pi-video text-2xl" />
          </div>
          <div class="mt-4 text-lg font-black">Видео-рулетка</div>
          <div class="mt-1 text-sm text-stone-500 dark:text-white/70">Случайный собеседник по видео. Free — 20 в день, PRO — безлимит.</div>
          <div class="mt-4 flex gap-2 justify-center flex-wrap">
            <Button
              label="Найти собеседника"
              icon="pi pi-play"
              rounded
              :loading="v.busy.value"
              class="!bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0"
              @click="v.joinRoulette()"
            />
            <Button v-if="hasNotice" label="Закрыть" rounded outlined severity="secondary" @click="v.closeOverlay()" />
          </div>
        </template>
      </div>

      <!-- Поиск пары -->
      <div v-else-if="v.store.status === 'searching'" class="p-4 sm:p-5">
        <div class="relative rounded-2xl overflow-hidden bg-zinc-900 aspect-video">
          <video
            :ref="(el) => v.setLocalEl(el)"
            autoplay
            playsinline
            muted
            class="absolute inset-0 w-full h-full object-cover mirror"
          />
          <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent flex items-center gap-2 text-white">
            <i class="pi pi-spin pi-spinner" />
            <span class="text-sm font-semibold">Ищем собеседника…</span>
          </div>
        </div>
        <div class="mt-1 text-center text-xs text-stone-400 dark:text-zinc-500">Это ты — собеседник увидит тебя после соединения</div>
        <div class="mt-3 flex justify-center">
          <Button label="Отмена" icon="pi pi-times" rounded outlined severity="secondary" @click="v.leaveRoulette()" />
        </div>
      </div>

      <!-- Дозвон -->
      <div v-else-if="v.store.status === 'ringing-out'" class="p-5 sm:p-6 text-center">
        <Avatar
          :image="v.store.call?.peer.avatar_url ?? undefined"
          :label="!v.store.call?.peer.avatar_url ? peerName.slice(0, 1) : undefined"
          shape="circle"
          class="!w-20 !h-20 !text-3xl"
        />
        <div class="mt-3 text-lg font-black">{{ peerName }}</div>
        <div class="mt-1 text-sm text-stone-500 dark:text-white/70 flex items-center justify-center gap-2">
          <i class="pi pi-spin pi-spinner" /> Соединяем…
        </div>
        <Button label="Отмена" icon="pi pi-times" rounded outlined severity="secondary" class="mt-4" @click="v.hangup()" />
      </div>

      <!-- Активный звонок -->
      <div v-else-if="v.store.status === 'active'" class="p-4 sm:p-5">
        <div class="relative rounded-2xl overflow-hidden bg-zinc-900 aspect-video">
          <video :ref="(el) => v.setRemoteEl(el)" autoplay playsinline class="absolute inset-0 w-full h-full object-cover" />
          <video
            :ref="(el) => v.setLocalEl(el)"
            autoplay
            playsinline
            muted
            class="absolute bottom-3 right-3 w-20 sm:w-24 aspect-[3/4] object-cover rounded-xl ring-2 ring-white/40 mirror"
          />
          <div class="absolute top-3 left-3 max-w-[70%]">
            <Chip :label="peerName" class="!rounded-full !bg-black/50 !text-white !border-0 !text-xs !max-w-full [&_.p-chip-label]:truncate" />
          </div>
        </div>
        <div v-if="v.peer.signalingError.value" class="mt-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2 flex-wrap">
          <span class="flex-1 min-w-[180px]">{{ v.peer.signalingError.value }}</span>
          <Button v-if="isCaller" label="Обновить" icon="pi pi-refresh" rounded outlined size="small" severity="warn" @click="v.peer.retry()" />
        </div>
        <div class="mt-3 flex items-center justify-center gap-2 flex-wrap">
          <Button
            :icon="v.store.muted ? 'pi pi-microphone-slash' : 'pi pi-microphone'"
            rounded
            :severity="v.store.muted ? 'danger' : 'secondary'"
            aria-label="Микрофон"
            title="Микрофон"
            @click="v.toggleMute()"
          />
          <Button
            :icon="v.store.camOff ? 'pi pi-video-slash' : 'pi pi-video'"
            rounded
            :severity="v.store.camOff ? 'danger' : 'secondary'"
            aria-label="Камера"
            title="Камера"
            @click="v.toggleCamera()"
          />
          <Button v-if="isRoulette" label="Дальше" icon="pi pi-arrow-right" rounded :loading="v.busy.value" @click="v.nextRoulette()" />
          <Button v-if="isRoulette" icon="pi pi-flag" rounded severity="warn" outlined aria-label="Пожаловаться" title="Пожаловаться и дальше" @click="reportAndNext()" />
          <Button icon="pi pi-phone" rounded severity="danger" aria-label="Завершить" title="Завершить" class="!bg-rose-600 !border-rose-600 rotate-[135deg]" @click="v.hangup()" />
        </div>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.mirror {
  transform: scaleX(-1);
}
</style>
