<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useVideoSession } from '@/composables/useVideoSession'
import { useVideoCallChat } from '@/composables/useVideoCallChat'
import { reactionsApi } from '@/services/reactions.api'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

/**
 * Оверлей видеозвонка: вход в рулетку, поиск, дозвон и активный звонок.
 * Компонент только отображает useVideoSession, логика — в хуке и сторе.
 */

const v = useVideoSession()
const callChat = useVideoCallChat(() => v.store.call?.id ?? null)
const chatOpen = ref(false)
const chatText = ref('')
const stageRef = ref<HTMLDivElement | null>(null)

watch(
  () => v.store.status,
  (next) => {
    if (next === 'idle') {
      chatOpen.value = false
      chatText.value = ''
      callChat.reset()
    }
  },
)

watch(chatOpen, (open) => {
  if (open) callChat.markRead()
})

const roomPt = {
  root: { class: '!rounded-3xl !border-0 !bg-white dark:!bg-zinc-950 overflow-hidden' },
  header: { class: '!bg-white dark:!bg-zinc-950 !border-0 !pb-1' },
  content: { class: '!p-0 !bg-white dark:!bg-zinc-950 !max-h-[88dvh] !overflow-y-auto' },
}

const isRoulette = computed(() => v.store.call?.mode === 'roulette')
const isCaller = computed(() => !!v.store.call?.is_caller)
const peerName = computed(() => v.store.call?.peer.name ?? v.store.incoming?.peer.name ?? 'Собеседник')
const hasNotice = computed(() => !!(v.store.error || v.store.info || v.notice.value))

/**
 * Режим комнаты рулетки: широкий диалог на весь экран с видео и чатом
 * рядом, как в чатрулетке/дискорде. Прямые звонки остаются компактными.
 */
const isRouletteRoom = computed(
  () =>
    v.rouletteAuto.value ||
    v.store.call?.mode === 'roulette' ||
    v.store.incoming?.mode === 'roulette' ||
    (v.store.entryContext === 'roulette' && v.store.status === 'searching'),
)

const dialogClass = computed(() =>
  isRouletteRoom.value ? 'w-[calc(100vw-1rem)] max-w-[1080px]' : 'w-[calc(100vw-2rem)] max-w-[520px]',
)

watch(
  () => callChat.messages.value.length,
  () => {
    if (isRouletteRoom.value) callChat.markRead()
  },
)

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
 * Отправить сообщение в чат звонка.
 */
async function sendChat(): Promise<void> {
  const ok = await callChat.send(chatText.value)
  if (ok) chatText.value = ''
}

/**
 * Уйти в приват: создать личный чат с собеседником и перейти туда.
 * Видео завершается, собеседник остаётся в списке чатов.
 */
async function goPrivate(): Promise<void> {
  await v.createPrivateChat()
}

/**
 * Развернуть сцену звонка во весь экран и обратно.
 * На iOS requestFullscreen для div нет — падаем назад
 * на нативный fullscreen самого <video> (webkitEnterFullscreen).
 */
async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await stageRef.value?.requestFullscreen()
  } catch {
    try {
      const remote = v.remoteRef.value as HTMLVideoElement | null
      const anyRemote = remote as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
      anyRemote?.webkitEnterFullscreen?.()
    } catch {}
  }
}

/**
 * Оверлей не показываем поверх входящего прямого звонка:
 * там работает диалог «Принять/Отклонить», а пустая шапка «Видео»
 * (телепорт в body позже диалога) перекрывала бы его кнопки.
 * В авто-рулетке входящего диалога нет — оверлей остаётся.
 */
