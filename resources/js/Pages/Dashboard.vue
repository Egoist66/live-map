<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head } from '@inertiajs/vue3'
import AvatarPreview from '@/Components/AvatarPreview.vue'
import DashboardHero from '@/Components/Dashboard/DashboardHero.vue'
import DashboardInfo from '@/Components/Dashboard/DashboardInfo.vue'
import DashboardActions from '@/Components/Dashboard/DashboardActions.vue'
import Toast from 'primevue/toast'
import { useDashboardPage } from '@/composables/useDashboardPage'

const props = defineProps<{ user: any; isOwn?: boolean }>()
const { seo, u, isOwn, showAvatar, avatarSrc, bioText, bioEmpty, settingsHref, sharing, levelLabel, levelColor, planLabel, planColor, openAvatar, closeAvatar, goMap, goChat, goSettings, goFaq, share } = useDashboardPage(props.user, props.isOwn)
</script>
<template>
  <Head :title="seo.title.value"><meta head-key="robots" name="robots" content="noindex, nofollow" /></Head>
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)] overflow-x-hidden">
      <div class="max-w-[980px] mx-auto w-full max-w-full min-w-0 px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 overflow-hidden">
        <DashboardHero :user="u" :avatar-src="avatarSrc" :level-label="levelLabel" :level-color="levelColor" :plan-label="planLabel" :plan-color="planColor" :sharing="sharing" @avatar="openAvatar" @map="goMap" @chat="goChat" @share="share" />
        <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 min-w-0">
          <DashboardInfo :user="u" :bio-empty="bioEmpty" :bio-text="bioText" :is-own="isOwn" :settings-href="settingsHref" />
          <DashboardActions :is-own="isOwn" @map="goMap" @settings="goSettings" @faq="goFaq" />
        </div>
      </div>
      <AvatarPreview :src="avatarSrc" :name="u.name" :open="showAvatar" @close="closeAvatar" />
    </div>
  </AuthenticatedLayout>
</template>
