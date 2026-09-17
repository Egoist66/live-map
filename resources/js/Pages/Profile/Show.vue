<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import ProfileDesignHero from '@/Components/Features/Profile/ProfileDesignHero.vue'
import ProfileDesignQuickNav from '@/Components/Features/Profile/ProfileDesignQuickNav.vue'
import ProfileDesignGallery from '@/Components/Features/Profile/ProfileDesignGallery.vue'
import ProfileDesignInfo from '@/Components/Features/Profile/ProfileDesignInfo.vue'
import ProfileDesignSwipes from '@/Components/Features/Profile/ProfileDesignSwipes.vue'
import ProfileDesignFlow from '@/Components/Features/Profile/ProfileDesignFlow.vue'
import ProfileMoreMenu from '@/Components/Features/Profile/ProfileMoreMenu.vue'
import UserSubscribeButton from '@/Components/Features/Profile/UserSubscribeButton.vue'
import ProfileFriendsDialog from '@/Components/Features/Profile/ProfileFriendsDialog.vue'
import ProfileGalleryDialog from '@/Components/Features/Profile/ProfileGalleryDialog.vue'
import ProfilePhotoViewer from '@/Components/Features/Profile/ProfilePhotoViewer.vue'
import ChatSearchDialog from '@/Components/Features/Chat/ChatSearchDialog.vue'
import ProfileThoughtDialog from '@/Components/Features/Profile/ProfileThoughtDialog.vue'
import ReportDialog from '@/Components/Features/Map/ReportDialog.vue'
import { useReportDialog } from '@/composables/useReportDialog'
import { useProfileDesign } from '@/composables/useProfileDesign'
import { useProfileLayout } from '@/composables/useProfileLayout'
import { useProfileThought } from '@/composables/useProfileThought'
import { planOf } from '@/composables/usePlanLimits'
import { onMounted } from 'vue'

const props = defineProps<{ profileUser: any; isOwn: boolean; friendship: any; isFriend: boolean; isPending: boolean; isBlocked?: boolean; isBlockedBy?: boolean; canMessage: boolean; canMessageReason: string | null; subscription?: { subscribed: boolean; notify_pin: boolean; notify_photo: boolean; notify_level: boolean; notify_post?: boolean } }>()

const design = useProfileDesign(props)
const { single: isSingleColumn } = useProfileLayout()
const { page, gallery, people, search, photoComments } = design
const reportDialog = useReportDialog()
const thought = useProfileThought(() => props.profileUser.thought)
const pickerInput = design.pickerInput
const handlePickerChange = design.handlePickerChange

onMounted(async () => { await design.init() })
</script>

