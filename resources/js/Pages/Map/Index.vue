<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { onMounted, onUnmounted } from 'vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import MapTopBar from '@/Components/Map/MapTopBar.vue'
import MapCreateDialog from '@/Components/Map/MapCreateDialog.vue'
import PinDetailsCard from '@/Components/Map/PinDetailsCard.vue'
import MapInfoDialogs from '@/Components/Map/MapInfoDialogs.vue'
import { useSeo } from '@/composables/useSeo'
import { useMapPage } from '@/composables/useMapPage'
import { useMapPinChat } from '@/composables/useMapPinChat'
import { formatTime } from '@/utils/date'
import Toast from 'primevue/toast'
import 'maplibre-gl/dist/maplibre-gl.css'

const seo = useSeo({ title: 'Карта — UPin', description: 'Живая карта UPin.', noindex: true })
const { store, categories, selectedCategory, filteredPins, pinDetails, pinCreate, pinEdit, mapApi, showCreate, pinAddress, loadingPinAddress, myStreet, loadingStreet, radiusOptions, radiusLabel, closeCreate, deleteSelectedPin, saveEdit, init, destroy, showLiveInfo, showMyPins, myPins, handleMineClick, flyToPin } = useMapPage() as any
const { selectedPin, comments, commentText, react, sendComment, reportPin, editingCommentId, editingContent, startEditComment, cancelEditComment, saveEditComment, reactAsyncStatus, createCommentAsyncStatus, boostMutation, reportMutation, updateCommentMutation } = pinDetails as any
const { mapContainer, loaded } = mapApi
useMapPinChat(selectedPin)

onMounted(init)
onUnmounted(destroy)
</script>
<template>
  <Head :title="seo.title.value"><meta head-key="robots" name="robots" content="noindex, nofollow" /></Head>
  <AuthenticatedLayout>
    <Toast />
    <div class="relative w-full h-[calc(100dvh-64px-56px-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-64px)] min-h-[400px] bg-[#eaf0f6] overflow-hidden">
      <div ref="mapContainer" class="absolute inset-0 w-full h-full bg-[#eaf0f6]"></div>
      <div v-if="!loaded" class="absolute inset-0 grid place-items-center bg-[#eef3f8] z-[5]">
        <div class="bg-white border rounded-2xl px-5 py-4 shadow flex items-center gap-3"><span class="w-5 h-5 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin"></span><span class="text-sm font-medium">Загружаем карту…</span></div>
      </div>
      <div class="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-auto flex flex-col gap-2.5 z-10 pointer-events-none">
        <MapTopBar :count="(filteredPins as any)?.value?.length ?? store.pins.length" :loading="store.loading" :categories="categories" :selected-category="selectedCategory" @update:category="(v:any)=>selectedCategory=v" @info="showLiveInfo = true" @mine="handleMineClick" />
        <Transition name="fade">
          <div v-if="myStreet || loadingStreet" class="pointer-events-auto bg-white/95 backdrop-blur border rounded-full pl-1 pr-3 py-1 shadow flex items-center gap-2 w-fit max-w-[min(92vw,380px)]">
            <div class="min-w-0 leading-none"><div class="text-[10px] font-bold tracking-widest uppercase text-stone-400">вы здесь</div><div class="text-xs font-semibold truncate">{{ loadingStreet ? 'Определяем улицу…' : myStreet }}</div></div>
          </div>
        </Transition>
      </div>
      <MapCreateDialog :open="showCreate" @update:open="(v:boolean)=>showCreate=v" :pin-create="pinCreate" :categories="categories" :pin-address="pinAddress" :loading-address="loadingPinAddress" :radius-options="radiusOptions" :radius-label="radiusLabel" @close="closeCreate" />
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-y-4" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0 translate-y-4">
        <PinDetailsCard :pin="selectedPin" :comments="comments" :comment-text="commentText" @update:comment="(v:string)=>commentText=v" :creating-comment="createCommentAsyncStatus?.value==='loading'" :editing-comment-id="editingCommentId" :editing-content="editingContent" @update:edit-content="(v:string)=>editingContent=v" :saving-comment="updateCommentMutation?.asyncStatus?.value==='loading'" :reacting="reactAsyncStatus?.value==='loading'" :reporting="reportMutation?.asyncStatus?.value==='loading'" :pin-edit="pinEdit" :categories="categories" :deleting="store.deleting" :auth-id="($page as any).props.auth.user.id" @close="pinDetails.closePin()" @delete="deleteSelectedPin" @react="(k:string)=>react(selectedPin, k)" @report="reportPin(selectedPin)" @send-comment="sendComment" @start-edit-comment="startEditComment" @cancel-edit-comment="cancelEditComment" @save-edit-comment="saveEditComment" @save-edit="saveEdit" />
      </Transition>
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
