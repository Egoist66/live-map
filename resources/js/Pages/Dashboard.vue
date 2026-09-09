<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head } from '@inertiajs/vue3'
import AvatarPreview from '@/Components/Features/Media/AvatarPreview.vue'
import DashboardHero from '@/Components/Features/Dashboard/DashboardHero.vue'
import DashboardInfo from '@/Components/Features/Dashboard/DashboardInfo.vue'
import DashboardActions from '@/Components/Features/Dashboard/DashboardActions.vue'
import ProfileSocialView from '@/Components/Features/Profile/ProfileSocialView.vue'
import { useProfileViewMode } from '@/composables/useProfileViewMode'
import ProfileFriendsDialog from '@/Components/Features/Profile/ProfileFriendsDialog.vue'
import ProfileGalleryDialog from '@/Components/Features/Profile/ProfileGalleryDialog.vue'
import ProfilePhotoViewer from '@/Components/Features/Profile/ProfilePhotoViewer.vue'
import { useProfileGallery } from '@/composables/useProfileGallery'
import { useProfilePhotoComments } from '@/composables/useProfilePhotoComments'
import ChatSearchDialog from '@/Components/Features/Chat/ChatSearchDialog.vue'
import Toast from 'primevue/toast'
import Button from 'primevue/button'
import { useDashboardPage } from '@/composables/useDashboardPage'
import { onMounted } from 'vue'
import { useProfilePeople } from '@/composables/useProfilePeople'
import { usePeopleSearch } from '@/composables/usePeopleSearch'
import { planOf } from '@/composables/usePlanLimits'

const props = defineProps<{ user: any; isOwn?: boolean }>()
const { seo, u, isOwn, isAdmin, showAvatar, avatarSrc, bioText, bioEmpty, settingsHref, sharing, presence, levelLabel, levelColor, planLabel, planColor, levelName, registeredAt, openAvatar, closeAvatar, goMap, goChat, goSettings, goAdmin, goFaq, share } = useDashboardPage(props.user, props.isOwn)
const people = useProfilePeople()
const search = usePeopleSearch()
const view = useProfileViewMode()
const gallery = useProfileGallery(() => u.value.id, { isOwn: true })
const photoComments = useProfilePhotoComments(() => gallery.active.value?.id ?? null, (n) => {
  const p = gallery.active.value
  if (p) gallery.syncCounts(p.id, { comments_count: n })
})
onMounted(async () => { await gallery.load(); try { await people.loadFriendsCount(u.value.id) } catch {} })
</script>
<template>
  <Head :title="seo.title.value"><meta head-key="robots" name="robots" content="noindex, nofollow" /></Head>
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)] overflow-x-hidden">
      <div class="max-w-[980px] mx-auto w-full max-w-full min-w-0 px-0 sm:px-6 py-0 sm:py-2 space-y-0 sm:space-y-3 overflow-hidden">
        <div class="flex items-center justify-between gap-2 px-3 sm:px-0 pt-0.5 sm:pt-0">
          <button v-if="isAdmin && isOwn" type="button" @click="goAdmin" class="min-w-0 flex items-center gap-1.5 text-[11px] font-bold text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white transition">
            <span class="w-5 h-5 rounded-md bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center shrink-0"><i class="pi pi-shield text-[10px]"></i></span>
            <span class="truncate">Администратор · Админ-панель →</span>
          </button>
          <span v-else></span>
          <Button :icon="view.mode.value === 'social' ? 'pi pi-id-card' : 'pi pi-th-large'" rounded text severity="secondary" class="!w-9 !h-9 !rounded-full shrink-0" :title="view.mode.value === 'social' ? 'Классический вид' : 'Новый вид'" :aria-label="view.mode.value === 'social' ? 'Классический вид' : 'Новый вид'" @click="view.toggle()" />
        </div>
        <ProfileSocialView v-if="view.mode.value === 'social'" :user="u" :avatar-src="avatarSrc" :online="presence.active" :last-seen="presence.label" :level-name="levelName" :is-own="true" :is-locked="false" :can-message="false" :is-blocked="false" :is-friend="false" :is-pending="false" :loading="false" :sharing="sharing" :bio-empty="bioEmpty" :bio-text="bioText" :registered-at="registeredAt" :photos="gallery.photos.value" :photos-count="gallery.count.value" :friends-count="people.friendsCount.value" :gallery-limit="gallery.limit.value" :gallery-can-add="gallery.canAdd.value" :gallery-loading="gallery.loading.value" :gallery-uploading="gallery.uploading.value" @avatar="openAvatar" @chat="goChat" @share="share" @friends="people.openFriends(u.id, u.name)" @search="search.openDialog()" @add-photo="(f:File)=>gallery.upload(f)" @open-photo="(p:any)=>gallery.open(p)" />
        <DashboardHero v-else :user="u" :avatar-src="avatarSrc" :level-label="levelLabel" :level-color="levelColor" :plan-label="planLabel" :plan-color="planColor" :sharing="sharing" @avatar="openAvatar" @map="goMap" @chat="goChat" @share="share" @friends="people.openFriends(u.id, u.name)" @search="search.openDialog()" @gallery="gallery.openDialog()" />
        <ProfileFriendsDialog :people="people" />
        <ChatSearchDialog :open="search.open.value" @update:open="(v:boolean)=>{ if(!v) search.closeDialog() }" :query="search.query.value" @update:query="(v:string)=>search.setQuery(v)" :results="search.results.value" :searching="search.searching.value" :creating="search.creating.value" :is-online="(id?:number,lastSeen?:string|null)=>search.isOnline(id,lastSeen)" @chat="search.startChat" @add="search.addFriend" @block="search.askBlock" />
        <div v-if="view.mode.value === 'classic'" class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 min-w-0 px-3 sm:px-0">
          <DashboardInfo :user="u" :bio-empty="bioEmpty" :bio-text="bioText" :is-own="isOwn" :settings-href="settingsHref" :presence="presence" />
          <DashboardActions :is-own="isOwn" @map="goMap" @settings="goSettings" @faq="goFaq" />
        </div>
        <ProfileGalleryDialog :gallery="gallery" :is-own="true" :plan="planOf(u)" />
        <ProfilePhotoViewer :gallery="gallery" :comments="photoComments" :is-own="true" :user-name="u.name" :avatar-src="avatarSrc" />
      </div>
      <AvatarPreview :src="avatarSrc" :name="u.name" :open="showAvatar" @close="closeAvatar" />
    </div>
  </AuthenticatedLayout>
</template>