const overlayVisible = computed(
  () => v.overlayOpen.value && !(v.store.status === 'ringing-in' && !v.rouletteAuto.value),
)

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
    :visible="overlayVisible"
    modal
    :closable="!v.store.inCall"
    :draggable="false"
    appendTo="body"
    :class="dialogClass"
    :pt="roomPt"
    @update:visible="(open: boolean) => { if (!open) onClose() }"
  >
    <template #header>
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 grid place-items-center text-white shrink-0">
          <i class="pi pi-video text-sm" />
        </span>
        <span class="font-black text-stone-900 dark:text-white truncate">{{ isRouletteRoom ? 'Рулетка' : 'Видео' }}</span>
        <Chip v-if="v.store.status === 'active'" :label="elapsedLabel" icon="pi pi-clock" class="!rounded-full !text-xs shrink-0" />
        <Chip
          v-if="isRouletteRoom && v.rouletteCount.value !== null && v.store.status !== 'active'"
          :label="`В рулетке: ${v.rouletteCount.value}`"
          icon="pi pi-users"
          class="!rounded-full !text-xs shrink-0"
        />
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
      <div v-if="v.store.status === 'idle'" class="relative p-5 sm:p-6 text-center">
        <Button
          icon="pi pi-times"
          rounded
          text
          severity="secondary"
          aria-label="Закрыть"
          title="Закрыть"
          class="!absolute !top-3 !right-3 !w-9 !h-9 !p-0"
          @click="v.closeOverlay()"
        />
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
          <div class="mt-1 text-sm text-stone-500 dark:text-white/70">Случайный собеседник по видео. Free — 5 в день, PRO — безлимит.</div>
          <div v-if="v.rouletteCount.value !== null" class="mt-2 flex justify-center">
            <Chip :label="`Сейчас в рулетке: ${v.rouletteCount.value}`" icon="pi pi-users" class="!rounded-full !text-xs" />
          </div>
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
        <div class="relative rounded-2xl overflow-hidden bg-zinc-900 aspect-video lg:aspect-[21/9]">
          <video
            :ref="(el) => v.setLocalEl(el)"
            autoplay
            playsinline
            muted
            class="absolute inset-0 w-full h-full object-cover mirror"
          />
          <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent flex items-center gap-2 text-white">
            <i class="pi pi-spin pi-spinner" />
            <span class="text-sm font-semibold">Ищем собеседника… соединим автоматически</span>
          </div>
        </div>
        <div class="mt-1 text-center text-xs text-stone-400 dark:text-zinc-500">Это ты — собеседник увидит тебя после соединения</div>
        <div class="mt-3 flex justify-center">
          <Button label="Отмена" icon="pi pi-times" rounded outlined severity="secondary" @click="v.leaveRoulette()" />
        </div>
      </div>

      <!-- Автосоединение пары рулетки (доли секунды, вместо диалога «Принять») -->
      <div v-else-if="v.store.status === 'ringing-in'" class="p-5 sm:p-6 text-center">
        <Avatar
          :image="v.store.incoming?.peer.avatar_url ?? undefined"
          :label="!v.store.incoming?.peer.avatar_url ? peerName.slice(0, 1) : undefined"
          shape="circle"
          class="!w-20 !h-20 !text-3xl"
        />
        <div class="mt-3 text-lg font-black">{{ peerName }}</div>
        <div class="mt-1 text-sm text-stone-500 dark:text-white/70 flex items-center justify-center gap-2">
          <i class="pi pi-spin pi-spinner" /> Соединяем с собеседником…
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

      <!-- Активный звонок: рулетка — комната на весь диалог, прямые — компактно -->
      <div v-else-if="v.store.status === 'active'" class="p-4 sm:p-5">
        <template v-if="isRouletteRoom">
          <div class="grid gap-3 lg:grid-cols-[1fr_320px]">
            <div>
              <div ref="stageRef" class="relative rounded-2xl overflow-hidden bg-zinc-900 aspect-video lg:aspect-auto lg:h-[46dvh] lg:min-h-[320px]">
                <video :ref="(el) => v.setRemoteEl(el)" autoplay playsinline class="absolute inset-0 w-full h-full object-cover" />
                <video
                  :ref="(el) => v.setLocalEl(el)"
                  autoplay
                  playsinline
                  muted
                  class="absolute bottom-3 right-3 w-20 sm:w-28 aspect-[3/4] object-cover rounded-xl ring-2 ring-white/40 mirror"
                />
                <div class="absolute top-3 left-3 max-w-[70%] flex gap-1.5 flex-wrap">
                  <Chip :label="peerName" class="!rounded-full !bg-black/50 !text-white !border-0 !text-xs !max-w-full [&_.p-chip-label]:truncate" />
                  <Chip v-if="v.peer.connectionState.value !== 'connected' && !v.peer.signalingError.value" label="Соединение…" icon="pi pi-spin pi-spinner" class="!rounded-full !bg-black/50 !text-amber-300 !border-0 !text-xs" />
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
                <Button icon="pi pi-sync" rounded severity="secondary" aria-label="Переключить камеру" title="Переключить камеру" @click="v.flipCamera()" />
                <Button
                  icon="pi pi-desktop"
                  rounded
                  :severity="v.sharing.value ? 'success' : 'secondary'"
                  aria-label="Демонстрация экрана"
                  title="Демонстрация экрана"
                  @click="v.sharing.value ? v.stopShare() : v.shareScreen()"
                />
                <Button icon="pi pi-expand" rounded severity="secondary" aria-label="Во весь экран" title="Во весь экран" @click="toggleFullscreen()" />
                <Button icon="pi pi-phone" rounded severity="danger" aria-label="Завершить" title="Завершить" class="!bg-rose-600 !border-rose-600 rotate-[135deg]" @click="v.hangup()" />
              </div>
              <div class="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <Button label="Дальше" icon="pi pi-arrow-right" rounded :loading="v.busy.value" class="!bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0 max-sm:flex-1" @click="v.nextRoulette()" />
                <Button label="В приват" icon="pi pi-send" rounded outlined severity="info" :loading="v.busy.value" title="Создать личный чат и перейти туда" class="max-sm:flex-1" @click="goPrivate()" />
                <Button icon="pi pi-flag" rounded severity="warn" outlined aria-label="Пожаловаться" title="Пожаловаться и дальше" @click="reportAndNext()" />
              </div>
              <div class="mt-2 text-center text-[11px] leading-snug text-stone-400 dark:text-zinc-500">Собеседник может записать разговор</div>
            </div>
            <div class="rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden flex flex-col min-h-[280px] lg:min-h-0 lg:max-h-[62dvh]">
              <div class="flex items-center gap-2 px-3 py-2.5 text-sm font-bold border-b border-stone-200 dark:border-zinc-800">
                <i class="pi pi-comments" />
                <span class="flex-1">Чат комнаты</span>
              </div>
              <div class="max-h-64 overflow-y-auto overscroll-contain p-3 lg:max-h-none lg:flex-1">
                <div v-if="callChat.messages.value.length" class="flex flex-col gap-1.5">
                  <div
                    v-for="m in callChat.messages.value"
                    :key="m.id"
                    class="max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words"
                    :class="m.mine ? 'self-end bg-violet-600 text-white rounded-br-md' : 'self-start bg-stone-100 dark:bg-zinc-800 rounded-bl-md'"
                  >
                    {{ m.text }}
                  </div>
                </div>
                <div v-else class="text-xs text-stone-400 dark:text-zinc-500">Поздоровайся и обменяйся контактами, не прерывая видео</div>
              </div>
              <div class="border-t border-stone-200 dark:border-zinc-800 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex gap-2">
                <InputText
                  v-model="chatText"
                  placeholder="Сообщение…"
                  maxlength="500"
                  class="flex-1 !rounded-full !text-base"
                  @keydown.enter="sendChat()"
                />
                <Button icon="pi pi-send" rounded aria-label="Отправить" :loading="callChat.sending.value" :disabled="!chatText.trim()" @click="sendChat()" />
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="relative rounded-2xl overflow-hidden bg-zinc-900 aspect-video">
            <video :ref="(el) => v.setRemoteEl(el)" autoplay playsinline class="absolute inset-0 w-full h-full object-cover" />
            <video
              :ref="(el) => v.setLocalEl(el)"
              autoplay
              playsinline
              muted
              class="absolute bottom-3 right-3 w-20 sm:w-24 aspect-[3/4] object-cover rounded-xl ring-2 ring-white/40 mirror"
            />
            <div class="absolute top-3 left-3 max-w-[70%] flex gap-1.5 flex-wrap">
              <Chip :label="peerName" class="!rounded-full !bg-black/50 !text-white !border-0 !text-xs !max-w-full [&_.p-chip-label]:truncate" />
              <Chip v-if="v.peer.connectionState.value !== 'connected' && !v.peer.signalingError.value" label="Соединение…" icon="pi pi-spin pi-spinner" class="!rounded-full !bg-black/50 !text-amber-300 !border-0 !text-xs" />
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
            <Button icon="pi pi-sync" rounded severity="secondary" aria-label="Переключить камеру" title="Переключить камеру (фронталка/тыльная)" @click="v.flipCamera()" />
            <Button
              icon="pi pi-desktop"
              rounded
              :severity="v.sharing.value ? 'success' : 'secondary'"
              aria-label="Демонстрация экрана"
              title="Демонстрация экрана"
              @click="v.sharing.value ? v.stopShare() : v.shareScreen()"
            />
            <Button icon="pi pi-expand" rounded severity="secondary" aria-label="Во весь экран" title="Во весь экран" @click="toggleFullscreen()" />
            <Button v-if="isRoulette" label="Дальше" icon="pi pi-arrow-right" rounded :loading="v.busy.value" @click="v.nextRoulette()" />
            <Button v-if="isRoulette" icon="pi pi-flag" rounded severity="warn" outlined aria-label="Пожаловаться" title="Пожаловаться и дальше" @click="reportAndNext()" />
            <Button icon="pi pi-phone" rounded severity="danger" aria-label="Завершить" title="Завершить" class="!bg-rose-600 !border-rose-600 rotate-[135deg]" @click="v.hangup()" />
          </div>
          <div class="mt-2 text-center text-[11px] leading-snug text-stone-400 dark:text-zinc-500">Собеседник может записать разговор</div>
          <div class="mt-3 rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden">
            <button class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-left" @click="chatOpen = !chatOpen">
              <i class="pi pi-comments" />
              <span class="flex-1">Чат звонка</span>
              <span v-if="callChat.unread.value > 0 && !chatOpen" class="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-black grid place-items-center">{{ callChat.unread.value }}</span>
              <i class="pi text-xs text-stone-400" :class="chatOpen ? 'pi-chevron-up' : 'pi-chevron-down'" />
            </button>
            <div v-if="chatOpen" class="border-t border-stone-200 dark:border-zinc-800 p-3">
              <div v-if="callChat.messages.value.length" class="max-h-40 overflow-y-auto flex flex-col gap-1.5 mb-2">
                <div
                  v-for="m in callChat.messages.value"
                  :key="m.id"
                  class="max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words"
                  :class="m.mine ? 'self-end bg-violet-600 text-white rounded-br-md' : 'self-start bg-stone-100 dark:bg-zinc-800 rounded-bl-md'"
                >
                  {{ m.text }}
                </div>
              </div>
              <div v-else class="mb-2 text-xs text-stone-400 dark:text-zinc-500">Обменяйтесь контактами, не прерывая видео</div>
              <div class="flex gap-2">
                <InputText
                  v-model="chatText"
                  placeholder="Сообщение…"
                  maxlength="500"
                  class="flex-1 !rounded-full"
                  @keydown.enter="sendChat()"
                />
                <Button icon="pi pi-send" rounded aria-label="Отправить" :loading="callChat.sending.value" :disabled="!chatText.trim()" @click="sendChat()" />
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.mirror {
  transform: scaleX(-1);
}
</style>
