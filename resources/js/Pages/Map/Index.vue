<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { onMounted, onUnmounted } from 'vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import MapTopBar from '@/Components/Features/Map/MapTopBar.vue'
import MapCreateDialog from '@/Components/Features/Map/MapCreateDialog.vue'
import PinDetailsCard from '@/Components/Features/Map/PinDetailsCard.vue'
import ReportDialog from '@/Components/Features/Map/ReportDialog.vue'
import MapInfoDialogs from '@/Components/Features/Map/MapInfoDialogs.vue'
import { useSeo } from '@/composables/useSeo'
import { useMapPage } from '@/composables/useMapPage'
import { useMapPinChat } from '@/composables/useMapPinChat'
import { useMentions } from '@/composables/useMentions'
import { useReportDialog } from '@/composables/useReportDialog'
import { formatTime } from '@/utils/date'
import Toast from 'primevue/toast'
import Checkbox from 'primevue/checkbox'
import 'maplibre-gl/dist/maplibre-gl.css'

const seo = useSeo({ title: 'Карта — UPin', description: 'Живая карта UPin.', noindex: true })
const { store, categories, customCats, selectedCategory, filteredPins, pinDetails, pinCreate, pinEdit, mapApi, showCreate, pinAddress, loadingPinAddress, myStreet, loadingStreet, radiusOptions, radiusLabel, homeZone, homeZoneVisible, toggleHomeZone, closeCreate, deleteSelectedPin, saveEdit, deleteCustomCategory, init, destroy, showLiveInfo, showMyPins, myPins, handleMineClick, flyToPin } = useMapPage() as any
const { selectedPin, comments, threadedComments, replyTo, replyTarget, cancelReply, commentText, react, sendComment, editingCommentId, editingContent, highlightCommentId, startEditComment, cancelEditComment, saveEditComment, reactAsyncStatus, createCommentAsyncStatus, boostMutation, updateCommentMutation } = pinDetails as any
const mentions = useMentions()
const reportDialog = useReportDialog()
const { mapContainer, loaded } = mapApi
useMapPinChat(selectedPin)

