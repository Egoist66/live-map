<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useVideoSession } from '@/composables/useVideoSession'
import { useVideoCallChat } from '@/composables/useVideoCallChat'
import { reactionsApi } from '@/services/reactions.api'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

/**
 * Оверлей голосового звонка: вход в рулетку, поиск, дозвон и активный звонок.
 * Компонент только отображает useVideoSession, логика — в хуке и сторе.
 */

const v = useVideoSession()
const callChat = useVideoCallChat(() => v.store.call?.id ?? null)
const chatText = ref('')

/**
 * Стабильный ref-колбэк удалённого звука (не инлайн-стрелка): инлайн
 * создавал новую функцию каждый ре-рендер и Vue перецеплял srcObject.
 */
const setRemoteEl = (el: unknown): void => v.setRemoteEl(el)

watch(
  () => v.store.status,
  (next) => {
    if (next === 'idle') {
      chatText.value = ''
      callChat.reset()
    }
  },
)

const roomPt = {
  root: { class: '!rounded-3xl max-sm:!rounded-b-none !border-0 !bg-white dark:!bg-black/20 overflow-hidden' },
  header: { class: '!bg-white dark:!bg-black/20 !border-0 !pb-1' },
  content: { class: '!p-0 !bg-white dark:!bg-black/20 !max-h-[88dvh] !overflow-y-auto' },
}

const isRoulette = computed(() => v.store.call?.mode === 'roulette')
const isCaller = computed(() => !!v.store.call?.is_caller)
const peerName = computed(() => v.store.call?.peer.name ?? v.store.incoming?.peer.name ?? 'Собеседник')
const peerAvatar = computed(() => v.store.call?.peer.avatar_url ?? v.store.incoming?.peer.avatar_url ?? null)
const hasNotice = computed(() => !!(v.store.error || v.store.info || v.notice.value))
const page = usePage()
const myAvatar = computed(() => (page.props as any)?.auth?.user?.avatar_url ?? null)
const myName = computed(() => String((page.props as any)?.auth?.user?.name ?? 'Вы'))

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
      await reactionsApi.report('user', peerId, 'abuse', 'Голосовая рулетка')
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
 * Звонок завершается, собеседник остаётся в списке чатов.
 */
async function goPrivate(): Promise<void> {
  await v.createPrivateChat()
}

