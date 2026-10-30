<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useDatingFriend } from '@/composables/useDatingFriend'

const props = defineProps<{ userId: number | null }>()

const friend = useDatingFriend(() => props.userId)

const toast = (() => {
  try {
    return useToast()
  } catch {
    return null as any
  }
})()

async function onAdd(): Promise<void> {
  try {
    await friend.add()
    toast?.add({ severity: 'success', summary: 'Заявка отправлена', detail: 'Человек увидит её во вкладке «Заявки»', life: 2500 })
  } catch {
    toast?.add({ severity: 'error', summary: 'Не отправилось', detail: friend.error.value ?? 'Попробуй ещё раз', life: 3000 })
  }
}

async function onAccept(): Promise<void> {
  try {
    await friend.acceptIncoming()
    toast?.add({ severity: 'success', summary: 'Вы теперь друзья', life: 2500 })
  } catch {
    toast?.add({ severity: 'error', summary: 'Не получилось', detail: friend.error.value ?? 'Попробуй ещё раз', life: 3000 })
  }
}
</script>

<template>
  <span v-if="userId && !friend.loading.value" class="inline-flex">
    <Button
      v-if="friend.isFriend.value"
      icon="pi pi-users"
      label="Друзья"
      rounded
      outlined
      disabled
      class="!py-2.5 opacity-80"
    />
    <Button
      v-else-if="friend.isPending.value && friend.isOutgoing.value"
      icon="pi pi-clock"
      label="Заявка отправлена"
      rounded
      outlined
      disabled
      class="!py-2.5 opacity-80"
    />
    <Button
      v-else-if="friend.isPending.value"
      icon="pi pi-user-plus"
      label="Дружить в ответ"
      rounded
      :loading="friend.busy.value"
      class="!py-2.5 !border-0 !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !text-white"
      @click="onAccept()"
    />
    <Button
      v-else
      icon="pi pi-user-plus"
      label="В друзья"
      rounded
      outlined
      :loading="friend.busy.value"
      class="!py-2.5"
      @click="onAdd()"
    />
  </span>
</template>
