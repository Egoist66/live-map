<script setup lang="ts">
import { usePasswordForm } from '@/composables/usePasswordForm'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const f = usePasswordForm()
</script>

<template>
  <section>
    <header>
      <h2 class="font-bold dark:text-white">Смена пароля</h2>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Минимум 8 символов.</p>
    </header>
    <form @submit.prevent="f.submit" class="mt-6 space-y-4">
      <div>
        <label class="text-sm font-medium">Текущий пароль <span class="text-red-500">*</span></label>
        <div class="relative mt-1">
          <InputText v-model="f.current_password.value" v-bind="f.currentAttrs" :type="f.show1.value?'text':'password'" placeholder="••••••••" class="w-full pr-11" :invalid="!!f.errors.value.current_password" />
          <button type="button" @click="f.show1.value=!f.show1.value" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500">{{ f.show1.value?'🙈':'👁' }}</button>
        </div>
        <small class="text-red-500">{{ f.errors.value.current_password }}</small>
      </div>
      <div>
        <label class="text-sm font-medium">Новый пароль <span class="text-red-500">*</span></label>
        <div class="relative mt-1">
          <InputText v-model="f.password.value" v-bind="f.passwordAttrs" :type="f.show2.value?'text':'password'" placeholder="Не менее 8 символов" class="w-full pr-11" :invalid="!!f.errors.value.password" />
          <button type="button" @click="f.show2.value=!f.show2.value" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500">{{ f.show2.value?'🙈':'👁' }}</button>
        </div>
        <small class="text-red-500">{{ f.errors.value.password }}</small>
      </div>
      <div>
        <label class="text-sm font-medium">Подтверди пароль <span class="text-red-500">*</span></label>
        <div class="relative mt-1">
          <InputText v-model="f.password_confirmation.value" v-bind="f.confirmationAttrs" :type="f.show3.value?'text':'password'" placeholder="Повтори пароль" class="w-full pr-11" :invalid="!!f.errors.value.password_confirmation" />
          <button type="button" @click="f.show3.value=!f.show3.value" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500">{{ f.show3.value?'🙈':'👁' }}</button>
        </div>
        <small class="text-red-500">{{ f.errors.value.password_confirmation }}</small>
      </div>
      <div class="flex items-center gap-3 pt-1">
        <Button :loading="f.isSubmitting.value" type="submit" label="Сохранить пароль" rounded class="!bg-black dark:!bg-white dark:!text-ink-900" />
      </div>
    </form>
  </section>
</template>
