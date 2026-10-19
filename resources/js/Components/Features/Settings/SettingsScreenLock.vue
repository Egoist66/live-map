<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Message from 'primevue/message'
import { useScreenLockSetup, sanitizeLockCode } from '@/composables/useScreenLock'
import { SCREEN_LOCK_TIMEOUTS, CODE_KINDS } from '@/validation/schemas/screenlock.schema'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

const f = useScreenLockSetup()
const { selectPt } = useDropdownMenuStyle()

function clean(v: any) {
  return sanitizeLockCode(v, (f.kindField as any)?.value ?? 'pin4')
}
function isAlpha(): boolean {
  return (f.kindField as any)?.value === 'alpha8'
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="font-black tracking-tight text-lg dark:text-white flex items-center gap-2">
            <span class="w-9 h-9 rounded-2xl grid place-items-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-base shrink-0"><i class="pi pi-lock" /></span>
            Пароль на приложение
          </h3>
        </div>
      </div>
      <div class="mt-5 max-w-xl">
        <div v-if="f.lock.enabled.value" class="space-y-4">
          <Message severity="success" :closable="false" class="!rounded-2xl !text-xs">Включён ({{ f.lock.kind.value === 'alpha8' ? 'пароль · 8 символов' : 'PIN · 4 цифры' }}) · автоблок через {{ f.lock.timeoutMin.value }} мин · хранится на этом устройстве</Message>
          <div>
            <label class="text-sm font-medium dark:text-white">Блокировать через</label>
            <Select
              :modelValue="f.lock.timeoutMin.value"
              @update:modelValue="(v:number)=>f.lock.changeTimeout(v)"
              :options="[...SCREEN_LOCK_TIMEOUTS]"
              optionLabel="l"
              optionValue="v"
              fluid
              class="w-full min-w-0 mt-1 !rounded-xl"
              :pt="selectPt"
            />
            <Message v-if="f.lock.error.value" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.lock.error.value }}</Message>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button @click="f.lock.lockNow()" label="Заблокировать сейчас" icon="pi pi-lock" rounded class="!bg-ink-900 !border-ink-900 dark:!bg-white dark:!border-white dark:!text-ink-900 !text-white" />
            <Button @click="f.lock.remove()" :loading="f.lock.saving.value" label="Выключить" rounded outlined severity="danger" />
          </div>
        </div>
        <form v-else @submit.prevent="f.submit" class="space-y-4">
          <div>
            <label class="text-sm font-medium dark:text-white">Тип пароля</label>
            <div class="grid grid-cols-2 gap-2 mt-1.5">
              <button v-for="k in CODE_KINDS" :key="k.v" type="button" @click="f.setKind(k.v)" :class="['rounded-2xl border p-3 text-left transition active:scale-[0.98]', (f.kindField as any).value === k.v ? '!border-violet-500 !bg-violet-50 dark:!bg-violet-950/40 shadow-soft' : 'border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800']">
                <span class="block text-sm font-bold dark:text-white">{{ k.l }}</span>
                <span class="block text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">{{ k.d }}</span>
              </button>
            </div>
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="text-sm font-medium dark:text-white">{{ isAlpha() ? 'Пароль (8 символов)' : 'PIN (4 цифры)' }}</label>
              <InputText :modelValue="f.code.value" @update:modelValue="(v: string | undefined)=>{ (f.code.value as any)=clean(v) }" v-bind="f.codeAttrs" :inputmode="isAlpha() ? 'text' : 'numeric'" :maxlength="isAlpha() ? 8 : 4" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" :placeholder="isAlpha() ? '••••••••' : '••••'" class="w-full mt-1 !rounded-2xl tracking-[0.5em] text-center font-black" :invalid="!!f.errors.value.code" />
              <Message v-if="f.errors.value.code" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.code }}</Message>
            </div>
            <div>
              <label class="text-sm font-medium dark:text-white">Повтори</label>
              <InputText :modelValue="f.confirm.value" @update:modelValue="(v: string | undefined)=>{ (f.confirm.value as any)=clean(v) }" v-bind="f.confirmAttrs" :inputmode="isAlpha() ? 'text' : 'numeric'" :maxlength="isAlpha() ? 8 : 4" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" :placeholder="isAlpha() ? '••••••••' : '••••'" class="w-full mt-1 !rounded-2xl tracking-[0.5em] text-center font-black" :invalid="!!f.errors.value.confirm" />
              <Message v-if="f.errors.value.confirm" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.confirm }}</Message>
            </div>
          </div>
          <div>
            <label class="text-sm font-medium dark:text-white">Блокировать через</label>
            <Select v-model="f.timeout.value" :options="[...SCREEN_LOCK_TIMEOUTS]" optionLabel="l" optionValue="v" fluid class="w-full min-w-0 mt-1 !rounded-xl" :pt="selectPt" />
            <Message v-if="f.errors.value.timeout" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.timeout }}</Message>
          </div>
          <Message v-if="f.lock.error.value" severity="error" :closable="false" class="!rounded-2xl !text-xs">{{ f.lock.error.value }}</Message>
          <Button :loading="f.lock.saving.value" type="submit" label="Активировать скринлокер" icon="pi pi-lock" rounded class="!bg-black dark:!bg-white dark:!text-ink-900 !border-black dark:!border-white" />
        </form>
      </div>
    </template>
  </Card>
</template>
