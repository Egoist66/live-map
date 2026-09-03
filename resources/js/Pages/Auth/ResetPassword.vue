<script setup lang="ts">
import GuestLayout from '@/Layouts/GuestLayout.vue'
import { Head, useForm } from '@inertiajs/vue3'
import { ref } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
const props = defineProps<{ email: string; token: string }>()
const form = useForm({ token: props.token, email: props.email, password: '', password_confirmation: '' })
const show1 = ref(false)
const show2 = ref(false)
const submit = () => { form.post(route('password.store'), { onFinish: () => form.reset('password', 'password_confirmation') }) }
</script>
<template>
  <GuestLayout>
    <Head title="Новый пароль" />
    <form @submit.prevent="submit" class="space-y-4">
      <div>
        <label class="text-[13px] font-semibold dark:text-white">Email</label>
        <InputText v-model="form.email" type="email" class="w-full mt-1.5 !rounded-2xl" :invalid="!!form.errors.email" required autofocus autocomplete="username" />
        <Message v-if="form.errors.email" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ form.errors.email }}</Message>
      </div>
      <div>
        <label class="text-[13px] font-semibold dark:text-white">Новый пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="form.password" :type="show1 ? 'text' : 'password'" placeholder="••••••••" class="w-full pr-11 !rounded-2xl" :invalid="!!form.errors.password" required autocomplete="new-password" />
          <Button type="button" @click="show1=!show1" text rounded class="!absolute !right-1.5 !top-1/2 !-translate-y-1/2 !w-8 !h-8 !p-0" :icon="show1 ? 'pi pi-eye-slash' : 'pi pi-eye'" tabindex="-1" />
        </div>
        <Message v-if="form.errors.password" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ form.errors.password }}</Message>
      </div>
      <div>
        <label class="text-[13px] font-semibold dark:text-white">Подтвердите пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="form.password_confirmation" :type="show2 ? 'text' : 'password'" placeholder="••••••••" class="w-full pr-11 !rounded-2xl" :invalid="!!form.errors.password_confirmation" required autocomplete="new-password" />
          <Button type="button" @click="show2=!show2" text rounded class="!absolute !right-1.5 !top-1/2 !-translate-y-1/2 !w-8 !h-8 !p-0" :icon="show2 ? 'pi pi-eye-slash' : 'pi pi-eye'" tabindex="-1" />
        </div>
        <Message v-if="form.errors.password_confirmation" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ form.errors.password_confirmation }}</Message>
      </div>
      <Button type="submit" :loading="form.processing" label="Сохранить пароль" class="w-full !bg-ink-900 dark:!bg-white !border-ink-900 dark:!border-white !text-white dark:!text-ink-900 !rounded-full !py-3.5 !font-bold" />
    </form>
  </GuestLayout>
</template>
