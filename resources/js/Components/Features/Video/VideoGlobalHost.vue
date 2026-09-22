<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useVideoSession } from '@/composables/useVideoSession'
import { currentAuthUid } from '@/composables/useAuthUid'
import { videoApi } from '@/services/video.api'
import { busEmit } from '@/services/realtime-bus'
import IncomingCallDialog from '@/Components/Features/Video/IncomingCallDialog.vue'
import VideoOverlay from '@/Components/Features/Video/VideoOverlay.vue'

/**
 * Глобальный хост видео: входящие звонки доходят на любой странице
 * (чат, карта, свайпы), а не только там, где смонтированы диалоги.
 * Подписка на шину идемпотентна — двойной mount безопасен.
 *
 * Добивка при мёртвом сокете (оба транспорта realtime молчат):
 * - idle/searching: подбираем висящие входящие раз в 5 секунд;
 * - ringing-out: опрашиваем статус своего звонка раз в 3 секунды —
 *   accepted подхватываем локально, конец гасим без ожидания сигнала.
 * При живом сокете поллы не ходят.
 */

const v = useVideoSession()

let pendingTimer: ReturnType<typeof setInterval> | null = null
let statusTimer: ReturnType<typeof setInterval> | null = null
let signalsTimer: ReturnType<typeof setInterval> | null = null
/** Курсор добивки сигналов + звонок, к которому он относится. */
const signalCursor = ref(0)
const signalCallId = ref<number | null>(null)
/** Опрос сигналов уже летит (не громоздим дубли на медленной сети). */
let signalsInFlight = false
/** До какого момента не опрашивать сигналы после 429. */
let signalsBlockedUntil = 0

/** Жив ли сокет: тогда входящие едут сами, полл не нужен. */
function socketAlive(): boolean {
  try {
    const echo = (window as any).Echo
    const state = echo?.connector?.pusher?.connection?.state
    return state === 'connected'
  } catch {
    return false
  }
}

/** Id текущего юзера (0 — гость: добивки не нужны, будет 401-спам). */
function myUid(): number {
  return currentAuthUid()
}

/** Подобрать висящие входящие, если realtime молчит. */
async function pollPending(): Promise<void> {
  if (document.hidden || socketAlive() || !myUid()) return
  const status = v.store.status
  if (status !== 'idle' && status !== 'searching') return
  try {
    const res = await videoApi.pending()
    const first = res.incoming?.[0]
    if (first) v.store.handleIncoming(first)
  } catch {}
}

/**
 * Опросить свой исходящий звонок, если accepted-сигнал потерялся.
 * Callee принял, а мы не узнали: show() вернёт active — подхватываем
 * и пинаем offer (эмулируем оба bus-хендлера: стор + peer).
 * Тикает всегда (не только при мёртвом сокете): accepted мог
 * потеряться и при живом соединении, опрос дешёвый и только в ringing-out.
 */
async function pollOwnCall(): Promise<void> {
  if (document.hidden) return
  if (v.store.status !== 'ringing-out') return
  const callId = v.store.call?.id
  if (!callId) return
  try {
    const res = await videoApi.show(callId)
    const next = String(res.call?.status ?? '')
    if (next === 'active') {
      v.store.markAccepted()
      if (v.store.call?.is_caller) {
        void v.peer.startOffer()
      }
    } else if (next === 'declined' || next === 'ended' || next === 'timeout') {
      v.store.resetSession()
    }
  } catch {}
}

/**
 * Добить offer/answer/ice/chat опросом, если сокет мёртв.
 * Каждый фрейм кладём в ту же шину — дальше работают те же хендлеры
 * (peer с дедупом по id, стор, чат звонка). Так P2P живёт вообще
 * без realtime: чистый REST-поллинг вместо сигналинга.
 * Бонус: пока P2P не в connected — опрашиваем даже при живом сокете,
 * иначе offer/answer, ушедший раньше подписки пира, теряется навсегда
 * («Соединение…» висит вечно при зелёном сокете).
 */
async function pollSignals(): Promise<void> {
  if (document.hidden) return
  if (Date.now() < signalsBlockedUntil) return
  if (signalsInFlight) return
  const callId = v.store.call?.id ?? null
  const status = v.store.status
  if (!callId || (status !== 'active' && status !== 'ringing-out' && status !== 'ringing-in')) {
    return
  }
  const peerConnected = v.peer.connectionState.value === 'connected'
  if (socketAlive() && peerConnected) return
  if (signalCallId.value !== callId) {
    signalCallId.value = callId
    signalCursor.value = 0
  }
  signalsInFlight = true
  try {
    const res = await videoApi.signals(callId, signalCursor.value)
    for (const s of res.signals ?? []) {
      const sid = Number(s?.id ?? 0)
      if (sid > signalCursor.value) signalCursor.value = sid
      if (sid > 0) busEmit('user:video.signal', s)
    }
  } catch (e) {
    const httpStatus = (e as { response?: { status?: number } })?.response?.status
    if (httpStatus === 429) {
      signalsBlockedUntil = Date.now() + 10000
    }
  } finally {
    signalsInFlight = false
  }
}

onMounted(() => {
  v.bindRealtime()
  pendingTimer = setInterval(() => void pollPending(), 5000)
  statusTimer = setInterval(() => void pollOwnCall(), 3000)
  signalsTimer = setInterval(() => void pollSignals(), 2000)
})

onBeforeUnmount(() => {
  if (pendingTimer) clearInterval(pendingTimer)
  if (statusTimer) clearInterval(statusTimer)
  if (signalsTimer) clearInterval(signalsTimer)
  pendingTimer = null
  statusTimer = null
  signalsTimer = null
})
</script>

<template>
  <IncomingCallDialog />
  <VideoOverlay />
</template>
