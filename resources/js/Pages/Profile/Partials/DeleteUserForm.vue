<script setup lang="ts">
import DangerButton from '@/Components/DangerButton.vue'
import InputError from '@/Components/InputError.vue'
import Modal from '@/Components/Modal.vue'
import SecondaryButton from '@/Components/SecondaryButton.vue'
import { useForm } from '@inertiajs/vue3'
import { nextTick, ref } from 'vue'

const confirming = ref(false)
const passwordInput = ref<HTMLInputElement | null>(null)
const show = ref(false)
const form = useForm({ password: '' })

const confirm = () => { confirming.value = true; nextTick(() => passwordInput.value?.focus()) }
const del = () => form.delete(route('profile.destroy'), { preserveScroll: true, onSuccess: () => close(), onError: () => passwordInput.value?.focus(), onFinish: () => form.reset() })
const close = () => { confirming.value = false; form.clearErrors(); form.reset() }
</script>

<template>
  <section>
    <header>
      <h2 class="font-bold text-red-600">Удаление аккаунта</h2>
      <p class="text-sm text-zinc-500 mt-1">Аккаунт и все пины/комменты будут удалены безвозвратно. Сохрани нужное заранее.</p>
    </header>
    <DangerButton @click="confirm" class="!rounded-full mt-4">Удалить аккаунт</DangerButton>
    <Modal :show="confirming" @close="close">
      <div class="p-6">
        <h2 class="font-bold">Точно удалить?</h2>
        <p class="text-sm text-zinc-600 mt-1">Введи пароль для подтверждения.</p>
        <div class="mt-4">
          <div class="relative w-3/4">
            <input id="password" ref="passwordInput" v-model="form.password" :type="show ? 'text' : 'password'" placeholder="Пароль" @keyup.enter="del" class="w-full border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-ink-900 dark:text-white rounded-xl px-3 py-2.5 pr-11 text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-300 dark:focus:border-zinc-600"/>
            <button type="button" @click="show=!show" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500 text-sm" tabindex="-1">{{ show?'🙈':'👁' }}</button>
          </div>
          <InputError :message="form.errors.password" class="mt-1"/>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <SecondaryButton @click="close" class="!rounded-full">Отмена</SecondaryButton>
          <DangerButton @click="del" :disabled="form.processing" class="!rounded-full">Удалить</DangerButton>
        </div>
      </div>
    </Modal>
  </section>
</template>
