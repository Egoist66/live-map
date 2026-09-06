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
import { useProfilePeople } from '@/composables/useProfilePeople'
import { usePeopleSearch } from '@/composables/usePeopleSearch'
import { useAvatarPreview } from '@/composables/useAvatarPreview'
import ProfileFriendsDialog from '@/Components/Features/Profile/ProfileFriendsDialog.vue'
import ProfileGalleryDialog from '@/Components/Features/Profile/ProfileGalleryDialog.vue'
import ProfilePhotoViewer from '@/Components/Features/Profile/ProfilePhotoViewer.vue'
import { useProfileGallery } from '@/composables/useProfileGallery'
import { useProfilePhotoComments } from '@/composables/useProfilePhotoComments'
import { onMounted } from 'vue'
import ChatSearchDialog from '@/Components/Features/Chat/ChatSearchDialog.vue'

const props = defineProps<{ profileUser: any; isOwn: boolean; friendship: any; isFriend: boolean; isPending: boolean; isBlocked?: boolean; isBlockedBy?: boolean; canMessage: boolean; canMessageReason: string | null }>()
const page = useProfileShowPage(props)
const gallery = useProfileGallery(() => props.profileUser.id, { isOwn: props.isOwn })
const photoComments = useProfilePhotoComments(() => gallery.active.value?.id ?? null, (n) => {
  const p = gallery.active.value
  if (p) gallery.syncCounts(p.id, { comments_count: n })
})
const people = useProfilePeople()
const search = usePeopleSearch()
useAvatarPreview(() => page.showAvatar.value, () => (page.showAvatar.value = false))
onMounted(() => gallery.load())
</script>
<template>
  <Head :title="profileUser.name" />
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]">
      <div class="max-w-[860px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <ProfileHeaderCard :user="profileUser" :avatar-src="page.avatarSrc.value" :online="page.online.value" :last-seen="page.lastSeenText.value" :level-name="(page.levelLabel as any)[profileUser.level] || profileUser.level || 'Новичок'" :is-own="isOwn" :is-locked="page.isLocked.value" :can-message="page.canMessage.value" :is-blocked="page.isBlocked.value" :is-friend="page.isFriend.value" :is-pending="page.isPending.value" :loading="page.profile.loading.value" :sharing="page.sharing.value" @avatar="page.showAvatar.value = true" @chat="page.onChat()" @add="page.onAdd()" @remove="page.askRemove()" @block="page.askBlock()" @unblock="page.onUnblock()" @share="page.share()" @friends="people.openFriends(profileUser.id, profileUser.name)" @search="search.openDialog()" @gallery="gallery.openDialog()" />
        <ProfileFriendsDialog :people="people" />
        <ChatSearchDialog :open="search.open.value" @update:open="(v:boolean)=>{ if(!v) search.closeDialog() }" :query="search.query.value" @update:query="(v:string)=>search.setQuery(v)" :results="search.results.value" :searching="search.searching.value" :creating="search.creating.value" :is-online="(id?:number,lastSeen?:string|null)=>search.isOnline(id,lastSeen)" @chat="search.startChat" @add="search.addFriend" @block="search.askBlock" />
        <ProfileInfoCard v-if="!page.isLocked.value" :user="profileUser" :bio-empty="page.bioEmpty.value" :bio-text="page.bioText.value" :level-name="(page.levelLabel as any)[profileUser.level] || profileUser.level" :registered-at="page.registeredAt.value" />
        <ProfileGalleryDialog :gallery="gallery" :is-own="isOwn" :plan="profileUser.plan || 'free'" />
        <ProfilePhotoViewer :gallery="gallery" :comments="photoComments" :is-own="isOwn" :user-name="profileUser.name" :avatar-src="page.avatarSrc.value" />
        <Teleport to="body">
          <div v-if="page.showAvatar.value" @click="page.showAvatar.value = false" class="fixed inset-0 z-[100] bg-black/80 grid place-items-center p-4 cursor-zoom-out overflow-auto">
            <Avatar :image="page.avatarSrc.value" shape="square" class="!w-auto !h-auto max-w-full max-h-[85dvh] !rounded-3xl [&_img]:!rounded-3xl [&_img]:max-h-[85dvh] [&_img]:object-contain" />
          </div>
        </Teleport>
      </div>
    </div>
    <Dialog :visible="!!page.confirm.value" @update:visible="(v:boolean)=>{ if(!v) page.closeConfirm() }" modal :closable="true" :draggable="false" :style="{ width: '360px', maxWidth: 'calc(100vw - 2rem)' }">
      <template #header><span class="font-bold">{{ page.confirm.value?.title }}</span></template>
      <p class="text-sm text-stone-600 dark:text-zinc-300 break-words">{{ page.confirm.value?.msg }}</p>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button label="Отмена" severity="secondary" text @click="page.closeConfirm()" />
          <Button label="Подтвердить" severity="danger" @click="page.runConfirm()" />
        </div>
      </template>
    </Dialog>
  </AuthenticatedLayout>
</template>