<template>
  <Head :title="profileUser.name" />
  <AuthenticatedLayout>
    <Toast />
    <div class="page-scroll bg-surface dark:bg-[#090E1A]">
      <div class="max-w-[1040px] lg:max-w-[1120px] mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-4">
        <div v-if="page.isLocked.value" class="rounded-[24px] border border-stone-200 bg-white shadow-soft p-6 flex flex-col items-center text-center gap-3 dark:border-zinc-800 dark:bg-zinc-900">
          <button type="button" class="h-16 w-16 overflow-hidden rounded-[22px] bg-stone-100 dark:bg-zinc-800" @click="page.showAvatar.value = true">
            <Avatar :image="page.avatarSrc.value" shape="square" class="!h-full !w-full [&_img]:object-cover" />
          </button>
          <p class="font-bold text-ink-900 dark:text-white">⛔ Пользователь заблокировал вас</p>
          <p class="text-sm text-stone-500 dark:text-zinc-400">Профиль скрыт.</p>
          <Link href="/map">
            <Button label="На карту →" rounded class="!border-0 !bg-gradient-to-r !from-[#7c3aed] !to-[#3b82f6] !text-sm !font-bold !text-white" />
          </Link>
        </div>

        <template v-else>
          <ProfileDesignHero
            :user="profileUser"
            :avatar-src="page.avatarSrc.value"
            :online="page.online.value"
            :presence-text="design.presenceText.value"
            :level-name="design.levelName.value"
            :plan-name="design.planName.value"
            :reputation-text="design.reputationText.value"
            :email-text="design.emailText.value"
            :headline-text="thought.display(design.headlineText.value, page.bioText.value)"
            :can-edit-thought="isOwn"
            :is-own="isOwn"
            :can-message="page.canMessage.value"
            :is-blocked="page.isBlocked.value"
            :loading="page.profile.loading.value"
            @avatar="page.showAvatar.value = true"
            @open-map="design.onOpenMap()"
            @chat="page.onChat()"
            @edit="design.onEdit()"
            @edit-thought="thought.openDialog()"
          />

          <!-- Одна колонка — лента, две — сайдбар + лента на любой ширине. -->
          <div
            :class="isSingleColumn
              ? 'space-y-3 sm:space-y-4'
              : 'space-y-3 sm:space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-4 lg:items-start'"
          >
            <aside class="min-w-0 space-y-3 sm:space-y-4">
              <div
                v-if="!isOwn && !page.isLocked.value"
                class="flex items-center gap-2 rounded-[24px] border border-stone-200 bg-white shadow-soft p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Button
                  v-if="!page.isFriend.value && !page.isPending.value && !page.isBlocked.value"
                  label="В друзья"
                  icon="pi pi-user-plus"
                  rounded
                  :loading="page.profile.loading.value"
                  class="!flex-1 !rounded-full !border-0 !bg-ink-900 !text-[13px] !font-bold !text-white dark:!bg-white/[0.08] dark:!text-white hover:!opacity-90"
                  @click="page.onAdd()"
                />
                <Button
                  v-else-if="page.isFriend.value"
                  label="В друзьях"
                  icon="pi pi-check"
                  rounded
                  class="!flex-1 !rounded-full !border-0 !bg-emerald-50 !text-[13px] !font-bold !text-emerald-700 dark:!bg-emerald-500/15 dark:!text-emerald-300"
                  @click="page.askRemove()"
                />
                <Button
                  v-else-if="page.isPending.value"
                  label="Ожидает"
                  icon="pi pi-clock"
                  rounded
                  disabled
                  class="!flex-1 !rounded-full !border-0 !bg-stone-100 !text-[13px] !font-bold !text-stone-500 dark:!bg-white/[0.06] dark:!text-zinc-400"
                />
                <UserSubscribeButton
                  v-if="!page.isBlocked.value && page.isFriend.value"
                  :user-id="profileUser.id"
                  :initial="design.subscription"
                  :compact="true"
                  :is-friend="page.isFriend.value"
                />
                <ProfileMoreMenu
                  v-if="!page.isBlocked.value"
                  :user-id="profileUser.id"
                  :user-name="profileUser.name"
                  button-class="!w-10 !h-10 !p-0 !rounded-full !border-0 !bg-stone-100 !text-stone-600 dark:!bg-white/[0.06] dark:!text-zinc-200"
                  @share="page.share()"
                  @block="page.askBlock()"
                  @remove="page.askRemove()"
                  @report="reportDialog.openReport('user', profileUser.id, profileUser.name)"
                />
                <Button
                  v-else
                  label="Разблокировать"
                  icon="pi pi-ban"
                  :loading="page.profile.loading.value"
                  severity="danger"
                  outlined
                  rounded
                  class="!flex-1 !rounded-full !text-[13px] !font-bold"
                  @click="page.onUnblock()"
                />
              </div>

              <div :class="isSingleColumn ? '' : 'hidden'">
                <ProfileDesignQuickNav
                  :is-own="isOwn"
                  variant="tiles"
                  @profile="isOwn ? design.onEdit() : design.scrollTop()"
                  @friends="people.openFriends(profileUser.id, profileUser.name)"
                  @districts="design.goDistricts()"
                  @search="search.openDialog()"
                  @share="page.share()"
                />
              </div>
              <div :class="isSingleColumn ? 'hidden' : ''">
                <ProfileDesignQuickNav
                  :is-own="isOwn"
                  variant="sidebar"
                  @profile="isOwn ? design.onEdit() : design.scrollTop()"
                  @friends="people.openFriends(profileUser.id, profileUser.name)"
                  @districts="design.goDistricts()"
                  @search="search.openDialog()"
                  @share="page.share()"
                />
              </div>

              <ProfileDesignGallery
                :photos="design.galleryPreview.value"
                :loading="gallery.loading.value"
                :add-slots="design.addSlots.value"
                :uploading="gallery.uploading.value"
                @all="gallery.openDialog()"
                @open="(photo) => gallery.open(photo)"
                @add="design.openPicker()"
              />
            </aside>

            <div class="min-w-0 space-y-3 sm:space-y-4">
              <ProfileDesignInfo
                :status-text="design.statusText.value"
                :online="page.online.value"
                :user-name="profileUser.name"
                :age-text="design.infoTiles.ageText.value"
                :gender-label="design.infoTiles.genderLabel.value"
                :residence-text="design.infoTiles.residenceText.value"
                :bio-text="design.page.bioText.value"
                :bio-preview="design.bioPreview.value"
              />

              <ProfileDesignSwipes @go="design.goSwipes()" />

              <ProfileDesignFlow :user-id="profileUser.id" :is-own="isOwn" />
            </div>
          </div>
        </template>

        <ProfileFriendsDialog :people="people" />
        <ProfileThoughtDialog :open="thought.open.value" :draft="thought.draft.value" :saving="thought.saving.value" :error="thought.error.value" @update:draft="(v:string)=>thought.setDraft(v)" @close="thought.close()" @save="thought.save()" />
        <ChatSearchDialog :open="search.open.value" @update:open="(v:boolean)=>{ if(!v) search.closeDialog() }" :query="search.query.value" @update:query="(v:string)=>search.setQuery(v)" :results="search.results.value" :searching="search.searching.value" :creating="search.creating.value" :is-online="(id?:number,lastSeen?:string|null)=>search.isOnline(id,lastSeen)" @chat="search.startChat" @add="search.addFriend" @block="search.askBlock" />
        <ProfileGalleryDialog :gallery="gallery" :is-own="isOwn" :plan="planOf(profileUser)" />
        <ProfilePhotoViewer :gallery="gallery" :comments="photoComments" :is-own="isOwn" :user-name="profileUser.name" :avatar-src="page.avatarSrc.value" />
        <ReportDialog :dialog="reportDialog" />

        <input ref="pickerInput" type="file" accept="image/*" class="absolute w-px h-px opacity-0 overflow-hidden pointer-events-none" tabindex="-1" aria-hidden="true" @change="handlePickerChange" />

        <Teleport to="body">
          <div v-if="page.showAvatar.value" @click="page.showAvatar.value = false" class="fixed inset-0 z-[100] bg-black/80 grid place-items-center p-3 sm:p-4 cursor-zoom-out overflow-auto">
            <Avatar :image="page.avatarSrc.value" shape="square" class="m-auto !w-auto !h-auto max-w-full max-h-[90dvh] !rounded-3xl [&_img]:!rounded-3xl [&_img]:max-h-[90dvh] [&_img]:object-contain" />
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
