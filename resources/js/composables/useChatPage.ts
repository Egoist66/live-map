import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { useChat } from '@/composables/useChat'
import { useFriendships } from '@/composables/useFriendships'
import { useBlocks } from '@/composables/useBlocks'
import { useEmojiPicker } from '@/composables/useEmojiPicker'
import { useLongPress } from '@/composables/useLongPress'
import { useMessageReply } from '@/composables/useMessageReply'
import { useMessageSelection } from '@/composables/useMessageSelection'
import { usePinnedMessages } from '@/composables/usePinnedMessages'
import { useChatBadges } from '@/composables/useChatBadges'
import { useChatNavigation } from '@/composables/useChatNavigation'
import { useChatAttachment } from '@/composables/useChatAttachment'
import { useChatLocation } from '@/composables/useChatLocation'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { useAppModulesStore } from '@/stores/appModules'
import { useSavedNotesStore } from '@/stores/savedNotes'
import { chatApi } from '@/services/chat.api'
import { datingApi } from '@/services/dating.api'

export function useChatPage(initialConversationId?: number) {
  const chat = useChat()
  const friendsApi = useFriendships()
  const blocksApi = useBlocks()
  const emoji = useEmojiPicker()
  const badgeSync = useChatBadges(chat.unreadTotal, friendsApi.pendingIn, chat.unreadMessagesTotal)
  const nav = useChatNavigation(chat.selectedId, chat.openConversation)

  const input = ref('')
  const inputRef = ref<HTMLInputElement | null>(null)
  const editInputRef = ref<HTMLInputElement | null>(null)
  const tab = ref<'chats' | 'ulove' | 'friends' | 'requests' | 'blocked'>('chats')

  /**
   * Бизнес-аккаунт: ULove-таба нет вообще — только чаты.
   */
  const isBusiness = computed(() => {
    try {
      return ((usePage().props as unknown as { auth?: { user?: { account_type?: string } | null } }).auth?.user?.account_type ?? 'person') === 'business'
    } catch {
      return false
    }
  })

  const modules = useAppModulesStore()

  try {
    modules.ensureInit((usePage().props as unknown as { auth?: { user?: unknown } }).auth?.user ?? null)
  } catch {
  }

  /**
   * Чистый ULove-режим: только мэтчи и блок.
   * Никакого поиска людей, друзей и заявок.
   */
  const uloveOnly = computed(
    () => !isBusiness.value && modules.isEnabled('ulove') && !modules.isEnabled('upin') && !modules.isEnabled('uflow'),
  )

  /**
   * Чаты мэтчей ULove: собеседник с is_match и только direct.
   * SOS-диалоги (type=sos) сюда не попадают — у них обычный стиль.
   * Бизнесу — пусто: мэтчей у компаний не бывает.
   * @returns диалоги ULove
   */
  const uloveConversations = computed(() => {
    if (isBusiness.value) {
      return []
    }

    const directs = chat.conversations.value.filter((c: any) => (c?.type ?? 'direct') === 'direct')

    if (uloveOnly.value) {
      return directs
    }

    return directs.filter((c: any) => !!(c?.other as any)?.is_match)
  })

  /** Непрочитанные диалоги ULove (счётчик таба). */
  const uloveUnread = computed(() => uloveConversations.value.filter((c: any) => Number(c?.unread_count || 0) > 0).length)

  watch(tab, (next) => {
    if (isBusiness.value && next === 'ulove') {
      tab.value = 'chats'
    }

    if (uloveOnly.value && next !== 'ulove' && next !== 'blocked') {
      tab.value = 'ulove'
    }
  })
  const showChatMenu = ref(false)
  const sheet = ref<{ type: 'message' | 'chat' | 'friend' | 'request' | 'search', data: any } | null>(null)
  const showPrivacy = ref(false)
  const privacy = ref({ message_privacy: 'everyone', dating_match_only: false })
  const creatingChat = ref(false)
  const confirm = ref<{ type: 'block' | 'deleteChat' | 'clearAllChats' | 'deleteMessage' | 'deleteMessages' | 'removeFriend' | 'unblock', payload: any, title: string, msg: string, icon: string, confirmLabel: string, severity: 'danger' | 'primary' } | null>(null)
  const confirmVisible = computed({ get: () => !!confirm.value, set: (v) => { if (!v) confirm.value = null } })
  const toast = (() => { try { return useToast() } catch { return null as any } })()
  const pageProps = usePage().props as any
  const isOwnMessage = (m: any) => Number(m?.sender_id) === Number(pageProps.auth?.user?.id)
  const { bind: bindSheet } = useLongPress((p: any) => { sheet.value = p }, 520)
  const reply = useMessageReply()
  const pins = usePinnedMessages(chat.messages as any)
  const attachment = useChatAttachment()
  const chatLocation = useChatLocation()
  const voice = useVoiceRecorder()

  watch(() => chat.activeConv.value, (conv: any) => {
    if (conv?.id) void pins.load(conv.id, { pinned: conv.pinned, pin_limit: conv.pin_limit })
    else pins.reset()
  })

  const selection = useMessageSelection()
  const forwardOpen = ref(false)
  const forwarding = ref(false)
  const forwardingTargetId = ref<number | 'saved' | null>(null)

  /**
   * Можно ли выбрать сообщение: обычные, уже доставленные на сервер.
   *
   * Системные плашки и pending-черновики в выбор не берём.
   *
   * @param m сообщение
   */
  function isSelectableMessage(m: any): boolean {
    if (!m || m.id == null || (m as any).pending) {
      return false
    }

    return String(m.type ?? 'text') !== 'system'
  }

  /**
   * Начать выбор с сообщения (пункт «Выделить» в меню).
   *
   * @param m сообщение
   */
  function startSelectMessage(m: any): void {
    if (!isSelectableMessage(m)) {
      return
    }

    reply.cancelReply()
    selection.start(m.id)
  }

  /**
   * Клик по сообщению в режиме выбора или с ctrl/cmd.
   *
   * @param m сообщение
   */
  function toggleSelectMessage(m: any): void {
    if (!isSelectableMessage(m)) {
      return
    }

    selection.toggle(m.id)
  }

  /**
   * Отменить выбор и закрыть диалог пересылки.
   */
  function cancelSelection(): void {
    selection.clear()
    forwardOpen.value = false
    forwardingTargetId.value = null
  }

  /**
   * Выбрать все сообщения текущего диалога (ctrl/cmd+A в режиме выбора).
   */
  function selectAllMessages(): void {
    for (const m of (chat.messages.value as any[])) {
      if (isSelectableMessage(m) && !selection.isSelected(m?.id)) {
        selection.toggle(m.id)
      }
    }
  }

  /**
   * Все выбранные — мои: удаление доступно целиком.
   */
  const canDeleteSelection = computed(() => {
    if (!selection.active.value) {
      return false
    }

    return selection.ids.value.every((id) => {
      const found = (chat.messages.value as any[]).find((m) => Number(m?.id) === Number(id))

      if (!found) {
        return false
      }

      return isOwnMessage(found)
    })
  })

  /**
   * Подтверждение удаления выбранных сообщений.
   */
  function askDeleteSelection(): void {
    if (!selection.active.value) {
      return
    }

    const ownCount = selection.ids.value.filter((id) => {
      const found = (chat.messages.value as any[]).find((m) => Number(m?.id) === Number(id))

      return found && isOwnMessage(found)
    }).length

    confirm.value = {
      type: 'deleteMessages',
      payload: [...selection.ids.value],
      title: `Удалить ${selection.count.value}?`,
      msg: ownCount === selection.count.value
        ? 'Сообщения удалятся у всех участников. Это нельзя отменить.'
        : `Удалятся только ваши (${ownCount} из ${selection.count.value}): чужие сообщения удалить нельзя.`,
      icon: '🗑️',
      confirmLabel: 'Удалить',
      severity: 'danger',
    }
  }

  /**
   * Открыть диалог пересылки выбранных.
   */
  function openForward(): void {
    if (!selection.active.value) {
      return
    }

    forwardingTargetId.value = null
    forwardOpen.value = true
  }

  /**
   * Полные объекты выбранных сообщений для превью авторов в диалоге.
   */
  const forwardSources = computed(() => {
    const wanted = new Set([...selection.ids.value].map(Number))
    const found: any[] = []

    for (const m of (chat.messages.value as any[])) {
      if (wanted.has(Number(m?.id))) {
        found.push(m)
      }
    }

    return found
  })

  /**
   * Текст заметки из пересланного сообщения: чужое подписываем автором.
   *
   * Без текста подставляем понятную подпись по виду вложения,
   * чтобы голосовое или файл не сохранялись пустыми.
   *
   * @param m сообщение из ленты
   */
  function forwardNoteBody(m: any): string {
    const body = String(m?.body ?? '').trim()
    const author = String(m?.sender?.name ?? '').trim()
    const mine = isOwnMessage(m)
    const kind = String(m?.attachment?.kind ?? m?.type ?? '')
    let snippet = body

    if (snippet === '') {
      if (kind === 'voice' || kind === 'audio') {
        const secs = Number(m?.attachment?.duration ?? 0)
        snippet = secs > 0 ? `🎤 Голосовое (${secs} c)` : '🎤 Голосовое'
      } else if (String(m?.attachment?.name ?? '') !== '') {
        snippet = String(m?.attachment?.name)
      } else {
        snippet = '(вложение)'
      }
    }

    if (mine || author === '') {
      return snippet
    }

    return `Переслано от ${author}:\n${snippet}`
  }

  /**
   * Скачать вложение сообщения как File для сохранения в Избранное.
   *
   * @param m сообщение из ленты
   * @returns файл или null (голосовые и ошибки — null)
   */
  async function forwardNoteFile(m: any): Promise<File | null> {
    const url = String(m?.attachment?.url ?? '')

    if (url === '') {
      return null
    }

    const kind = String(m?.attachment?.kind ?? '')

    if (kind === 'voice') {
      return null
    }

    try {
      const res = await fetch(url)

      if (!res.ok) {
        return null
      }

      const blob = await res.blob()
      const name = String(m?.attachment?.name ?? `file-${m?.id ?? Date.now()}`)

      return new File([blob], name, { type: blob.type || String(m?.attachment?.mime ?? 'application/octet-stream') })
    } catch {
      return null
    }
  }

  /**
   * Переслать выбранные в Избранное: каждое сообщение — отдельной заметкой.
   */
  async function forwardToSaved(): Promise<void> {
    if (!selection.active.value || forwarding.value) {
      return
    }

    const sources = [...forwardSources.value]

    if (!sources.length) {
      return
    }

    forwarding.value = true
    forwardingTargetId.value = 'saved'

    const notes = useSavedNotesStore()
    let saved = 0
    let failed = 0

    for (const m of sources) {
      const body = forwardNoteBody(m)
      const file = await forwardNoteFile(m)
      const kind = file && /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name) ? 'image' : 'file'
      const text = body === '' && file ? file.name : body

      if (text === '') {
        failed += 1
        continue
      }

      const ok = await notes.create(text, file, kind)

      if (ok) {
        saved += 1
      } else {
        failed += 1
      }
    }

    forwarding.value = false
    forwardingTargetId.value = null

    if (saved > 0) {
      forwardOpen.value = false
      selection.clear()
      toast?.add({ severity: 'success', summary: 'В Избранном', detail: saved === 1 ? 'Сообщение сохранено в Избранное' : `Сохранено в Избранное: ${saved}`, life: 3000 })
    }

    if (failed > 0 && saved === 0) {
      toast?.add({ severity: 'error', summary: 'Не получилось', detail: 'Не удалось сохранить в Избранное', life: 4000 })
    } else if (failed > 0) {
      toast?.add({ severity: 'warn', summary: 'Частично', detail: `Не сохранилось: ${failed}`, life: 4000 })
    }
  }

  /**
   * Переслать выбранные в диалог или в Избранное.
   *
   * @param targetId id диалога-получателя или 'saved' для Избранного
   */
  async function forwardSelection(targetId: number | 'saved'): Promise<void> {
    if (targetId === 'saved') {
      await forwardToSaved()
      return
    }

    if (!selection.active.value || forwarding.value) {
      return
    }

    forwarding.value = true
    forwardingTargetId.value = Number(targetId)

    try {
      const res = await chatApi.forwardMessages([...selection.ids.value], [Number(targetId)])
      const created = res?.results?.[0]?.messages ?? []

      for (const msg of created) {
        const exists = (chat.messages.value as any[]).some((m) => Number(m?.id) === Number((msg as any)?.id))

        if (exists) {
          continue
        }

        if (Number(chat.selectedId.value) === Number(targetId)) {
          ;(chat.messages.value as any[]).push({ ...(msg as any), justSent: true })
        }
      }

      forwardOpen.value = false
      selection.clear()
      void chat.loadConversations().catch(() => {})
      toast?.add({ severity: 'success', summary: 'Переслано', detail: created.length === 1 ? 'Сообщение улетело в диалог' : `Сообщений: ${created.length}`, life: 3000 })
    } catch (e: any) {
      const detail = e?.response?.data?.message || 'Не удалось переслать'
      toast?.add({ severity: 'error', summary: 'Не получилось', detail, life: 4000 })
    } finally {
      forwarding.value = false
      forwardingTargetId.value = null
    }
  }

  /**
   * Удалить выбранные одним запросом (после confirm).
   *
   * @param ids id сообщений
   */
  async function deleteSelection(ids: number[]): Promise<void> {
    const backup = [...chat.messages.value]
    const gone = new Set(ids.map(Number))
    chat.messages.value = (chat.messages.value as any[]).filter((m) => !gone.has(Number(m?.id)))

    try {
      await chatApi.bulkDeleteMessages(ids)
      selection.clear()
      void chat.loadConversations().catch(() => {})
    } catch (e: any) {
      chat.messages.value = backup
      const detail = e?.response?.data?.message || 'Не удалось удалить'
      toast?.add({ severity: 'error', summary: 'Не получилось', detail, life: 4000 })
      throw e
    }
  }

  async function togglePin(m: any) {
    const ok = await pins.toggle(m)
    if (!ok && pins.error.value) {
      toast?.add({ severity: 'warn', summary: 'Не удалось закрепить', detail: pins.error.value, life: 4000 })
    }
  }

  /**
   * Закрепить/открепить диалог из списка чатов (пункт ⋯).
   *
   * Строку двигаем только после ответа сервера: лимит тарифа
   * (Free — 3 закрепа) проверяется на бэке, 403 показываем варнингом.
   *
   * @param id id диалога
   * @param isPinned закреплён ли сейчас (true — открепляем)
   */
  async function toggleChatPin(id: number, isPinned: boolean): Promise<void> {
    try {
      if (isPinned) {
        await chatApi.unpinConversation(id)
        chat.setConversationPinned(id, false)
        return
      }

      const res = await chatApi.pinConversation(id)
      chat.setConversationPinned(id, true, res?.pinned_at ?? null)
    } catch (e: any) {
      const limited = Number(e?.response?.status) === 403
      const detail = e?.response?.data?.message || 'Не удалось изменить закреп'
      const summary = limited ? 'Лимит закрепов' : 'Не получилось'
      const severity = limited ? 'warn' : 'error'
      toast?.add({ severity, summary, detail, life: 4500 })
    }
  }

  /**
   * Переход к сообщению: догружает историю вверх при нужде и подсвечивает.
   * @param id id сообщения
   */
  async function jumpToMessage(id: number): Promise<void> {
    const found = await chat.history.scrollToMessage(id)
    if (found) {
      pins.flash(id)
      return
    }
    toast?.add({ severity: 'warn', summary: 'Не найдено', detail: 'Сообщение не найдено в истории', life: 3000 })
  }

  function notifyBlockedBy(detail?: string) {
    const msg = detail || 'Пользователь заблокировал вас'
    toast?.add({
      severity: 'error',
      summary: '⛔ Доступ ограничен',
      detail: msg.includes('заблокировал вас') ? 'Этот пользователь заблокировал вас — сообщения не доставляются.' : msg,
      life: 4500,
    })
  }

  async function handleSend() {
    const text = input.value.trim()
    const picked = attachment.file.value
    if (!text && !picked) {
      return
    }
    input.value = ''
    emoji.close()
    const quoted = reply.replyTo.value
    const sendingFile = picked
    attachment.clear()
    try {
      await chat.sendMessage(text, quoted, sendingFile)
      reply.cancelReply()
    } catch (e: any) {
      const status = e?.response?.status
      const msg = e?.response?.data?.message || e?.response?.data?.errors?.attachment?.[0] || e?.message || ''
      input.value = text
      if (sendingFile && !attachment.file.value) {
        attachment.file.value = sendingFile
      }
      if (status === 403 && msg.includes('заблокировал')) notifyBlockedBy(msg)
      else if (status === 403) toast?.add({ severity: 'warn', summary: 'Нельзя отправить', detail: msg || 'Сообщение не доставлено', life: 3500 })
      else {
        const isTimeout = (e as any)?.code === 'ECONNABORTED'
        const fallback = isTimeout ? 'Нет соединения — сообщение не отправлено, попробуйте снова' : 'Не удалось отправить сообщение'
        toast?.add({ severity: 'error', summary: 'Не отправлено', detail: msg || fallback, life: 3500 })
      }
    }
  }

  /**
   * Принимает файл из input чата: валидация и сжатие картинок.
   * @param target выбранный файл или null
   */
  async function handlePickFile(target: File | null): Promise<void> {
    if (!target) {
      return
    }
    const ok = await attachment.pick(target)
    if (!ok && attachment.error.value) {
      toast?.add({ severity: 'warn', summary: 'Файл не принят', detail: attachment.error.value, life: 3500 })
    }
    focusChatInput()
  }

  /**
   * Вставка картинки из буфера (Ctrl+V скриншота) в инпут чата.
   * Картинка кладётся во вложение как файл и отправляется кнопкой.
   *
   * @param e событие paste из инпута
   */
  async function handlePasteImage(e: ClipboardEvent): Promise<void> {
    const handled = await attachment.pickClipboard(e)
    if (handled) {
      focusChatInput()
      return
    }
    if (attachment.error.value) {
      toast?.add({ severity: 'warn', summary: 'Файл не принят', detail: attachment.error.value, life: 3500 })
      attachment.error.value = null
    }
  }

  /**
   * Поделиться геопозицией: координаты + ссылки на Яндекс и Google карты.
   * @returns void
   */
  async function handleShareLocation(): Promise<void> {
    const quoted = reply.replyTo.value
    const ok = await chatLocation.shareLocation((text) => chat.sendMessage(text, quoted))

    if (ok) {
      reply.cancelReply()
      return
    }

    if (chatLocation.locationError.value) {
      toast?.add({ severity: 'warn', summary: 'Геопозиция', detail: chatLocation.locationError.value, life: 3500 })
    }
  }

  function handleStartReply(m: any) {
    chat.cancelEdit()
    emoji.close()
    reply.startReply(m)
    focusChatInput()
  }

  /**
   * Начинает запись голосового: закрывает эмодзи/редактирование.
   * @returns void
   */
  async function handleStartVoice(): Promise<void> {
    chat.cancelEdit()
    emoji.close()
    const ok = await voice.start()
    if (!ok && voice.error.value) {
      toast?.add({ severity: 'warn', summary: 'Голосовое', detail: voice.error.value, life: 3500 })
    }
  }

  /**
   * Останавливает запись — дальше превью для прослушивания.
   * @returns void
   */
  async function handleStopVoice(): Promise<void> {
    await voice.stop()
  }

  /**
   * Отменяет запись и убирает превью.
   * @returns void
   */
  async function handleCancelVoice(): Promise<void> {
    await voice.cancel()
    voice.discardPreview()
  }

  /**
   * Отправляет записанное голосовое с длительностью.
   * @returns void
   */
  async function handleSendVoice(): Promise<void> {
    const done = voice.finish()
    if (!done) {
      return
    }
    if (done.file.size > 5 * 1024 * 1024) {
      toast?.add({ severity: 'warn', summary: 'Голосовое', detail: 'Запись больше 5 МБ — попробуйте короче', life: 3500 })
      return
    }
    const quoted = reply.replyTo.value
    try {
      await chat.sendMessage('', quoted, done.file, done.duration)
      reply.cancelReply()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.errors?.attachment?.[0] || 'Не удалось отправить голосовое'
      toast?.add({ severity: 'error', summary: 'Не отправлено', detail: msg, life: 3500 })
    }
  }

  const timeCache = new Map<string,string>()
  function formatTime(s: string | null | undefined) {
    if (!s) return ''
    if (timeCache.has(s)) return timeCache.get(s)!
    try { const v = new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); timeCache.set(s, v); if (timeCache.size>400) timeCache.delete(timeCache.keys().next().value!); return v } catch { return '' }
  }

  function onPickEmoji(emojiChar: string) {
    const el = inputRef.value
    const pos = el?.selectionStart ?? input.value.length
    const res = emoji.insertEmoji(input.value, emojiChar, pos)
    input.value = res.text
    nextTick(() => { if (el) { el.focus(); el.setSelectionRange(res.cursor, res.cursor) } })
  }

  function onPickEmojiForEdit(emojiChar: string) {
    const el = editInputRef.value
    const pos = el?.selectionStart ?? chat.editingBody.value.length
    const res = emoji.insertEmoji(chat.editingBody.value, emojiChar, pos)
    chat.editingBody.value = res.text
    nextTick(() => { if (el) { el.focus(); el.setSelectionRange(res.cursor, res.cursor) } })
  }

  function handleStartEdit(m: any) {
    chat.startEdit(m)
    emoji.close()
    nextTick(() => editInputRef.value?.focus())
  }

  async function startChatWith(u: any) {
    if (u.can_message === false) {
      const reason = u.can_message_reason || 'Пользователь не принимает сообщения'
      if (reason.includes('заблокировал')) notifyBlockedBy(reason)
      else toast?.add({ severity: 'warn', summary: 'Нельзя написать', detail: reason, life: 3500 })
      return
    }
    creatingChat.value = true
    try {
      await chat.createConversation(u.id)
      tab.value = 'chats'
      chat.searchQuery.value = ''
      chat.searchResults.value = []
      focusChatInput()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Ошибка создания чата'
      if (e?.response?.status === 403 && msg.includes('заблокировал')) notifyBlockedBy(msg)
      else if (e?.response?.status === 403) toast?.add({ severity: 'warn', summary: 'Нельзя создать чат', detail: msg, life: 3500 })
      else toast?.add({ severity: 'error', summary: 'Ошибка', detail: msg, life: 3500 })
    } finally { creatingChat.value = false }
  }

  async function addFriendFromSearch(userId: number) {
    try {
      await friendsApi.add(userId)
      const item = chat.searchResults.value.find((u: any) => Number(u.id) === Number(userId))
      if (item) { item.is_pending = true }
    } catch (e: any) {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: e?.response?.data?.message || 'Не удалось отправить заявку', life: 3500 })
    }
  }

  /**
   * Сохраняет приватность с учётом режима.
   *
   * ULove-режим (только ulove без upin/uflow): селект «Все со свайпов /
   * Только мэтчи» пишет флаг dating_match_only через дейтинг-настройки.
   * Обычный режим: классический message_privacy через чат-API.
   */
  async function savePrivacy() {
    if (uloveOnly.value) {
      await datingApi.updateSettings({ dating_match_only: !!privacy.value.dating_match_only })
      return
    }

    await chatApi.updatePrivacy({ message_privacy: privacy.value.message_privacy })
  }

  function askBlock(userId: number, name?: string) {
    confirm.value = { type: 'block', payload: userId, title: 'Заблокировать?', msg: `Заблокировать ${name ?? 'пользователя'}? Переписка сохранится, но он не сможет писать вам. Дружба будет удалена.`, icon: '⛔', confirmLabel: 'Заблокировать', severity: 'danger' }
  }
  function askDeleteChat(id?: number) {
    const cid = id ?? chat.selectedId.value
    if (!cid) return
    confirm.value = { type: 'deleteChat', payload: cid, title: 'Удалить чат?', msg: 'Чат и все сообщения будут удалены навсегда. Это нельзя отменить.', icon: '🗑️', confirmLabel: 'Удалить', severity: 'danger' }
  }
  function askClearAllChats() {
    if (!chat.conversations.value.length) return
    confirm.value = { type: 'clearAllChats', payload: null, title: 'Удалить все чаты?', msg: 'Все диалоги пропадут из вашего списка навсегда, история будет очищена. У собеседников чаты останутся. Это нельзя отменить.', icon: '🗑️', confirmLabel: 'Удалить все', severity: 'danger' }
  }
  function askDeleteMessage(id: number) {
    confirm.value = { type: 'deleteMessage', payload: id, title: 'Удалить сообщение?', msg: 'Сообщение будет удалено у всех участников.', icon: '🗑️', confirmLabel: 'Удалить', severity: 'danger' }
  }
  function askRemoveFriend(f: any) {
    confirm.value = { type: 'removeFriend', payload: f, title: 'Удалить из друзей?', msg: `Удалить ${f?.other?.name ?? 'пользователя'} из друзей?`, icon: '👋', confirmLabel: 'Удалить', severity: 'danger' }
  }
  function askUnblock(userId: number) {
    confirm.value = { type: 'unblock', payload: userId, title: 'Разблокировать?', msg: 'Пользователь снова сможет писать вам.', icon: '🔓', confirmLabel: 'Разблокировать', severity: 'primary' }
  }
  async function doConfirm() {
    if (!confirm.value) return
    const { type, payload } = confirm.value
    confirm.value = null
    sheet.value = null
    if (type === 'block') {
      // Блок не удаляет чат и историю: только запрет переписки.
      // Раньше тут вызывался deleteConversation (hidden_at + cleared_at),
      // из-за чего после разблокировки диалог пропадал вместе с сообщениями.
      try {
        await blocksApi.block(payload)
      } catch (e) { await Promise.all([friendsApi.load(), blocksApi.load(), chat.loadConversations()]); throw e }
      friendsApi.load(); chat.loadConversations()
    } else if (type === 'deleteChat') {
      await chat.deleteConversation(payload)
    } else if (type === 'deleteMessages') {
      await deleteSelection(Array.isArray(payload) ? payload : [])
    } else if (type === 'clearAllChats') {
      await chat.clearAllConversations()
    } else if (type === 'deleteMessage') {
      await chat.deleteMessage(payload)
    } else if (type === 'removeFriend') {
      await friendsApi.remove(payload.id)
    } else if (type === 'unblock') {
      // Бэк при разблокировке снимает hidden_at/cleared_at — подтягиваем список,
      // чтобы диалог с историей сразу вернулся в чаты.
      await blocksApi.unblock(payload)
      await chat.loadConversations()
    }
  }

  function closeSheet() { sheet.value = null }

  watch(() => chat.selectedId.value, (id) => { reply.cancelReply(); voice.cancel(); voice.discardPreview(); cancelSelection(); if (id) focusChatInput() })

  function backToList() { nav.backToList(emoji.close, chat.cancelEdit, showChatMenu) }

  function onKeydown(e: KeyboardEvent) {
    if (selection.active.value) {
      if (e.key === 'Escape') {
        cancelSelection()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAllMessages()
        return
      }
    }
    if (e.key === 'Escape' && chat.selectedId.value) {
      if (emoji.open.value) { emoji.close(); return }
      if (chat.editingId.value !== null) { chat.cancelEdit(); return }
      if (reply.replyTo.value) { reply.cancelReply(); return }
      if (voice.isRecording.value) { voice.cancel(); return }
      if (voice.hasPreview.value) { voice.discardPreview(); return }
      if (showChatMenu.value) { showChatMenu.value = false; return }
      backToList()
    }
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

  function focusChatInput() {
    nextTick(() => {
      const el: any = inputRef.value
      if (!el) return
      try {
        if (el.$el) {
          const inner = el.$el.querySelector?.('input')
          if (inner) { inner.focus(); return }
        }
        if (typeof el.focus === 'function') el.focus()
      } catch {}
    })
  }

  function resolveInitialId(): number | null {
    if (initialConversationId) return Number(initialConversationId)
    try {
      const q = new URLSearchParams(window.location.search).get('c')
      if (q && Number(q)) return Number(q)
    } catch {}
    return null
  }

  function resolveInitialTab() {
    if (uloveOnly.value) {
      tab.value = 'ulove'
      return
    }

    try {
      const q = new URLSearchParams(window.location.search)
      const t = q.get('tab')
      if (t && ['chats', 'ulove', 'friends', 'requests', 'blocked'].includes(t)) tab.value = t as any
      else if (q.get('from') === 'swipes') tab.value = 'ulove'
    } catch {}
  }

  /**
   * Открыть диалог по id с понятной ошибкой.
   *
   * @param rawId id диалога из пропса или URL
   * @returns void
   */
  async function openTarget(rawId: number | string | null | undefined): Promise<void> {
    const targetId = Number(rawId)
    if (!targetId) return
    try {
      await chat.openConversation(targetId)
      const opened = chat.activeConv.value as any
      const isSos = String(opened?.type ?? 'direct') !== 'direct'
      // В чистом ULove таба «Чаты» нет — остаёмся в ULove даже без мэтча
      // (строка честно покажется без пилюли «Мэтч», см. ChatList).
      tab.value = !isSos && (opened?.other?.is_match || uloveOnly.value) ? 'ulove' : 'chats'
      focusChatInput()
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Не удалось открыть чат'
      toast?.add({ severity: 'error', summary: 'Чат не открылся', detail: msg, life: 4000 })
    }
  }

  async function init() {
    resolveInitialTab()
    badgeSync.init()
    const targetId = resolveInitialId()
    if (targetId) {
      await chat.loadConversations().catch(() => {})
      await openTarget(targetId)
    }
    try {
      await Promise.all([friendsApi.load(), blocksApi.load()])
    } catch {}
    badgeSync.setPending(friendsApi.pendingIn.value.length)
    try {
      await chat.loadConversations()
    } catch {}
    badgeSync.setUnread(chat.unreadTotal.value)
    badgeSync.setUnreadMessages(chat.unreadMessagesTotal.value)
    try {
      const me = await chatApi.me()
      privacy.value.message_privacy = me.message_privacy ?? 'everyone'
      if (typeof me.dating_match_only === 'boolean') {
        privacy.value.dating_match_only = me.dating_match_only
      } else {
        const authFlag = (pageProps.auth?.user as any)?.dating_match_only
        privacy.value.dating_match_only = !!authFlag
      }
    } catch {}
    if (targetId && !chat.selectedId.value) {
      await openTarget(targetId)
    }
  }

  return {
    chat, friendsApi, blocksApi, emoji, badgeSync, pins, togglePin, uloveConversations, uloveUnread, isBusiness, uloveOnly,
    input, inputRef, editInputRef, tab, showChatMenu, sheet, showPrivacy, privacy, creatingChat, confirm, confirmVisible, isOwnMessage, bindSheet, voice,
    handleSend, handlePickFile, handlePasteImage, handleShareLocation, handleStartVoice, handleStopVoice, handleCancelVoice, handleSendVoice, locating: chatLocation.locating, attachment, formatTime, onPickEmoji, onPickEmojiForEdit, handleStartEdit, startChatWith, addFriendFromSearch, savePrivacy, doConfirm, closeSheet, backToList,
    askBlock, askDeleteChat, askClearAllChats, askDeleteMessage, askDeleteSelection, askRemoveFriend, askUnblock, toggleChatPin,
    init, openTarget, reply, handleStartReply, jumpToMessage,
    selection, canDeleteSelection, forwardOpen, forwarding, forwardingTargetId, forwardSources, startSelectMessage, toggleSelectMessage, cancelSelection, openForward, forwardSelection, forwardToSaved, deleteSelection,
  }
}
