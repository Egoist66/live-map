<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useForm, usePage } from '@inertiajs/vue3'
import { route } from '@/route'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { useScreenLock } from '@/composables/useScreenLock'
const screenLock = useScreenLock()
const page = usePage()
const confirming = ref(false)
const passwordInput = ref<any>(null)
const show = ref(false)
const form = useForm({ password: '' })
const confirm = () => { confirming.value = true; nextTick(() => passwordInput.value?.$el?.focus?.()) }
const del = () => {
  const uid = Number((page.props.auth as any)?.user?.id || 0)
  form.delete(route('profile.destroy'), {
    preserveScroll: true,
    onSuccess: () => {
      void screenLock.forget(uid || undefined)
      close()
    },
    onError: () => passwordInput.value?.$el?.focus?.(),
    onFinish: () => form.reset(),
  })
}
const close = () => { confirming.value = false; form.clearErrors(); form.reset() }
</script>
<template>
  <section>
    <header>
      <h2 class="font-bold text-red-600">Удаление аккаунта</h2>
      <p class="text-sm text-zinc-500 mt-1">Аккаунт, анкета, фото и переписки будут удалены безвозвратно. Сохрани нужное заранее.</p>
    </header>
    <Button @click="confirm" label="Удалить аккаунт" severity="danger" rounded class="mt-4 !rounded-full" />
    <Dialog :visible="confirming" @update:visible="(v:boolean)=>{ if(!v) close() }" modal :closable="true" :draggable="false" header="Точно удалить?" :style="{ width:'420px', maxWidth:'calc(100vw - 2rem)' }" :pt="{ root:{ class:'!rounded-3xl max-sm:!rounded-b-none dark:!bg-zinc-900 dark:!border-zinc-700' }, header:{ class:'dark:!bg-zinc-900 dark:!text-white' }, content:{ class:'dark:!bg-zinc-900 dark:!text-white' } }">
      <p class="text-sm text-zinc-600 dark:text-zinc-300">Введи пароль для подтверждения.</p>
      <div class="mt-4">
        <div class="relative w-full">
          <InputText ref="passwordInput" v-model="form.password" :type="show ? 'text' : 'password'" placeholder="Пароль" @keyup.enter="del" class="w-full !rounded-2xl !border-stone-200 dark:!border-zinc-700 dark:!bg-zinc-800 dark:!text-white pr-11" :invalid="!!form.errors.password" />
          <Button type="button" @click="show=!show" text rounded class="!absolute !right-1.5 !top-1/2 !-translate-y-1/2 !w-8 !h-8 !p-0" :icon="show ? 'pi pi-eye-slash' : 'pi pi-eye'" tabindex="-1" />
        </div>
        <Message v-if="form.errors.password" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ form.errors.password }}</Message>
      </div>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button @click="close" label="Отмена" severity="secondary" outlined rounded />
          <Button @click="del" :loading="form.processing" label="Удалить" severity="danger" rounded />
        </div>
      </template>
    </Dialog>
  </section>
</template>
