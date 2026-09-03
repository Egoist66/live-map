<script setup lang="ts">
import { usePasswordForm } from '@/composables/usePasswordForm'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
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
        <label class="text-sm font-medium dark:text-white">Текущий пароль <span class="text-red-500">*</span></label>
        <div class="relative mt-1">
          <InputText v-model="f.current_password.value" v-bind="f.currentAttrs" :type="f.show1.value?'text':'password'" placeholder="••••••••" class="w-full pr-11 !rounded-2xl" :invalid="!!f.errors.value.current_password" />
          <Button type="button" @click="f.show1.value=!f.show1.value" text rounded class="!absolute !right-1.5 !top-1/2 !-translate-y-1/2 !w-8 !h-8 !p-0" :icon="f.show1.value ? 'pi pi-eye-slash' : 'pi pi-eye'" />
        </div>
        <Message v-if="f.errors.value.current_password" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.current_password }}</Message>
      </div>
      <div>
        <label class="text-sm font-medium dark:text-white">Новый пароль <span class="text-red-500">*</span></label>
        <div class="relative mt-1">
          <InputText v-model="f.password.value" v-bind="f.passwordAttrs" :type="f.show2.value?'text':'password'" placeholder="Не менее 8 символов" class="w-full pr-11 !rounded-2xl" :invalid="!!f.errors.value.password" />
          <Button type="button" @click="f.show2.value=!f.show2.value" text rounded class="!absolute !right-1.5 !top-1/2 !-translate-y-1/2 !w-8 !h-8 !p-0" :icon="f.show2.value ? 'pi pi-eye-slash' : 'pi pi-eye'" />
        </div>
        <Message v-if="f.errors.value.password" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.password }}</Message>
      </div>
      <div>
        <label class="text-sm font-medium dark:text-white">Подтверди пароль <span class="text-red-500">*</span></label>
        <div class="relative mt-1">
          <InputText v-model="f.password_confirmation.value" v-bind="f.confirmationAttrs" :type="f.show3.value?'text':'password'" placeholder="Повтори пароль" class="w-full pr-11 !rounded-2xl" :invalid="!!f.errors.value.password_confirmation" />
          <Button type="button" @click="f.show3.value=!f.show3.value" text rounded class="!absolute !right-1.5 !top-1/2 !-translate-y-1/2 !w-8 !h-8 !p-0" :icon="f.show3.value ? 'pi pi-eye-slash' : 'pi pi-eye'" />
        </div>
        <Message v-if="f.errors.value.password_confirmation" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.password_confirmation }}</Message>
      </div>
      <div class="flex items-center gap-3 pt-1">
        <Button :loading="f.isSubmitting.value" type="submit" label="Сохранить пароль" rounded class="!bg-black dark:!bg-white dark:!text-ink-900 !border-black dark:!border-white" />
      </div>
    </form>
  </section>
</template>
