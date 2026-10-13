<script setup lang="ts">
import { watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { useAiAssistant } from '@/composables/useAiAssistant'
import { useAiGuideDialog } from '@/composables/useAiGuideDialog'
import { useAiGuideLauncher } from '@/composables/useAiGuideLauncher'

const { isGuideOpen, closeGuide } = useAiGuideLauncher()

const {
  guideMessages,
  guideLoading,
  guideError,
  hasGuideHistory,
  lastAnswerRating,
  resetGuide,
  restoreGuide,
  rateAnswer,
  loadQuickCommands,
} = useAiAssistant()

const {
  draft,
  historyEl,
  copiedIndex,
  suggestions,
  submitQuestion,
  sendSuggestion,
  copyText,
  formatTime,
  renderedText,
  markHistoryShown,
} = useAiGuideDialog()

/**
 * При открытии подтягивает диалог с сервера и гасит перепечатку истории.
 */
watch(isGuideOpen, async (open) => {
  if (!open) return
  await Promise.all([restoreGuide(), loadQuickCommands()])
  markHistoryShown()
})
</script>
<template>
  <Dialog
    v-model:visible="isGuideOpen"
    modal
    dismissableMask
    :draggable="false"
    :closable="false"
    aria-label="Чат с AI-гидом"
    :style="{ width: '620px', maxWidth: '96vw' }"
    :breakpoints="{ '640px': '96vw' }"
    :pt="{
      root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-white/10 !bg-white dark:!bg-zinc-900 overflow-hidden mobile-sheet' },
      header: { class: '!p-4 sm:!p-5 !pb-0 !border-0' },
      content: { class: '!px-4 !pb-4 sm:!px-5 sm:!pb-5 !pt-2' },
    }"
  >
    <template #header>
      <div class="flex w-full items-center gap-3">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-500 text-lg text-white shadow-glow">
          <i class="pi pi-sparkles"></i>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[15px] font-black tracking-tight dark:text-white">UPin AI</span>
          <span class="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-400">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            онлайн · гид по приложению
          </span>
        </span>
        <Button
          v-if="hasGuideHistory"
          icon="pi pi-refresh"
          text
          rounded
          aria-label="Начать диалог заново"
          title="Начать заново"
          @click="resetGuide"
        />
        <Button icon="pi pi-times" text rounded aria-label="Закрыть" @click="closeGuide" />
      </div>
    </template>

    <section aria-label="Диалог с гидом" class="flex flex-col gap-3">
      <div
        ref="historyEl"
        role="log"
        aria-live="polite"
        aria-label="История диалога"
        class="max-h-[52dvh] min-h-[240px] space-y-3 overflow-y-auto overscroll-contain rounded-3xl bg-stone-50 p-3 sm:max-h-[46vh] sm:p-4 dark:bg-zinc-900/60"
      >
        <div v-if="!hasGuideHistory && !guideLoading" class="flex flex-col items-center px-2 py-6 text-center">
          <span class="grid h-16 w-16 place-items-center rounded-[22px] bg-rose-500 text-2xl text-white shadow-glow">
            <i class="pi pi-sparkles"></i>
          </span>
          <p class="mt-4 text-[15px] font-black tracking-tight dark:text-white">Привет! Я гид по UPin</p>
          <p class="mt-1 max-w-[280px] text-[13px] leading-relaxed text-stone-500 dark:text-zinc-400">
            Спроси про свайпы, пины, ленту, районы — или жми подсказку ниже
          </p>
          <div class="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              v-for="s in suggestions"
              :key="s.text"
              :icon="s.icon"
              :label="s.text"
              outlined
              rounded
              size="small"
              class="!justify-start !bg-white dark:!bg-zinc-800"
              @click="sendSuggestion(s.question)"
            />
          </div>
        </div>
        <template v-else>
          <div v-for="(msg, i) in guideMessages" :key="i" class="flex flex-col gap-1">
            <div v-if="msg.role === 'user'" class="flex flex-col items-end">
              <p class="max-w-[88%] rounded-2xl rounded-br-md bg-rose-500 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow">
                {{ msg.text }}
              </p>
              <time v-if="formatTime(msg.at)" class="pr-1 text-[10px] text-stone-400 dark:text-zinc-500">{{ formatTime(msg.at) }}</time>
            </div>
            <div v-else class="flex items-end gap-2">
              <span class="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-rose-500 text-[11px] text-white">
                <i class="pi pi-sparkles"></i>
              </span>
              <div class="flex min-w-0 max-w-[88%] flex-col gap-1">
                <div
                  v-html="renderedText(msg.text, i)"
                  class="ai-body rounded-2xl rounded-bl-md border border-stone-200/70 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                ></div>
                <span class="flex items-center gap-2 pl-1">
                  <time v-if="formatTime(msg.at)" class="text-[10px] text-stone-400 dark:text-zinc-500">{{ formatTime(msg.at) }}</time>
                  <button
                    type="button"
                    :aria-label="copiedIndex === i ? 'Скопировано' : 'Скопировать ответ'"
                    class="grid h-6 w-6 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                    @click="copyText(msg.text, i)"
                  >
                    <i :class="copiedIndex === i ? 'pi pi-check text-[11px] text-emerald-500' : 'pi pi-copy text-[11px]'"></i>
                  </button>
                </span>
              </div>
            </div>
          </div>
          <div v-if="guideLoading" class="flex items-end gap-2" aria-label="Гид печатает">
            <span class="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-rose-500 text-[11px] text-white">
              <i class="pi pi-sparkles"></i>
            </span>
            <span class="flex gap-1.5 rounded-2xl rounded-bl-md border border-stone-200/70 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <span class="h-2 w-2 animate-bounce rounded-full bg-rose-400 [animation-delay:0ms]"></span>
              <span class="h-2 w-2 animate-bounce rounded-full bg-rose-400 [animation-delay:150ms]"></span>
              <span class="h-2 w-2 animate-bounce rounded-full bg-rose-400 [animation-delay:300ms]"></span>
            </span>
          </div>
        </template>
      </div>
      <Message v-if="guideError" severity="error" :closable="false" class="!rounded-2xl">{{ guideError }}</Message>
      <div v-if="hasGuideHistory && !guideLoading && lastAnswerRating === null" class="flex items-center gap-1 px-1 text-xs text-stone-500 dark:text-zinc-400">
        <span class="mr-1">Ответ помог?</span>
        <button
          type="button"
          aria-label="Ответ помог"
          class="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-stone-200/60 hover:text-emerald-600 dark:hover:bg-zinc-700"
          @click="rateAnswer(1)"
        >
          <i class="pi pi-thumbs-up text-[12px]"></i>
        </button>
        <button
          type="button"
          aria-label="Ответ не помог"
          class="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-stone-200/60 hover:text-rose-600 dark:hover:bg-zinc-700"
          @click="rateAnswer(-1)"
        >
          <i class="pi pi-thumbs-down text-[12px]"></i>
        </button>
      </div>
      <div class="rounded-[24px] border border-stone-200 bg-white p-2 pl-4 transition focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-500/20 dark:border-zinc-700 dark:bg-zinc-900">
        <div class="flex items-end gap-2">
          <Textarea
            v-model="draft"
            rows="1"
            autoResize
            maxlength="1000"
            placeholder="Спроси что-нибудь…"
            aria-label="Вопрос гиду"
            class="max-h-32 min-h-11 flex-1 !border-0 !bg-transparent !px-0 !py-2.5 !shadow-none !outline-none focus:!border-0 focus:!shadow-none focus:!outline-none focus:!ring-0"
            @keydown.enter.exact.prevent="submitQuestion"
          />
          <Button
            icon="pi pi-send"
            rounded
            aria-label="Отправить вопрос"
            title="Отправить"
            :loading="guideLoading"
            :disabled="draft.trim() === '' || guideLoading"
            class="!h-11 !w-11 shrink-0 !border-0 !bg-rose-500"
            @click="submitQuestion"
          />
        </div>
      </div>
      <p class="px-1 text-[11px] text-stone-400 dark:text-zinc-500">Enter — отправить · Shift+Enter — новая строка</p>
    </section>
  </Dialog>