onMounted(init)
onUnmounted(destroy)
</script>
<template>
  <Head :title="seo.title.value"><meta head-key="robots" name="robots" content="noindex, nofollow" /></Head>
  <AuthenticatedLayout>
    <Toast />
    <div class="relative w-full h-[calc(100dvh-64px-60px-env(safe-area-inset-bottom,0px))] lg:h-[calc(100dvh-64px)] min-h-[380px] bg-[#eaf0f6] dark:bg-[#0B0F1A] overflow-hidden">
      <div ref="mapContainer" class="absolute inset-0 w-full h-full bg-[#eaf0f6] dark:bg-[#0B0F1A]"></div>
      <div v-if="!loaded" class="absolute inset-0 grid place-items-center bg-[#eef3f8] dark:bg-[#0B0F1A] z-[5]">
        <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl px-5 py-4 shadow flex items-center gap-3"><span class="w-5 h-5 border-2 border-stone-200 dark:border-zinc-700 border-t-stone-900 dark:border-t-white rounded-full animate-spin"></span><span class="text-sm font-medium dark:text-zinc-100">Загружаем карту…</span></div>
      </div>
      <div class="absolute top-2 sm:top-4 left-2 right-2 sm:left-4 sm:right-auto sm:max-w-[420px] flex flex-col gap-2 sm:gap-2.5 z-10 pointer-events-none">
        <MapTopBar :count="(filteredPins as any)?.value?.length ?? store.pins.length" :loading="store.loading" :categories="categories" :selected-category="selectedCategory" @update:category="(v:any)=>selectedCategory=v" @info="showLiveInfo = true" @mine="handleMineClick" />
        <Transition name="fade">
          <div v-if="myStreet || loadingStreet" class="pointer-events-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-stone-200 dark:border-zinc-700 rounded-2xl px-4 py-3 shadow flex items-center gap-3 w-fit max-w-[min(92vw,380px)]">
            <span class="w-8 h-8 rounded-full bg-emerald-500/15 dark:bg-emerald-400/15 grid place-items-center text-sm shrink-0">📍</span>
            <div class="min-w-0 leading-snug space-y-0.5"><div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-400">вы здесь</div><div class="text-xs font-semibold truncate dark:text-zinc-100">{{ loadingStreet ? 'Определяем улицу…' : myStreet }}</div></div>
          </div>
        </Transition>
      </div>
      <MapCreateDialog :open="showCreate" @update:open="(v:boolean)=>showCreate=v" :pin-create="pinCreate" :custom-cats="customCats" :categories="categories" :pin-address="pinAddress" :loading-address="loadingPinAddress" :radius-options="radiusOptions" :radius-label="radiusLabel" @close="closeCreate" @delete-custom-category="deleteCustomCategory" />
      <div v-if="homeZone" class="absolute bottom-3 left-3 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-violet-200 dark:border-violet-900/60 rounded-2xl px-3 py-2 shadow flex items-center gap-2">
        <button type="button" @click="mapApi.flyToHomeZone?.(homeZone.lat, homeZone.lng, homeZone.radiusKm)" title="Показать мою зону" class="w-5 h-5 rounded-full bg-violet-500/15 border border-dashed border-violet-500 grid place-items-center shrink-0 hover:bg-violet-500/30 transition">
          <span class="w-1.5 h-1.5 rounded-full bg-violet-600 block pointer-events-none"></span>
        </button>
        <span class="text-[11px] font-semibold text-violet-900 dark:text-violet-200">Зона {{ homeZone.radiusKm }} км</span>
        <label class="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-zinc-400 cursor-pointer select-none ml-1">
          <Checkbox :model-value="homeZoneVisible" @update:model-value="toggleHomeZone" :binary="true" class="!w-4 !h-4" />
          зона
        </label>
      </div>
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-y-4" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0 translate-y-4">
        <PinDetailsCard v-if="selectedPin" :pin="selectedPin" :comments="threadedComments" :highlight-comment-id="highlightCommentId" :comment-text="commentText" @update:comment="(v:string)=>commentText=v" :creating-comment="createCommentAsyncStatus?.value==='loading'" :editing-comment-id="editingCommentId" :editing-content="editingContent" @update:edit-content="(v:string)=>editingContent=v" :saving-comment="updateCommentMutation?.asyncStatus?.value==='loading'" :reacting="reactAsyncStatus?.value==='loading'" :reporting="reportDialog.sending.value" :pin-edit="pinEdit" :categories="categories" :deleting="store.deleting" :auth-id="($page as any).props.auth?.user?.id ?? 0" :reply-to="replyTo" :mentions="mentions" @close="pinDetails.closePin()" @delete="deleteSelectedPin" @react="(k:string)=>react(selectedPin, k)" @report="reportDialog.openReport('pin', selectedPin.id, selectedPin.title)" @send-comment="sendComment" @reply="(r:any,t:any)=>replyTarget(r,t)" @cancel-reply="cancelReply" @start-edit-comment="startEditComment" @cancel-edit-comment="cancelEditComment" @save-edit-comment="saveEditComment" @save-edit="saveEdit" />
      </Transition>
      <ReportDialog :dialog="reportDialog" />
      <MapInfoDialogs :live-open="showLiveInfo" @update:live="(v:boolean)=>showLiveInfo=v" :my-open="showMyPins" @update:my="(v:boolean)=>showMyPins=v" :my-pins="myPins" :format-time="formatTime" @fly="flyToPin" />
    </div>
  </AuthenticatedLayout>
</template>
<style scoped>
.fade-enter-active,.fade-leave-active{transition:opacity .22s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
.scrollbar-none::-webkit-scrollbar{display:none}
.scrollbar-none{scrollbar-width:none}
</style>
