<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import Toast from 'primevue/toast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import DistrictInterestPicker from '@/Components/Features/Districts/DistrictInterestPicker.vue'
import { useDistrictCreatePage } from '@/composables/useDistrictCreatePage'

const props = defineProps<{
  canCreate: boolean
  limitText: string
}>()

const page = useDistrictCreatePage(props.canCreate, props.limitText)
</script>

<template>
  <Head title="Новое сообщество" />
  <Toast />
    <div class="bg-surface dark:bg-[#090E1A]">
      <div class="mx-auto max-w-[1000px] px-3 py-3 sm:px-6 sm:py-6">
        <div class="mb-3 flex items-center gap-2 text-[13px] font-semibold text-stone-500 dark:text-zinc-400">
          <Link href="/districts" class="hover:text-blue-600 hover:underline dark:hover:text-blue-400">Районы</Link>
          <i class="pi pi-chevron-right text-[10px]" />
          <span class="text-ink-900 dark:text-zinc-200">Новое сообщество</span>
        </div>

        <div class="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div class="overflow-hidden rounded-3xl border border-stone-200/70 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div class="relative h-28 bg-stone-100 sm:h-36 dark:bg-zinc-800">
              <div
                class="absolute inset-0 opacity-60 dark:opacity-40"
                style="background-image: radial-gradient(circle at 1px 1px, rgba(100,116,139,0.28) 1px, transparent 0); background-size: 18px 18px"
              />
              <i class="pi pi-users absolute right-4 top-4 text-2xl text-stone-300 dark:text-zinc-700" />
              <span class="absolute left-4 top-4 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white">Новое сообщество</span>
            </div>
            <div class="p-4 sm:p-6">
              <div class="flex items-start gap-3">
                <div class="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-blue-600 text-2xl font-black text-white sm:h-20 sm:w-20">
                  {{ page.avatarLetter.value }}
                </div>
                <div class="min-w-0 flex-1">
                  <InputText v-model="page.name.value" maxlength="80" placeholder="Название сообщества" class="w-full !border-0 !bg-transparent !px-0 !text-xl !font-black !tracking-tight !shadow-none placeholder:!font-bold placeholder:!text-stone-400 focus:!ring-0 dark:!text-white sm:!text-2xl" />
                  <div class="truncate text-xs text-stone-500 dark:text-zinc-400">вы — создатель · заявки решаете вы · {{ page.limitText }}</div>
                </div>
              </div>

              <div class="mt-4 grid grid-cols-3 gap-2">
                <div class="flex flex-col gap-1 rounded-2xl border border-stone-200/70 bg-stone-50 p-2.5 dark:border-zinc-800 dark:bg-white/[0.03]">
                  <span class="grid h-8 w-8 place-items-center rounded-xl bg-blue-600/10 text-sm text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"><i class="pi pi-comments" /></span>
                  <div class="text-[11px] font-bold leading-tight text-ink-900 dark:text-white">Общий чат</div>
                  <div class="text-[10px] leading-tight text-stone-500 dark:text-zinc-400">появится сразу</div>
                </div>
                <div class="flex flex-col gap-1 rounded-2xl border border-stone-200/70 bg-stone-50 p-2.5 dark:border-zinc-800 dark:bg-white/[0.03]">
                  <span class="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-sm text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"><i class="pi pi-users" /></span>
                  <div class="text-[11px] font-bold leading-tight text-ink-900 dark:text-white">Участники</div>
                  <div class="text-[10px] leading-tight text-stone-500 dark:text-zinc-400">вы — первый</div>
                </div>
                <div class="flex flex-col gap-1 rounded-2xl border border-stone-200/70 bg-stone-50 p-2.5 dark:border-zinc-800 dark:bg-white/[0.03]">
                  <span class="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-sm text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"><i class="pi pi-user-plus" /></span>
                  <div class="text-[11px] font-bold leading-tight text-ink-900 dark:text-white">Заявки</div>
                  <div class="text-[10px] leading-tight text-stone-500 dark:text-zinc-400">пускать или нет</div>
                </div>
              </div>

              <div class="mt-4">
                <label class="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Описание</label>
                <Textarea v-model="page.description.value" maxlength="500" rows="3" auto-resize placeholder="Вечерний футбол, соседи с собаками, книжный клуб…" class="mt-1.5 w-full !rounded-2xl" />
              </div>

              <div class="mt-4">
                <label class="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Направление · {{ page.interestLabel.value }}</label>
                <DistrictInterestPicker :selected="page.interest.value" class="mt-1.5" @select="page.setInterest" />
              </div>

              <Message v-if="page.formError.value || page.serverError.value" severity="error" :closable="false" class="mt-3 !rounded-2xl !text-xs">
                {{ page.formError.value || page.serverError.value }}
              </Message>
              <Message v-if="!page.canCreate" severity="warn" :closable="false" class="mt-3 !rounded-2xl !text-xs">
                Лимит исчерпан: {{ page.limitText }}. Удалите лишний район или смените тариф.
              </Message>

              <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
                <Button label="Назад к карте" severity="secondary" outlined rounded class="flex-1" @click="page.backToMap()" />
                <Button label="Создать сообщество" icon="pi pi-check" rounded :loading="page.creating.value" :disabled="!page.canSubmit.value" class="flex-[1.4] !border-0 !bg-blue-600 !text-white hover:!bg-blue-500 disabled:!opacity-50" @click="page.submit()" />
              </div>
            </div>
          </div>

          <aside class="grid gap-3">
            <div class="rounded-3xl border border-stone-200/70 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div class="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Заливка с карты</div>
              <div v-if="page.hasDraft.value" class="mt-2 flex items-center gap-2.5">
                <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"><i class="pi pi-check" /></span>
                <div class="min-w-0 text-[13px]">
                  <div class="font-bold text-ink-900 dark:text-white">Готова к публикации</div>
                  <div class="truncate text-[11px] text-stone-500 dark:text-zinc-400">{{ page.strokesCount.value }} {{ page.strokesCount.value === 1 ? 'чертежа' : 'чертежей' }} · {{ page.pointsCount.value }} точек</div>
                </div>
              </div>
              <div v-else class="mt-2 text-[13px] leading-relaxed text-stone-500 dark:text-zinc-400">
                Нет заливки. Нарисуйте район чертежом на карте — потом вернитесь сюда.
              </div>
              <Button :label="page.hasDraft.value ? 'Перерисовать' : 'Нарисовать на карте'" icon="pi pi-palette" rounded outlined size="small" class="mt-3 w-full" @click="page.backToMap()" />
            </div>
            <div class="rounded-3xl border border-blue-100 bg-blue-50/60 p-4 text-[12px] leading-relaxed text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
              <div class="flex gap-2"><i class="pi pi-lock mt-0.5 shrink-0 text-xs" /><span>Закрытое сообщество: пины внутри увидят только жители. Люди кинут заявку — вы решите, пускать или нет.</span></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
</template>
