<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import ProfileHeaderCard from '@/Components/Features/Profile/ProfileHeaderCard.vue'
import ProfileInfoCard from '@/Components/Features/Profile/ProfileInfoCard.vue'
import { useProfileShowPage } from '@/composables/useProfileShowPage'

const props = defineProps<{ profileUser: any; isOwn: boolean; friendship: any; isFriend: boolean; isPending: boolean; isBlocked?: boolean; isBlockedBy?: boolean; canMessage: boolean; canMessageReason: string | null }>()
const page = useProfileShowPage(props)
</script>
<template>
  <Head :title="profileUser.name" />
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]">
      <div class="max-w-[860px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <ProfileHeaderCard :user="profileUser" :avatar-src="page.avatarSrc.value" :online="page.online.value" :last-seen="page.lastSeenText.value" :level-name="(page.levelLabel as any)[profileUser.level] || profileUser.level || 'Новичок'" :is-own="isOwn" :is-locked="page.isLocked.value" :can-message="page.canMessage.value" :is-blocked="page.isBlocked.value" :is-friend="page.isFriend.value" :is-pending="page.isPending.value" :loading="page.profile.loading.value" :sharing="page.sharing.value" @avatar="page.showAvatar.value = true" @chat="page.onChat()" @add="page.onAdd()" @remove="page.askRemove()" @block="page.askBlock()" @unblock="page.onUnblock()" @share="page.share()" />
        <ProfileInfoCard v-if="!page.isLocked.value" :user="profileUser" :bio-empty="page.bioEmpty.value" :bio-text="page.bioText.value" :level-name="(page.levelLabel as any)[profileUser.level] || profileUser.level" :registered-at="page.registeredAt.value" />
        <div v-if="page.showAvatar.value" @click="page.showAvatar.value = false" class="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out">
          <Avatar :image="page.avatarSrc.value" shape="square" class="!w-auto !h-auto max-w-full max-h-[85vh] !rounded-3xl [&_img]:!rounded-3xl [&_img]:max-h-[85vh] [&_img]:object-contain" />
        </div>
      </div>
    </div>
    <Dialog :visible="!!page.confirm.value" @update:visible="(v:boolean)=>{ if(!v) page.closeConfirm() }" modal :closable="true" :draggable="false" :style="{ width: '360px', maxWidth: 'calc(100vw - 2rem)' }">
      <template #header><span class="font-bold">{{ page.confirm.value?.title }}</span></template>
      <p class="text-sm text-stone-600">{{ page.confirm.value?.msg }}</p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" severity="secondary" text @click="page.closeConfirm()" />
          <Button label="Подтвердить" severity="danger" @click="page.runConfirm()" />
        </div>
      </template>
    </Dialog>
  </AuthenticatedLayout>
</template>
