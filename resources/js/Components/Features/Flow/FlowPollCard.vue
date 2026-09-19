<script setup lang="ts">
import Button from 'primevue/button'
import { useFlowPoll } from '@/composables/useFlowPoll'
import type { FlowPoll } from '@/types/flow'

const props = defineProps<{ postId: number; poll: FlowPoll; canClose: boolean }>()

const poller = useFlowPoll()
const voted = (optionId: number) => props.poll.voted_option_id === optionId
const showResults = () => votedAny() || props.poll.closed
const votedAny = () => props.poll.voted_option_id !== null

async function choose(optionId: number): Promise<void> {
  if (showResults() || poller.isBusy(props.poll.id)) return
  await poller.vote(props.postId, props.poll.id, optionId)
}
</script>

<template>
  <div class="mt-3 overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-800">
    <div class="space-y-1.5 p-3">
      <button
        v-for="o in poll.options"
        :key="o.id"
        type="button"
        :disabled="showResults() || poller.isBusy(poll.id)"
        class="relative block w-full overflow-hidden rounded-xl border text-left transition active:scale-[0.99] disabled:cursor-default"
        :class="voted(o.id) ? 'border-violet-500 dark:border-violet-400' : 'border-stone-200 dark:border-zinc-700 hover:border-violet-300'"
        @click="choose(o.id)"
      >
        <span
          v-if="showResults()"
          class="absolute inset-y-0 left-0 bg-violet-100 dark:bg-violet-500/20 transition-all"
          :style="{ width: `${poller.percent(o.votes_count, poll.total_votes)}%` }"
        />
        <span class="relative flex items-center gap-2 px-3 py-2.5">
          <i v-if="voted(o.id)" class="pi pi-check-circle text-sm text-violet-600 dark:text-violet-300" />
          <span class="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink-900 dark:text-zinc-100">{{ o.text }}</span>
          <span v-if="showResults()" class="shrink-0 text-xs font-bold text-stone-500 dark:text-zinc-400">{{ poller.percent(o.votes_count, poll.total_votes) }}%</span>
        </span>
      </button>
    </div>
    <div class="flex items-center gap-2 border-t border-stone-100 dark:border-zinc-800 px-3 py-2 text-xs text-stone-400 dark:text-zinc-500">
      <i class="pi pi-chart-bar text-[11px]" />
      <span>{{ poll.total_votes }} {{ poll.total_votes === 1 ? 'голос' : 'голосов' }} · {{ poller.closesLabel(poll) }}</span>
      <span class="flex-1" />
      <Button v-if="canClose && !poll.closed" label="Закрыть" link size="small" class="!text-[11px] !p-0" :loading="poller.isBusy(poll.id)" @click="poller.close(postId, poll.id)" />
    </div>
  </div>
</template>
