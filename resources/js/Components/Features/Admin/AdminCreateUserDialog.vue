<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Select from 'primevue/select'
import Message from 'primevue/message'
import { computed } from 'vue'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

const { selectPt } = useDropdownMenuStyle()

const props = defineProps<{ admin: any; onCreated?: () => void }>()

const genderOptions = [
  { label: 'Мужской', value: 'male' },
  { label: 'Женский', value: 'female' },
  { label: 'Другой', value: 'other' },
]

const st = computed(() => props.admin.createState.value)
const canSubmit = computed(() => st.value.name.trim() !== '' && st.value.email.trim() !== '' && st.value.password.length >= 8 && !st.value.creating)

function submit() {
  props.admin.createTestUser(props.onCreated)?.catch(() => {})
}

function close() {
  props.admin.closeCreate()
}
</script>
<template>
  <Dialog :visible="st.open" @update:visible="(v:boolean)=>{ if(!v) close() }" modal header="Новый тестовый аккаунт" :style="{ width: '440px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-[#0F121F] dark:!text-white' }, content: { class: '!px-5 !py-4 dark:!bg-[#0F121F]' }, footer: { class: '!px-5 !pb-5 !pt-1 !border-0 dark:!bg-[#0F121F]' } }">
    <template v-if="!st.created">
      <p class="text-xs text-stone-500 dark:text-zinc-400">Логин — это email. Аккаунт создаётся обычной персоной без прав, почта сразу подтверждена — можно входить и тестировать.</p>
      <label class="mt-4 block text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Имя</label>
      <InputText v-model="st.name" fluid placeholder="Тестовый пользователь" class="mt-1 !rounded-2xl" maxlength="255" />
      <label class="mt-3 block text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Логин (email)</label>
      <InputText v-model="st.email" type="email" inputmode="email" fluid placeholder="test123@example.com" class="mt-1 !rounded-2xl" maxlength="255" />
      <label class="mt-3 block text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Пол</label>
      <Select v-model="st.gender" :options="genderOptions" optionLabel="label" optionValue="value" fluid appendTo="body" scrollHeight="12rem" :pt="selectPt" class="mt-1" checkmark />
      <div class="mt-3 flex items-end gap-2">
        <div class="min-w-0 flex-1">
          <label class="block text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Пароль (мин. 8 символов)</label>
          <Password v-model="st.password" fluid toggleMask :feedback="false" placeholder="Придумайте пароль" class="mt-1" :pt="{ input: { class: '!rounded-2xl' } }" />
        </div>
        <Button icon="pi pi-sparkles" rounded outlined severity="info" title="Сгенерировать надёжный пароль" aria-label="Сгенерировать пароль" class="shrink-0 !w-10 !h-10" @click="props.admin.generatePassword()" />
      </div>
      <label class="mt-3 block text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Повтор пароля</label>
      <Password v-model="st.confirm" fluid toggleMask :feedback="false" placeholder="Ещё раз тот же пароль" class="mt-1" :pt="{ input: { class: '!rounded-2xl' } }" @keyup.enter="submit" />
      <Message v-if="st.error" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ st.error }}</Message>
    </template>
    <template v-else>
      <Message severity="success" :closable="false" class="!rounded-2xl !text-xs">Аккаунт создан — передайте доступы и закройте окно. Пароль больше нигде не показан.</Message>
      <div class="mt-3 rounded-2xl bg-stone-100 dark:bg-white/[0.06] px-4 py-3 space-y-1">
        <div class="text-xs text-stone-500 dark:text-zinc-400">Логин</div>
        <div class="text-sm font-bold dark:text-white break-all">{{ st.created.email }}</div>
        <div class="text-xs text-stone-500 dark:text-zinc-400 pt-1">Пароль</div>
        <div class="text-sm font-bold dark:text-white break-all">{{ st.password }}</div>
      </div>
      <Button :label="st.copied ? 'Скопировано' : 'Скопировать доступы'" :icon="st.copied ? 'pi pi-check' : 'pi pi-copy'" rounded outlined size="small" class="mt-3 w-full !text-xs !font-bold" @click="props.admin.copyCreatedCredentials()" />
      <Message v-if="st.error" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ st.error }}</Message>
    </template>
    <template #footer>
      <div class="flex gap-2 justify-end flex-wrap">
        <Button :label="st.created ? 'Готово' : 'Отмена'" text @click="close()" />
        <Button v-if="!st.created" label="Создать" icon="pi pi-user-plus" rounded :loading="st.creating" :disabled="!canSubmit" class="!bg-stone-900 dark:!bg-white dark:!text-stone-900 !text-white !font-bold !border-0" @click="submit()" />
        <Button v-else label="Создать ещё" icon="pi pi-plus" rounded outlined @click="props.admin.openCreate()" />
      </div>
    </template>
  </Dialog>
</template>
