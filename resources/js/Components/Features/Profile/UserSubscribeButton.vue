<script setup lang="ts">
import Button from 'primevue/button'
import { useUserSubscriptions } from '@/composables/useUserSubscriptions'

const props = defineProps<{
  userId: number | string
  initial?: { subscribed: boolean; notify_pin: boolean; notify_photo: boolean; notify_level: boolean }
  compact?: boolean
  isFriend?: boolean
}>()

const sub = useUserSubscriptions(props.userId, props.initial)
</script>
<template>
  <Button
    v-if="isFriend !== false"
    :icon="sub.subscribed.value ? 'pi pi-bell-slash' : 'pi pi-bell'"
    :label="compact ? undefined : (sub.subscribed.value ? 'Вы подписаны' : 'Подписаться')"
    :loading="sub.loading.value"
    :outlined="!sub.subscribed.value"
    :severity="sub.subscribed.value ? 'secondary' : 'contrast'"
    rounded
    class="!rounded-xl !text-[13px] !font-bold shrink-0"
    :aria-label="sub.subscribed.value ? 'Отписаться от обновлений' : 'Подписаться на обновления'"
    :title="sub.subscribed.value ? 'Новый пин, фото, репутация' : 'Новый пин, фото, репутация'"
    @click="sub.toggle()"
  />
</template>
