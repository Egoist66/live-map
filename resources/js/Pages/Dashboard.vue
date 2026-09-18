<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head } from '@inertiajs/vue3'
import Toast from 'primevue/toast'
import Button from 'primevue/button'
import AvatarPreview from '@/Components/Features/Media/AvatarPreview.vue'
import ProfileDesignHero from '@/Components/Features/Profile/ProfileDesignHero.vue'
import ProfileDesignQuickNav from '@/Components/Features/Profile/ProfileDesignQuickNav.vue'
import ProfileDesignGallery from '@/Components/Features/Profile/ProfileDesignGallery.vue'
import ProfileDesignInfo from '@/Components/Features/Profile/ProfileDesignInfo.vue'
import ProfileDesignSwipes from '@/Components/Features/Profile/ProfileDesignSwipes.vue'
import ProfileDesignFlow from '@/Components/Features/Profile/ProfileDesignFlow.vue'
import ProfileFriendsDialog from '@/Components/Features/Profile/ProfileFriendsDialog.vue'
import ProfileGalleryDialog from '@/Components/Features/Profile/ProfileGalleryDialog.vue'
import ProfilePhotoViewer from '@/Components/Features/Profile/ProfilePhotoViewer.vue'
import ChatSearchDialog from '@/Components/Features/Chat/ChatSearchDialog.vue'
import ProfileThoughtDialog from '@/Components/Features/Profile/ProfileThoughtDialog.vue'
import { useDashboardDesign } from '@/composables/useDashboardDesign'
import { useProfileLayout } from '@/composables/useProfileLayout'
import { useProfileThought } from '@/composables/useProfileThought'
import { planOf } from '@/composables/usePlanLimits'
import { onMounted } from 'vue'

const props = defineProps<{ user: any; isOwn?: boolean }>()

const design = useDashboardDesign(props.user, props.isOwn)
const { single: isSingleColumn } = useProfileLayout()
const { dash, gallery, people, search, photoComments } = design
const thought = useProfileThought(() => dash.u.value.thought)
const pickerInput = design.pickerInput
const handlePickerChange = design.handlePickerChange

onMounted(async () => { await design.init() })
</script>

<template>
  <Head :title="dash.seo.title.value"><meta head-key="robots" name="robots" content="noindex, nofollow" /></Head>
  <AuthenticatedLayout>
    <Toast />
    <div class="page-scroll bg-surface dark:bg-[#090E1A]">
      <div class="max-w-[1040px] lg:max-w-[1120px] mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-4">
        <button
          v-if="dash.isAdmin.value && dash.isOwn.value"
          type="button"
          class="flex items-center gap-1.5 text-[11px] font-bold text-stone-500 transition hover:text-ink-900 dark:text-zinc-500 dark:hover:text-zinc-200"
          @click="dash.goAdmin"
        >
          <span class="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-ink-900 text-white dark:bg-white dark:text-zinc-900"><i class="pi pi-shield text-[10px]"></i></span>
          <span class="truncate">Модератор · Панель модерации →</span>
        </button>


      
        <ProfileDesignHero
          :user="dash.u.value"
          :avatar-src="dash.avatarSrc.value"
          :online="dash.presence.value.active"
          :presence-text="design.presenceText.value"
          :level-name="dash.levelName.value"
          :plan-name="design.planName.value"
          :reputation-text="design.reputationText.value"
          :email-text="design.emailText.value"
          :headline-text="thought.display(design.headlineText.value, dash.bioText.value)"
          :can-edit-thought="true"
          :is-own="true"
          :can-message="false"
          :is-blocked="false"
          :loading="false"
          @avatar="dash.openAvatar()"
          @open-map="dash.goMap()"
          @chat="dash.goChat()"
          @edit="dash.goSettings()"
          @edit-thought="thought.openDialog()"
        />

        <!-- Одна колонка — лента, две — сайдбар + лента на любой ширине. -->
        <div
          :class="isSingleColumn
            ? 'space-y-3 sm:space-y-4'
            : 'space-y-3 sm:space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-4 lg:items-start'"
        >
          <aside class="min-w-0 space-y-3 sm:space-y-4">
            <!-- Одна колонка: ряд-плитка на любой ширине. Две: сайдбар-меню на любой ширине. -->
            <div :class="isSingleColumn ? '' : 'hidden'">
              <ProfileDesignQuickNav
                :is-own="true"
                variant="tiles"
                @profile="dash.goSettings()"
                @friends="people.openFriends(dash.u.value.id, dash.u.value.name)"
                @districts="design.goDistricts()"
                @search="search.openDialog()"
                @share="dash.share()"
              />
            </div>
            <div :class="isSingleColumn ? 'hidden' : ''">
              <ProfileDesignQuickNav
                :is-own="true"
                variant="sidebar"
                @profile="dash.goSettings()"
                @friends="people.openFriends(dash.u.value.id, dash.u.value.name)"
                @districts="design.goDistricts()"
                @search="search.openDialog()"
                @share="dash.share()"
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
              :online="dash.presence.value.active"
              :user-name="dash.u.value.name"
              :age-text="design.infoTiles.ageText.value"
              :gender-label="design.infoTiles.genderLabel.value"
              :residence-text="design.infoTiles.residenceText.value"
              :bio-text="dash.bioText.value"
              :bio-preview="design.bioPreview.value"
            />

            <ProfileDesignSwipes @go="design.goSwipes()" />

            <ProfileDesignFlow :user-id="dash.u.value.id" :is-own="true" />
          </div>
        </div>

        <ProfileFriendsDialog :people="people" />
        <ProfileThoughtDialog :open="thought.open.value" :draft="thought.draft.value" :saving="thought.saving.value" :error="thought.error.value" @update:draft="(v:string)=>thought.setDraft(v)" @close="thought.close()" @save="thought.save()" />
        <ChatSearchDialog :open="search.open.value" @update:open="(v:boolean)=>{ if(!v) search.closeDialog() }" :query="search.query.value" @update:query="(v:string)=>search.setQuery(v)" :results="search.results.value" :searching="search.searching.value" :creating="search.creating.value" :is-online="(id?:number,lastSeen?:string|null)=>search.isOnline(id,lastSeen)" @chat="search.startChat" @add="search.addFriend" @block="search.askBlock" />
        <ProfileGalleryDialog :gallery="gallery" :is-own="true" :plan="planOf(dash.u.value)" />
        <ProfilePhotoViewer :gallery="gallery" :comments="photoComments" :is-own="true" :user-name="dash.u.value.name" :avatar-src="dash.avatarSrc.value" />

        <input ref="pickerInput" type="file" accept="image/*" class="absolute w-px h-px opacity-0 overflow-hidden pointer-events-none" tabindex="-1" aria-hidden="true" @change="handlePickerChange" />
      </div>
      <AvatarPreview :src="dash.avatarSrc.value" :name="dash.u.value.name" :open="dash.showAvatar.value" @close="dash.closeAvatar()" />
    </div>
  </AuthenticatedLayout>
</template>
