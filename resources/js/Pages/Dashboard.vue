<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head } from '@inertiajs/vue3'
import AvatarPreview from '@/Components/Features/Media/AvatarPreview.vue'
import DashboardHero from '@/Components/Features/Dashboard/DashboardHero.vue'
import DashboardInfo from '@/Components/Features/Dashboard/DashboardInfo.vue'
import DashboardActions from '@/Components/Features/Dashboard/DashboardActions.vue'
import ProfileFriendsDialog from '@/Components/Features/Profile/ProfileFriendsDialog.vue'
import ProfileGalleryDialog from '@/Components/Features/Profile/ProfileGalleryDialog.vue'
import ProfilePhotoViewer from '@/Components/Features/Profile/ProfilePhotoViewer.vue'
import { useProfileGallery } from '@/composables/useProfileGallery'
import { useProfilePhotoComments } from '@/composables/useProfilePhotoComments'
import ChatSearchDialog from '@/Components/Features/Chat/ChatSearchDialog.vue'
import Toast from 'primevue/toast'
import Button from 'primevue/button'
import Card from 'primevue/card'
import { useDashboardPage } from '@/composables/useDashboardPage'
import { onMounted } from 'vue'
import { useProfilePeople } from '@/composables/useProfilePeople'
import { usePeopleSearch } from '@/composables/usePeopleSearch'

const props = defineProps<{ user: any; isOwn?: boolean }>()
const { seo, u, isOwn, isAdmin, showAvatar, avatarSrc, bioText, bioEmpty, settingsHref, sharing, presence, levelLabel, levelColor, planLabel, planColor, openAvatar, closeAvatar, goMap, goChat, goSettings, goAdmin, goFaq, share } = useDashboardPage(props.user, props.isOwn)
const people = useProfilePeople()
const search = usePeopleSearch()
const gallery = useProfileGallery(() => u.value.id, { isOwn: true })
const photoComments = useProfilePhotoComments(() => gallery.active.value?.id ?? null, (n) => {
  const p = gallery.active.value
  if (p) gallery.syncCounts(p.id, { comments_count: n })
})
onMounted(() => gallery.load())
</script>
<template>
  <Head :title="seo.title.value"><meta head-key="robots" name="robots" content="noindex, nofollow" /></Head>
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)] overflow-x-hidden">
      <div class="max-w-[980px] mx-auto w-full max-w-full min-w-0 px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 overflow-hidden">
        <DashboardHero :user="u" :avatar-src="avatarSrc" :level-label="levelLabel" :level-color="levelColor" :plan-label="planLabel" :plan-color="planColor" :sharing="sharing" @avatar="openAvatar" @map="goMap" @chat="goChat" @share="share" @friends="people.openFriends(u.id, u.name)" @search="search.openDialog()" @gallery="gallery.openDialog()" />
        <Card v-if="isAdmin && isOwn" class="!bg-stone-900 dark:!bg-zinc-900 !text-white !border-0 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex flex-wrap items-center gap-3">
              <span class="w-10 h-10 rounded-2xl bg-white/10 grid place-items-center shrink-0"><i class="pi pi-shield" /></span>
              <div class="flex-1 min-w-[180px]"><div class="font-black">Режим администратора</div><div class="text-xs text-white/50 font-semibold">Мониторинг онлайна, новости приложения, модерация.</div></div>
              <Button label="Открыть админ-панель →" rounded size="small" class="!bg-white !text-stone-900 !border-white !font-bold" @click="goAdmin" />
            </div>
          </template>
        </Card>
        <ProfileFriendsDialog :people="people" />
        <ChatSearchDialog :open="search.open.value" @update:open="(v:boolean)=>{ if(!v) search.closeDialog() }" :query="search.query.value" @update:query="(v:string)=>search.setQuery(v)" :results="search.results.value" :searching="search.searching.value" :creating="search.creating.value" :is-online="(id?:number,lastSeen?:string|null)=>search.isOnline(id,lastSeen)" @chat="search.startChat" @add="search.addFriend" @block="search.askBlock" />
        <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 min-w-0">
          <DashboardInfo :user="u" :bio-empty="bioEmpty" :bio-text="bioText" :is-own="isOwn" :settings-href="settingsHref" :presence="presence" />
          <DashboardActions :is-own="isOwn" @map="goMap" @settings="goSettings" @faq="goFaq" />
        </div>
        <ProfileGalleryDialog :gallery="gallery" :is-own="true" :plan="u.plan || 'free'" />
        <ProfilePhotoViewer :gallery="gallery" :comments="photoComments" :is-own="true" :user-name="u.name" :avatar-src="avatarSrc" />
      </div>
      <AvatarPreview :src="avatarSrc" :name="u.name" :open="showAvatar" @close="closeAvatar" />
    </div>
  </AuthenticatedLayout>
</template>
