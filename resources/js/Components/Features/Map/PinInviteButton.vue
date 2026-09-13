<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Avatar from 'primevue/avatar'
import { usePinInvites } from '@/composables/usePinInvites'
import { useInviteUserSearch } from '@/composables/useInviteUserSearch'
import { usePinInviteLimit } from '@/composables/usePinInviteLimit'
import { avatarSrcFor } from '@/composables/useAvatar'

const props = defineProps<{ pinId: number; isOwner: boolean }>()
const open = ref(false)
const { invites, load, inviteUser, revokeInvite, error } = usePinInvites(props.pinId)
const { results, searching, search } = useInviteUserSearch()
const limit = usePinInviteLimit()
const searchText = ref('')

watch(open, (v) => {
  if (v) {
    load()
    void limit.refresh()
  }
})

async function onSearch(v: string | undefined) {
  searchText.value = v ?? ''
  await search(v ?? '')
}

async function onInvite(userId: number) {
  try {
    await inviteUser(userId)
    await limit.refresh()
  } catch {
    await limit.refresh()
    return
  }
  searchText.value = ''
  await search('')
}

function avatarOf(u: any) {
  return avatarSrcFor(u)
}
</script>

<template>
  <div v-if="isOwner">
    <Button label="Пригласить" icon="pi pi-user-plus" severity="secondary" outlined size="small" @click="open = true" />
    <Dialog v-model:visible="open" header="Пригласить в пин" modal :style="{ width: '26rem' }">
      <p class="text-sm text-stone-500 mb-1">Приглашённый увидит пин даже из другой страны и зоны.</p>
      <p class="text-xs text-stone-400 mb-3">{{ limit.remainingText }}</p>
      <div v-if="error" class="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2 mb-2">{{ error }}</div>
      <InputText :model-value="searchText" placeholder="Имя пользователя..." class="w-full" @update:model-value="onSearch" />
      <div v-if="searching" class="text-xs text-stone-400 mt-2">Поиск...</div>
      <div v-else class="mt-2 space-y-1">
        <div v-for="u in results" :key="u.id" class="flex items-center gap-2 p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-white/10">
          <Avatar :image="avatarOf(u)" shape="circle" />
          <span class="flex-1 text-sm font-medium truncate">{{ u.name }}</span>
          <Button label="В пин" size="small" @click="onInvite(u.id)" />
        </div>
      </div>
      <div v-if="invites.length" class="mt-4">
        <div class="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">Приглашены</div>
        <div v-for="i in invites" :key="i.id" class="flex items-center gap-2 p-2 rounded-xl bg-stone-50 dark:bg-white/5">
          <Avatar :image="avatarOf(i.invitee)" shape="circle" />
          <span class="flex-1 text-sm truncate">{{ i.invitee?.name || `#${i.invitee_id}` }}</span>
          <Button icon="pi pi-times" severity="danger" text rounded size="small" @click="revokeInvite(i.id)" />
        </div>
      </div>
    </Dialog>
  </div>
</template>
