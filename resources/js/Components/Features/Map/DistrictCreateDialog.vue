<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
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
  <Dialog :visible="open" modal dismissableMask header="Новый район" :style="{ width: '560px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] !border-stone-200 dark:!border-white/10 overflow-hidden !bg-white dark:!bg-zinc-900' }, header: { class: '!p-5 sm:!p-6 !pb-0 !border-0 !bg-white dark:!bg-zinc-900' }, content: { class: '!p-5 sm:!px-6 !bg-white dark:!bg-zinc-900 !max-h-[70dvh] !overflow-y-auto' }, footer: { class: '!p-5 sm:!px-6 !pt-0 !border-0 !bg-white dark:!bg-zinc-900' } }" @update:visible="(v:boolean)=>emit('update:open', v)">
    <template #header>
      <div class="flex items-center gap-3">
        <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-700 to-purple-900 text-white grid place-items-center shadow-glow shrink-0"><i class="pi pi-palette" /></span>
        <div class="min-w-0"><div class="font-black text-[17px] tracking-tight dark:text-white">Новый район</div><div class="text-xs text-stone-500 dark:text-zinc-400">Заливка из {{ strokesCount }} {{ strokesCount === 1 ? 'мазка' : 'мазков' }} · увидят все</div></div>
      </div>
    </template>
    <div class="flex flex-col gap-3.5">
      <div>
        <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Название</label>
        <InputText v-model="name" maxlength="80" placeholder="Тихий дворик" class="w-full mt-1" />
      </div>
      <div>
        <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Чем тут занимаются</label>
        <Textarea v-model="description" maxlength="500" rows="3" auto-resize placeholder="Вечерний футбол, соседи с собаками, книжный клуб…" class="w-full mt-1" />
      </div>
      <div>
        <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Интерес островка</label>
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
      <div class="rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/60 px-3.5 py-2.5 text-[11px] leading-snug text-violet-900 dark:text-violet-200">Пины внутри увидят только жители. Чтобы попасть внутрь, люди кинут заявку — вы решите, пускать или нет. У района появится общий чат.</div>
    </div>
    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row gap-2">
        <Button label="Назад к кисти" severity="secondary" outlined rounded class="flex-1 hover:!bg-stone-100 dark:hover:!bg-white/10 active:scale-[0.99] transition" :disabled="saving" @click="emit('update:open', false)" />
        <Button label="Создать район" icon="pi pi-check" rounded class="flex-[1.4] !bg-gradient-to-r !from-violet-700 !to-purple-900 !border-0 !shadow-glow !text-white hover:!opacity-90 hover:!brightness-110 active:scale-[0.99] transition disabled:!opacity-50" :loading="saving" @click="submit" />
      </div>
    </template>
  </Dialog>
</template>
