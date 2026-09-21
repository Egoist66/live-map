<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import { useProfileUrl } from '@/composables/useProfileUrl'

defineProps<{
  userId: number
  profileSlug?: string | null
  name: string
  avatarUrl: string | null
  badge: string | null
  action: 'none' | 'kick' | 'approve' | 'cancel'
}>()

const { userProfileUrl } = useProfileUrl()

const emit = defineEmits<{
  (e: 'kick', userId: number): void
  (e: 'approve', userId: number): void
  (e: 'reject', userId: number): void
  (e: 'cancel', userId: number): void
}>()
</script>

<template>
  <div class="flex items-center gap-2.5 rounded-2xl border border-stone-200/70 bg-white p-2.5 transition hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-500/40">
    <Link :href="userProfileUrl({ id: userId, profile_slug: profileSlug })" class="relative shrink-0">
      <Avatar :image="avatarUrl ?? undefined" :label="!avatarUrl ? name.slice(0, 1).toUpperCase() : undefined" shape="circle" class="!h-10 !w-10" />
      <span v-if="badge === 'owner'" class="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-amber-400 ring-2 ring-white dark:ring-zinc-900" title="Владелец">
        <i class="pi pi-crown text-[8px] text-white" />
      </span>
    </Link>
    <Link :href="userProfileUrl({ id: userId, profile_slug: profileSlug })" class="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-900 hover:underline sm:text-sm dark:text-white">
      {{ name }}
    </Link>
    <span v-if="badge === 'pending'" class="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
      заявка
    </span>
    <span v-if="badge === 'invited'" class="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
      приглашён
    </span>
    <Button v-if="action === 'kick'" icon="pi pi-user-minus" rounded outlined severity="danger" size="small" title="Исключить" aria-label="Исключить жителя" class="!h-9 !w-9 !p-0 shrink-0" @click="emit('kick', userId)" />
    <div v-if="action === 'approve'" class="flex shrink-0 items-center gap-1.5">
      <Button icon="pi pi-check" rounded size="small" title="Принять" aria-label="Принять заявку" class="!h-9 !w-9 !border-0 !bg-emerald-500 !p-0 hover:!bg-emerald-400" @click="emit('approve', userId)" />
      <Button icon="pi pi-times" rounded outlined severity="danger" size="small" title="Отклонить" aria-label="Отклонить заявку" class="!h-9 !w-9 !p-0" @click="emit('reject', userId)" />
    </div>
    <Button v-if="action === 'cancel'" label="Отозвать" rounded outlined severity="secondary" size="small" class="shrink-0" @click="emit('cancel', userId)" />
  </div>
</template>
