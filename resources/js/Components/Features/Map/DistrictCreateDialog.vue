<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { DISTRICT_INTEREST_OPTIONS } from '@/utils/districtGeo'

const props = defineProps<{ open: boolean; saving: boolean; strokesCount: number; serverError?: string | null }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'save', v: { name: string; description: string | null; interest: string }): void
}>()

const name = ref('')
const description = ref('')
const interest = ref('neighbors')
const formError = ref<string | null>(null)

watch(
  () => props.open,
  (v) => {
    if (v) {
      name.value = ''
      description.value = ''
      interest.value = 'neighbors'
      formError.value = null
    }
  },
)

function submit(): void {
  const clean = name.value.trim()
  if (clean.length < 3) {
    formError.value = 'Название — минимум 3 символа'
    return
  }
  formError.value = null
  emit('save', { name: clean, description: description.value.trim() || null, interest: interest.value })
}
</script>
<template>
  <Dialog :visible="open" modal dismissableMask :style="{ width: '560px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-white/10 overflow-hidden !bg-white dark:!bg-[#0F121F]' }, header: { class: '!p-0 !border-0 !bg-white dark:!bg-[#0F121F]' }, content: { class: '!px-5 !py-0 sm:!px-6 !bg-white dark:!bg-[#0F121F] !max-h-[70dvh] !overflow-y-auto' }, footer: { class: '!p-5 sm:!px-6 !pt-2 !border-0 !bg-white dark:!bg-[#0F121F]' } }" @update:visible="(v:boolean)=>emit('update:open', v)">
    <template #header>
      <div class="w-full">
        <div class="relative h-[118px] sm:h-[132px] overflow-hidden bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500">
          <i class="pi pi-map-marker absolute left-8 top-4 text-white/20 text-3xl -rotate-12 pointer-events-none" />
          <i class="pi pi-home absolute left-[38%] bottom-3 text-white/10 text-4xl rotate-6 pointer-events-none" />
          <i class="pi pi-heart absolute right-20 top-6 text-white/15 text-2xl rotate-12 pointer-events-none" />
          <i class="pi pi-users absolute right-8 bottom-5 text-white/10 text-3xl -rotate-6 pointer-events-none" />
          <div class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
          <div class="absolute left-5 top-4 sm:left-6"><Tag value="Новый район" icon="pi pi-sparkles" severity="contrast" class="!rounded-full !text-[11px] !font-bold !bg-white/15 !text-white !border !border-white/25 backdrop-blur" /></div>
          <div class="absolute left-5 bottom-2.5 sm:left-6 text-[11px] font-semibold text-white/80">сообщество · заливка из {{ strokesCount }} {{ strokesCount === 1 ? 'чертежа' : 'чертежей' }} · увидят все</div>
        </div>
        <div class="px-5 sm:px-6">
          <div class="flex items-end gap-3 -mt-8">
            <span class="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white grid place-items-center shadow-glow shrink-0 ring-4 ring-white dark:ring-[#0F121F] text-xl"><i class="pi pi-palette" /></span>
            <div class="min-w-0 flex-1 pb-0.5">
              <InputText v-model="name" maxlength="80" placeholder="Название района" class="w-full !border-0 !bg-transparent !shadow-none !ring-0 !rounded-none !px-0 !py-0 !font-black !text-[19px] !tracking-tight dark:!text-white placeholder:!text-stone-400 placeholder:!font-bold focus:!border-0 focus:!shadow-none focus:!ring-0" />
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">вы — создатель · заявки решаете вы</div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div class="flex flex-col gap-4 pt-4">
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-2xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-2.5 py-2.5 flex flex-col gap-1.5">
          <span class="w-8 h-8 rounded-xl bg-violet-600/15 text-violet-700 dark:text-violet-300 grid place-items-center text-sm shrink-0"><i class="pi pi-comments" /></span>
          <div class="text-[11px] font-bold leading-tight dark:text-white">Общий чат</div>
          <div class="text-[10px] leading-tight text-stone-500 dark:text-zinc-400">появится сразу</div>
        </div>
        <div class="rounded-2xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-2.5 py-2.5 flex flex-col gap-1.5">
          <span class="w-8 h-8 rounded-xl bg-teal-600/15 text-teal-700 dark:text-teal-300 grid place-items-center text-sm shrink-0"><i class="pi pi-users" /></span>
          <div class="text-[11px] font-bold leading-tight dark:text-white">Участники</div>
          <div class="text-[10px] leading-tight text-stone-500 dark:text-zinc-400">вы — первый</div>
        </div>
        <div class="rounded-2xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-2.5 py-2.5 flex flex-col gap-1.5">
          <span class="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 grid place-items-center text-sm shrink-0"><i class="pi pi-user-plus" /></span>
          <div class="text-[11px] font-bold leading-tight dark:text-white">Заявки</div>
          <div class="text-[10px] leading-tight text-stone-500 dark:text-zinc-400">пускать или нет</div>
        </div>
      </div>
      <div>
        <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">О районе</label>
        <Textarea v-model="description" maxlength="500" rows="3" auto-resize placeholder="Вечерний футбол, соседи с собаками, книжный клуб…" class="w-full mt-1.5" />
      </div>
      <div>
        <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Интересы</label>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <button
            v-for="o in DISTRICT_INTEREST_OPTIONS"
            :key="o.v"
            type="button"
            :class="['px-3 py-2 rounded-full text-xs font-bold border transition active:scale-95 hover:border-violet-400 dark:hover:border-violet-400/60', interest === o.v ? 'bg-violet-700 text-white border-violet-700 shadow-glow hover:bg-violet-600' : 'bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-zinc-200 border-stone-200 dark:border-white/10 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-200']"
            @click="interest = o.v"
          >{{ o.i }} {{ o.l }}</button>
        </div>
      </div>
      <Message v-if="formError || serverError" severity="error" :closable="false" class="!rounded-2xl !text-xs">{{ formError || serverError }}</Message>
      <div class="rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/60 px-3.5 py-2.5 text-[11px] leading-snug text-violet-900 dark:text-violet-200 flex gap-2"><i class="pi pi-lock text-xs mt-0.5 shrink-0" /><span>Закрытое сообщество: пины внутри увидят только жители. Чтобы попасть внутрь, люди кинут заявку — вы решите, пускать или нет.</span></div>
    </div>
    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row gap-2">
        <Button label="Назад к кисти" severity="secondary" outlined rounded class="flex-1 hover:!bg-stone-100 dark:hover:!bg-white/10 active:scale-[0.99] transition" :disabled="saving" @click="emit('update:open', false)" />
        <Button label="Создать район" icon="pi pi-check" rounded class="flex-[1.4] !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !border-0 !shadow-glow !text-white hover:!opacity-90 hover:!brightness-110 active:scale-[0.99] transition disabled:!opacity-50" :loading="saving" @click="submit" />
      </div>
    </template>
  </Dialog>
</template>