</template>
<style scoped>
/* v-html-контент ответов: Tailwind-классы внутрь не пробросить,
   поэтому типографика markdown — через :deep (тёмная тема рядом). */
:deep(.ai-body p) { margin: 0.35em 0; }
:deep(.ai-body p:first-child) { margin-top: 0; }
:deep(.ai-body p:last-child) { margin-bottom: 0; }
:deep(.ai-body strong) { font-weight: 800; }
:deep(.ai-body h4) { margin: 0.55em 0 0.3em; font-size: 0.85rem; font-weight: 800; letter-spacing: -0.01em; }
:deep(.ai-body ul),
:deep(.ai-body ol) { margin: 0.35em 0; padding-left: 1.2em; }
:deep(.ai-body ul) { list-style: disc; }
:deep(.ai-body ol) { list-style: decimal; }
:deep(.ai-body li) { margin: 0.18em 0; }
:deep(.ai-body li::marker) { color: #f43f5e; font-weight: 700; }
:deep(.ai-body blockquote) { margin: 0.4em 0; padding: 0.15em 0 0.15em 0.65em; border-left: 3px solid #fb7185; opacity: 0.9; }
:deep(.ai-body code) { font-size: 0.82em; background: rgb(231 229 228 / 0.7); border-radius: 6px; padding: 0.1em 0.35em; }
:deep(.ai-body pre) { margin: 0.45em 0; padding: 0.65em 0.75em; border-radius: 12px; overflow-x: auto; background: #1c1917; color: #e7e5e4; font-size: 0.8rem; line-height: 1.5; }
:deep(.ai-body pre code) { background: none; padding: 0; color: inherit; }
:deep(.ai-body a) { color: #e11d48; text-decoration: underline; text-underline-offset: 2px; }
:deep(.ai-caret) { display: inline-block; width: 2px; height: 1em; margin-left: 2px; vertical-align: -0.15em; background: #f43f5e; animation: ai-blink 0.9s steps(2, start) infinite; }
.dark :deep(.ai-body code) { background: rgb(63 63 70 / 0.8); }
.dark :deep(.ai-body a) { color: #fda4af; }
@keyframes ai-blink { to { visibility: hidden; } }
</style>