/**
 * Оверлей не показываем поверх входящего прямого звонка:
 * там работает диалог «Принять/Отклонить», а пустая шапка «Звонок»
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
        <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 grid place-items-center text-white shrink-0">
          <i class="pi pi-phone text-sm" />
        </span>
        <span class="font-black text-stone-900 dark:text-white truncate">{{ isRouletteRoom ? 'Рулетка' : 'Звонок' }}</span>
        <Chip v-if="v.store.status === 'active'" :label="elapsedLabel" icon="pi pi-clock" class="!rounded-full !text-xs shrink-0" />
        <Chip
          v-if="isRouletteRoom && v.rouletteCount.value !== null && v.store.status !== 'active'"
          :label="`В рулетке: ${v.rouletteCount.value}`"
          icon="pi pi-users"
          class="!rounded-full !text-xs shrink-0"
        />
      </div>
    </template>

    <div class="bg-white dark:bg-black/20 text-stone-900 dark:text-white">
      <div v-if="v.store.error" class="mx-4 mt-1 rounded-2xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-300">
        {{ v.store.error }}
      </div>
      <div v-if="v.store.info || v.notice.value" class="mx-4 mt-1 rounded-2xl bg-sky-500/10 border border-sky-500/30 px-4 py-2.5 text-sm text-sky-700 dark:text-sky-300">
        {{ v.store.info || v.notice.value }}
      </div>
      <div v-if="v.pendingInvite.value" class="mx-4 mt-1 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <i class="pi pi-send text-emerald-600 dark:text-emerald-300 shrink-0" />
        <span class="flex-1 min-w-[160px] text-sm text-emerald-700 dark:text-emerald-200 font-semibold">{{ v.pendingInvite.value.fromName }} зовёт в приватный чат</span>
        <Button label="Перейти" icon="pi pi-arrow-right" rounded size="small" severity="success" :loading="v.busy.value" @click="v.acceptPrivateInvite()" />
        <Button icon="pi pi-times" rounded text severity="secondary" size="small" aria-label="Отклонить" title="Остаться в рулетке" @click="v.declinePrivateInvite()" />
      </div>

      <!-- Вход в рулетку / ошибка прямого звонка -->
      <div v-if="v.store.status === 'idle'" class="p-5 sm:p-6 text-center">
        <template v-if="v.store.entryContext === 'direct'">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-stone-200 dark:bg-white/[0.06] grid place-items-center text-stone-500 dark:text-zinc-300">
            <i class="pi pi-phone text-2xl" />
          </div>
          <div class="mt-4 text-lg font-black">Не получилось позвонить</div>
          <div class="mt-4 flex justify-center">
            <Button label="Понятно" rounded outlined severity="secondary" @click="v.closeOverlay()" />
          </div>
        </template>
        <template v-else>
          <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 grid place-items-center text-white">
            <i class="pi pi-phone text-2xl" />
          </div>
          <div class="mt-4 text-lg font-black">Голосовая рулетка</div>
          <div class="mt-1 text-sm text-stone-500 dark:text-white/70">Случайный собеседник голосом. Free — 5 в день, PRO — безлимит.</div>
          <div v-if="v.rouletteCount.value !== null" class="mt-2 flex justify-center">
            <Chip :label="`Сейчас в рулетке: ${v.rouletteCount.value}`" icon="pi pi-users" class="!rounded-full !text-xs" />
          </div>
          <div class="mt-4 flex gap-2 justify-center flex-wrap">
            <Button
              label="Найти собеседника"
              icon="pi pi-play"
              rounded
              :loading="v.busy.value"
              class="!bg-gradient-to-br !from-rose-500 !via-pink-500 !to-fuchsia-500 !border-0"
              @click="v.joinRoulette()"
            />
            <Button v-if="hasNotice" label="Закрыть" rounded outlined severity="secondary" @click="v.closeOverlay()" />
          </div>
        </template>
      </div>

      <!-- Поиск пары -->
      <div v-else-if="v.store.status === 'searching'" class="p-4 sm:p-5">
        <div class="rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-800 to-[#0F121F] aspect-video lg:aspect-[21/9] grid place-items-center">
          <div class="text-center px-4">
            <Avatar
              :image="myAvatar ?? undefined"
              :label="!myAvatar ? myName.slice(0, 1) : undefined"
              shape="circle"
              class="!w-20 !h-20 !text-3xl ring-4 ring-white/20"
            />
            <div class="mt-3 text-white font-black">{{ myName }} (вы)</div>
            <div class="mt-1 text-sm text-white/60 flex items-center justify-center gap-2">
              <i class="pi pi-spin pi-spinner" /> Ищем собеседника… соединим автоматически
            </div>
          </div>
        </div>
        <div class="mt-1 text-center text-xs text-stone-400 dark:text-zinc-500">Голосовая рулетка — собеседник услышит тебя после соединения</div>
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
          <i class="pi pi-spin pi-spinner" /> Дозваниваемся…
        </div>
        <Button label="Отмена" icon="pi pi-times" rounded outlined severity="secondary" class="mt-4" @click="v.hangup()" />
      </div>

      <!-- Активный звонок: плитки с фото, рулетка — с чатом комнаты -->
      <div v-else-if="v.store.status === 'active'" class="p-4 sm:p-5">
        <div>
          <audio :ref="setRemoteEl" autoplay class="hidden" />
          <div class="grid gap-3" :class="isRouletteRoom ? 'lg:grid-cols-[1fr_320px]' : ''">
            <div>
              <div class="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-800 to-[#0F121F] aspect-[4/3] sm:aspect-video grid place-items-center">
                <div class="text-center px-4">
                  <Avatar
                    :image="peerAvatar ?? undefined"
                    :label="!peerAvatar ? peerName.slice(0, 1) : undefined"
                    shape="circle"
                    class="!w-24 !h-24 !text-4xl ring-4 ring-white/20"
                  />
                  <div class="mt-3 text-white font-black text-lg truncate max-w-[240px]">{{ peerName }}</div>
                  <div class="mt-1 text-xs text-white/60 flex items-center justify-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>голосовой звонок</span>
                  </div>
                </div>
                <div class="absolute top-3 left-3 max-w-[70%] flex gap-1.5 flex-wrap">
                  <Chip :label="peerName" class="!rounded-full !bg-black/50 !text-white !border-0 !text-xs !max-w-full [&_.p-chip-label]:truncate" />
                  <Chip v-if="v.peer.connectionState.value !== 'connected' && !v.peer.signalingError.value" label="Соединение…" icon="pi pi-spin pi-spinner" class="!rounded-full !bg-black/50 !text-amber-300 !border-0 !text-xs" />
                </div>
              </div>
              <div class="mt-3 flex items-center gap-3 rounded-2xl bg-stone-100 dark:bg-[#0F121F] px-3 py-2.5">
                <Avatar
                  :image="myAvatar ?? undefined"
                  :label="!myAvatar ? myName.slice(0, 1) : undefined"
                  shape="circle"
                  class="!w-10 !h-10"
                />
                <span class="flex-1 min-w-0 text-sm font-bold truncate">{{ myName }} (вы)</span>
                <i v-if="v.store.muted" class="pi pi-microphone-slash text-rose-500" title="Микрофон выключен" />
                <i v-else class="pi pi-microphone text-emerald-500" title="Микрофон включён" />
              </div>
              <div v-if="v.remoteAudioBlocked.value" class="mt-2 rounded-2xl bg-sky-500/10 border border-sky-500/30 px-3 py-2 text-xs text-sky-700 dark:text-sky-300 flex items-center gap-2 flex-wrap">
                <span class="flex-1 min-w-[180px]">Браузер заблокировал звук — нажми, чтобы услышать собеседника</span>
                <Button label="Включить звук" icon="pi pi-volume-up" rounded size="small" @click="v.unlockRemoteAudio()" />
              </div>
              <div v-if="v.peer.connectionState.value !== 'connected'" class="mt-2 text-center font-mono text-[11px] text-stone-400 dark:text-zinc-500">{{ v.peer.signalLabel.value }}<span v-if="v.peer.signalStats.value.lastError" class="text-amber-600 dark:text-amber-300"> · {{ v.peer.signalStats.value.lastError }}</span></div>
              <div v-if="v.peer.signalFailure.value" class="mt-1 text-center font-mono text-[11px] text-rose-500">сигнал {{ v.peer.signalFailure.value.kind }} · {{ v.peer.signalFailure.value.state }} · {{ v.peer.signalFailure.value.message }}</div>
              <div v-if="v.peer.iceTurnConfigured.value === false" class="mt-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 text-center">Прямое соединение может не установиться из-за сети — relay-сервер не настроен</div>
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
                <Button icon="pi pi-phone" rounded severity="danger" aria-label="Завершить" title="Завершить" class="!bg-rose-600 !border-rose-600 rotate-[135deg]" @click="v.hangup()" />
              </div>
              <div v-if="isRoulette" class="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <Button label="Дальше" icon="pi pi-arrow-right" rounded :loading="v.busy.value" class="!bg-gradient-to-br !from-rose-500 !via-pink-500 !to-fuchsia-500 !border-0 max-sm:flex-1" @click="v.nextRoulette()" />
                <Button label="В приват" icon="pi pi-send" rounded outlined severity="info" :loading="v.busy.value" title="Создать личный чат и перейти туда" class="max-sm:flex-1" @click="goPrivate()" />
                <Button icon="pi pi-flag" rounded severity="warn" outlined aria-label="Пожаловаться" title="Пожаловаться и дальше" @click="reportAndNext()" />
              </div>
              <div class="mt-2 text-center text-[11px] leading-snug text-stone-400 dark:text-zinc-500">Собеседник может записать разговор</div>
            </div>
            <div v-if="isRouletteRoom" class="rounded-2xl border border-stone-200 dark:border-white/10 overflow-hidden flex flex-col min-h-[280px] lg:min-h-0 lg:max-h-[62dvh]">
              <div class="flex items-center gap-2 px-3 py-2.5 text-sm font-bold border-b border-stone-200 dark:border-white/10">
                <i class="pi pi-comments" />
                <span class="flex-1">Чат комнаты</span>
              </div>
              <div class="max-h-64 overflow-y-auto overscroll-contain p-3 lg:max-h-none lg:flex-1">
                <div v-if="callChat.messages.value.length" class="flex flex-col gap-1.5">
                  <div
                    v-for="m in callChat.messages.value"
                    :key="m.id"
                    class="max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words"
                    :class="m.mine ? 'self-end bg-violet-600 text-white rounded-br-md' : 'self-start bg-stone-100 dark:bg-white/[0.06] rounded-bl-md'"
                  >
                    {{ m.text }}
                  </div>
                </div>
                <div v-else class="text-xs text-stone-400 dark:text-zinc-500">Поздоровайся и обменяйся контактами, не прерывая разговор</div>
              </div>
              <div class="border-t border-stone-200 dark:border-white/10 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex gap-2">
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
        </div>
      </div>
    </div>
  </Dialog>
</template>
