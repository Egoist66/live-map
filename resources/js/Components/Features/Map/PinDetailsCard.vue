<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Chip from 'primevue/chip'
import { avatarSrcFor } from '@/composables/useAvatar'
import { pinBlurInfo } from '@/composables/useLocationBlur'
import { formatTime } from '@/utils/date'

const props = defineProps<{ pin: any; comments: any[]; commentText: string; creatingComment: boolean; editingCommentId: number | null; editingContent: string; savingComment: boolean; reacting: boolean; reporting: boolean; pinEdit: any; categories: any[]; deleting: boolean; authId: number }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'delete'): void; (e: 'react', k: string): void; (e: 'report'): void; (e: 'sendComment'): void; (e: 'update:comment', v: string): void; (e: 'update:editContent', v: string): void; (e: 'startEditComment', c: any): void; (e: 'cancelEditComment'): void; (e: 'saveEditComment'): void; (e: 'saveEdit'): void }>()
const blur = computed(() => pinBlurInfo(props.pin))
</script>
<template>
  <div v-if="pin" class="absolute inset-x-2 sm:inset-x-auto bottom-2 sm:bottom-4 top-auto max-h-[72dvh] sm:right-4 sm:top-4 sm:w-[380px] sm:max-h-none bg-white dark:bg-zinc-900 rounded-[20px] shadow-float border border-stone-200 dark:border-zinc-700 flex flex-col overflow-hidden z-20">
    <div class="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-700 shrink-0">
      <div v-if="!pinEdit.editing.value" class="flex justify-between items-start gap-3">
        <h3 class="font-bold leading-tight pr-2 text-[15px] break-words min-w-0 flex-1">{{ pin.title }}</h3>
        <div class="flex items-center gap-1 shrink-0">
          <Button v-if="pin.is_owner" icon="pi pi-pencil" rounded text size="small" @click="pinEdit.start(pin)" />
          <Button v-if="pin.is_owner" icon="pi pi-trash" severity="danger" rounded text size="small" :loading="deleting" @click="emit('delete')" />
          <Button icon="pi pi-times" rounded text size="small" @click="emit('close')" />
        </div>
      </div>
      <div v-else class="space-y-3">
        <InputText v-model="pinEdit.title.value" v-bind="pinEdit.titleAttrs" maxlength="100" placeholder="Заголовок" class="w-full !rounded-xl" />
        <Textarea v-model="pinEdit.body.value" rows="3" maxlength="1000" placeholder="Подробности" autoResize class="w-full !rounded-xl" />
        <div class="flex gap-1.5 flex-wrap"><button v-for="c in categories" :key="c.v" @click="(pinEdit.category.value as any) = c.v" :class="['px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95', (pinEdit.category.value as any) === c.v ? 'bg-stone-900 dark:bg-white text-white dark:text-ink-900 border-stone-900 dark:border-white' : 'bg-zinc-500/10 dark:bg-zinc-500/15 border-zinc-500/25 dark:border-zinc-500/30 text-ink-900 dark:text-zinc-200 hover:bg-zinc-500/20']">{{ c.i }} {{ c.l }}</button></div>
        <div class="flex gap-2">
          <Button label="Сохранить" rounded class="flex-1 !bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-stone-900 dark:!border-white" :loading="pinEdit.updating" @click="emit('saveEdit')" />
          <Button label="Отмена" severity="secondary" outlined rounded class="flex-1" @click="pinEdit.cancel()" />
        </div>
      </div>
      <p v-if="!pinEdit.editing.value" class="text-sm text-stone-600 dark:text-zinc-300 mt-2 leading-relaxed break-words overflow-wrap-anywhere">{{ pin.body }}</p>
      <div v-if="!pinEdit.editing.value && blur" title="Точка на карте сдвинута от реального места" class="mt-2 text-[11px] leading-snug bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200 rounded-xl px-2.5 py-1.5">📍 {{ blur.hint }}</div>
      <div v-if="!pinEdit.editing.value" class="flex flex-wrap gap-1.5 mt-3 items-center">
        <span class="text-xs bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 rounded-full px-2.5 py-1 font-medium">{{ pin.category }}</span>
        <Link v-if="pin.user && !pin.is_anonymous" :href="`/users/${pin.user.id}`" class="hover:opacity-80"><Chip :label="`${pin.user?.name} · ${pin.user?.level || 'novice'}`" :image="avatarSrcFor(pin.user) || undefined" class="!bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-full !text-xs !text-ink-900 dark:!text-zinc-100" /></Link>
        <span class="text-xs bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-400/30 text-amber-800 dark:text-amber-300 rounded-full px-2.5 py-1">{{ pin.expires_at ? `до ${formatTime(pin.expires_at)}` : '∞ бессрочно' }}</span>
      </div>
      <div class="flex gap-1.5 mt-4">
        <button @click="emit('react', 'like')" :disabled="reacting" :class="['flex-1 rounded-full py-2.5 text-xs font-semibold border active:scale-95 transition disabled:opacity-50', pin.my_reaction === 'like' ? 'bg-rose-500 text-white border-rose-500 shadow-[0_4px_16px_-4px_rgba(244,63,94,0.5)]' : 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/30 dark:border-rose-400/30 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20']">❤️ {{ pin.reactions_count || 0 }}</button>
        <button @click="emit('react', 'fire')" :disabled="reacting" :class="['px-4 rounded-full text-xs font-semibold border active:scale-95 transition disabled:opacity-50', pin.my_reaction === 'fire' ? 'bg-orange-500 text-white border-orange-500 shadow-[0_4px_16px_-4px_rgba(249,115,22,0.5)]' : 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/30 dark:border-orange-400/30 hover:bg-orange-500/20']">🔥</button>
        <button @click="emit('react', 'useful')" :disabled="reacting" :class="['px-4 rounded-full text-xs font-semibold border active:scale-95 transition disabled:opacity-50', pin.my_reaction === 'useful' ? 'bg-emerald-500 text-white border-emerald-500 shadow-[0_4px_16px_-4px_rgba(16,185,129,0.5)]' : 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 dark:border-emerald-400/30 hover:bg-emerald-500/20']">👍</button>
        <button @click="emit('report')" :disabled="reporting" class="w-10 h-10 rounded-full grid place-items-center border active:scale-95 transition disabled:opacity-50 bg-zinc-500/10 dark:bg-zinc-500/15 border-zinc-500/25 dark:border-zinc-500/30 text-zinc-500 dark:text-zinc-300 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400">⚠</button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/40 dark:bg-black/30">
      <div v-for="c in comments" :key="c.id" class="bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-3.5">
        <div class="font-semibold text-xs flex items-center gap-2 dark:text-zinc-100">{{ c.is_anonymous ? 'аноним' : c.user?.name }}<span class="text-stone-400 dark:text-zinc-400 font-normal">{{ formatTime(c.created_at) }}</span></div>
        <div v-if="editingCommentId !== c.id" class="text-sm text-stone-700 dark:text-zinc-200 mt-1.5 break-words">{{ c.content }}</div>
        <div v-else class="mt-2"><Textarea :model-value="editingContent" @update:model-value="(v:any)=>emit('update:editContent', v)" rows="2" maxlength="1000" class="w-full !rounded-xl" /><div class="flex gap-2 mt-2"><Button label="Сохранить" size="small" rounded :loading="savingComment" @click="emit('saveEditComment')" /><Button label="Отмена" size="small" severity="secondary" outlined rounded @click="emit('cancelEditComment')" /></div></div>
        <div v-if="editingCommentId !== c.id" class="mt-2 flex gap-1"><Button v-if="c.user_id === authId" label="ред." size="small" text @click="emit('startEditComment', c)" /></div>
      </div>
      <div v-if="!comments.length" class="text-center py-10"><div class="text-xs text-stone-400 mt-2">Комментариев пока нет<br />Будь первым</div></div>
    </div>
    <form @submit.prevent="emit('sendComment')" class="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t bg-white dark:bg-zinc-900 dark:border-zinc-700 flex gap-2 shrink-0">
      <InputText :model-value="commentText" @update:model-value="(v:any)=>emit('update:comment', v)" placeholder="Написать комментарий..." class="flex-1 !rounded-full" :disabled="creatingComment" />
      <Button type="submit" icon="pi pi-send" rounded class="!bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-stone-900 dark:!border-white" :loading="creatingComment" />
    </form>
  </div>
</template>
