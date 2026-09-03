<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { onMounted, onUnmounted } from 'vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { useSeo } from '@/composables/useSeo'
const seo = useSeo({ title: 'Карта — UPin', description: 'Живая карта UPin: пины соседей рядом, фильтры по категориям, создание пина в 2 клика. Требуется вход.', noindex: true })
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapPage } from '@/composables/useMapPage'
import { usePinChat } from '@/composables/usePinChat'
import { formatTime } from '@/utils/date'
import Toast from 'primevue/toast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Card from 'primevue/card'
import Badge from 'primevue/badge'
import Chip from 'primevue/chip'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { watch } from 'vue'
import { avatarSrcFor } from '@/composables/useAvatar'

const {
  store, categories, selectedCategory, pinDetails, pinCreate, pinEdit, mapApi,
  showCreate, pinAddress, loadingPinAddress, myStreet, loadingStreet,
  radiusOptions, radiusLabel, closeCreate, deleteSelectedPin, saveEdit, init, destroy,
  showLiveInfo, showMyPins, myPins, handleMineClick, flyToPin,
} = useMapPage()

const { selectedPin, comments, commentText, react, sendComment, reportPin, boost, editingCommentId, editingContent, startEditComment, cancelEditComment, saveEditComment, reactAsyncStatus, createCommentAsyncStatus, boostMutation, reportMutation, updateCommentMutation } = pinDetails as any
const { mapContainer, loaded } = mapApi
const pinChat = usePinChat()

watch(() => (selectedPin as any)?.value?.user?.id, (id) => { if (id && !(selectedPin as any).value.is_owner) pinChat.loadStatus(id) })

function openCreateFromUI() { showCreate.value = true }

onMounted(init)
onUnmounted(destroy)
</script>

<template>
  <Head :title="seo.title.value"><meta head-key="robots" name="robots" content="noindex, nofollow" /></Head>
  <AuthenticatedLayout>
    <Toast />
    <div class="relative w-full h-[calc(100dvh-64px-56px-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-64px)] min-h-[400px] bg-[#eaf0f6] overflow-hidden">
      <div ref="mapContainer" class="absolute inset-0 w-full h-full bg-[#eaf0f6]"></div>

      <div v-if="!loaded" class="absolute inset-0 grid place-items-center bg-[#eef3f8] dark:bg-zinc-900 z-[5]">
        <div class="bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl px-5 py-4 shadow-soft flex items-center gap-3">
          <span class="w-5 h-5 border-2 border-stone-200 dark:border-zinc-600 border-t-ink-900 dark:border-t-white rounded-full animate-spin"></span>
          <span class="text-sm font-medium dark:text-white">Загружаем карту…</span>
        </div>
      </div>

      <div class="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-auto flex flex-col gap-2.5 z-10 pointer-events-none">
        <Card class="pointer-events-auto !rounded-2xl sm:!rounded-full !shadow-soft !border-stone-200 dark:!border-zinc-700 !bg-white/95 dark:!bg-zinc-900/95 backdrop-blur !p-1.5 sm:!pl-2 sm:!pr-2 w-full max-w-full overflow-hidden" :pt="{ body: { class: '!p-0 w-full' }, content: { class: '!p-0 w-full' } }">
          <template #content>
            <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full snap-x">
              <Tag @click="showLiveInfo=true" :value="String(store.pins.length)" severity="contrast" rounded class="shrink-0 !bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white cursor-pointer hover:opacity-90 snap-start">
                <template #icon><span v-if="store.loading" class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span><span v-else class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block"></span></template>
              </Tag>
              <div class="h-5 w-px bg-stone-200 dark:bg-zinc-700 shrink-0 hidden sm:block"></div>
              <SelectButton v-model="selectedCategory" :options="[{label:'Все',value:'all'}, {label:'📍 Мои',value:'mine'}, ...categories.map(c=>({label:`${c.i} ${c.l}`, value:c.v}))]" optionLabel="label" optionValue="value" class="hidden sm:flex shrink-0" :allowEmpty="false" :pt="{ button: { class: '!rounded-full !text-xs !py-1.5 !px-3.5 !whitespace-nowrap' } }" />
              <div class="flex sm:hidden items-center gap-1.5 overflow-x-auto scrollbar-none snap-x flex-1 min-w-0">
                <Button label="Все" size="small" rounded :severity="selectedCategory==='all' ? 'contrast' : 'secondary'" :outlined="selectedCategory!=='all'" @click="selectedCategory='all'" class="shrink-0 !text-xs snap-start" />
                <Button label="📍 Мои" size="small" rounded :severity="selectedCategory==='mine' ? 'warn' : 'secondary'" :outlined="selectedCategory!=='mine'" @click="handleMineClick" class="shrink-0 !text-xs snap-start" />
                <Chip v-for="c in categories.slice(0,4)" :key="c.v" :label="c.i" @click="selectedCategory=c.v" :class="selectedCategory===c.v ? '!bg-ink-900 !text-white !border-ink-900' : '!bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 border'" class="shrink-0 cursor-pointer !rounded-full snap-start !text-xs !py-1" />
              </div>
            </div>
          </template>
        </Card>
        <Transition name="fade">
          <div v-if="myStreet || loadingStreet" class="pointer-events-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-stone-200 dark:border-zinc-700 rounded-full pl-1 pr-3 py-1 shadow-soft flex items-center gap-2 w-fit max-w-[min(92vw,380px)]">
            <span class="w-7 h-7 rounded-full bg-ink-900 dark:bg-white dark:text-ink-900 text-white dark:text-ink-900 grid place-items-center shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div class="min-w-0 leading-none">
              <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">вы здесь</div>
              <div class="text-xs font-semibold text-ink-900 dark:text-white truncate">{{ loadingStreet ? 'Определяем улицу…' : myStreet }}</div>
            </div>
            <span v-if="loadingStreet" class="w-3.5 h-3.5 border-2 border-stone-200 dark:border-zinc-600 border-t-ink-900 dark:border-t-white rounded-full animate-spin shrink-0"></span>
            <span v-else class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
          </div>
        </Transition>
        <div class="hidden sm:flex pointer-events-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-stone-200 dark:border-zinc-700 rounded-full px-3.5 py-2 text-xs font-medium shadow-soft items-center gap-2 w-fit dark:text-zinc-200">
          <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> кликнуть по карте — создашь пин
          <span class="bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-2 py-0.5 text-[11px] font-bold">2 мин</span>
        </div>
      </div>

      <div class="absolute bottom-4 left-4 hidden xl:flex z-10 pointer-events-none">
        <div class="bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-stone-200 dark:border-zinc-700 rounded-full px-3.5 py-2 shadow-soft flex items-center gap-2 text-xs font-medium dark:text-zinc-200">
          <span class="w-7 h-7 rounded-full bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 grid place-items-center text-[11px] dark:text-zinc-300">◐</span>
          {{ store.pins.length }} пинов · живёт 2–24ч · размытие 200м
        </div>
      </div>

      <Dialog v-model:visible="showCreate" modal :dismissableMask="true" :closable="true" header="Новый пин" :style="{ width: '520px', maxWidth: '96vw' }" contentClass="!p-0" @hide="closeCreate">
        <template #header><div><div class="text-[16px] font-black">Новый пин</div><div class="text-[11px] text-stone-500">Клик по карте — переместить точку</div></div></template>
        <form @submit.prevent="pinCreate.submit" class="p-4 sm:p-5 space-y-3">
          <div class="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <span class="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-[12px] font-semibold leading-tight truncate">
                <span v-if="loadingPinAddress" class="text-stone-400">Определяем адрес…</span>
                <span v-else-if="pinCreate.showCoords.value" class="font-mono">{{ (pinCreate.values as any).latitude?.toFixed(5) }}, {{ (pinCreate.values as any).longitude?.toFixed(5) }}</span>
                <span v-else>{{ pinAddress || 'Адрес не определён' }}</span>
              </div>
              <div class="text-[10px] text-stone-400 leading-none mt-0.5 truncate">кликни → переместить</div>
            </div>
          </div>
          <label class="flex items-center justify-between bg-white border border-stone-200 rounded-full px-3 py-2 cursor-pointer hover:bg-stone-50 transition">
            <span class="text-[11px] font-semibold flex items-center gap-1.5"><span class="w-5 h-5 rounded-full bg-stone-100 border border-stone-200 grid place-items-center text-[10px]">◈</span> Показать координаты</span>
            <input type="checkbox" v-model="pinCreate.showCoords.value" class="sr-only" />
            <span :class="['w-8 h-5 rounded-full p-0.5 flex items-center transition', pinCreate.showCoords.value ? 'bg-ink-900' : 'bg-stone-300']">
              <span :class="['w-4 h-4 bg-white rounded-full shadow transition', pinCreate.showCoords.value ? 'translate-x-3' : 'translate-x-0']"></span>
            </span>
          </label>

          <div>
            <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Заголовок *</label>
            <InputText v-model="pinCreate.title.value" v-bind="pinCreate.titleAttrs" placeholder="Напр. Отдам стул, где кофе?" maxlength="100" class="w-full mt-1 !rounded-2xl" />
            <small class="text-red-500 text-xs">{{ pinCreate.errors.value.title }}</small>
            <div class="flex justify-between text-[10px] mt-1"><span class="text-stone-400">Коротко</span><span :class="(pinCreate.title.value?.length||0)>80?'text-amber-600':'text-stone-400'">{{ pinCreate.title.value?.length||0 }}/100</span></div>
          </div>
          <div>
            <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Подробности</label>
            <Textarea v-model="pinCreate.body.value" placeholder="Адрес, время, контакты…" rows="2" autoResize maxlength="1000" class="w-full mt-1 !rounded-2xl" />
            <small class="text-red-500 text-xs">{{ pinCreate.errors.value.body }}</small>
          </div>
          <div>
            <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Категория</label>
            <div class="mt-1.5 grid grid-cols-3 gap-1.5">
              <button v-for="c in categories" :key="c.v" type="button" @click="(pinCreate.category.value as any)=c.v" :class="['group relative px-2 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition', (pinCreate.category.value as any)===c.v?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">
                <span class="text-sm leading-none">{{ c.i }}</span><span class="leading-none text-[11px]">{{ c.l }}</span>
              </button>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Приватность</label>
            <div class="mt-1.5 grid grid-cols-3 gap-1.5">
              <button type="button" @click="(pinCreate.location_precision.value as any)='blur_200'" :class="['rounded-full py-2 text-xs font-semibold border transition flex items-center justify-center gap-1', (pinCreate.location_precision.value as any)==='blur_200'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">Размыто <span class="text-[11px] opacity-60">200м</span></button>
              <button type="button" @click="(pinCreate.location_precision.value as any)='exact'" :class="['rounded-full py-2 text-xs font-semibold border transition', (pinCreate.location_precision.value as any)==='exact'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">Точно</button>
              <button type="button" @click="(pinCreate.location_precision.value as any)='district'" :class="['rounded-full py-2 text-xs font-semibold border transition', (pinCreate.location_precision.value as any)==='district'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">Район</button>
            </div>
          </div>
          <div class="bg-white border border-stone-200 rounded-xl p-2.5">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Радиус</label>
              <span class="text-[11px] font-bold bg-ink-900 text-white rounded-full px-2 py-0.5">{{ radiusLabel }}</span>
            </div>
            <div class="mt-1.5 grid grid-cols-4 gap-1">
              <button v-for="o in radiusOptions" :key="o.v" type="button" :disabled="o.disabled" @click="(pinCreate.radius_meters.value as any)=o.v" :class="['rounded-full py-2 text-xs font-semibold border transition', o.disabled ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed' : (pinCreate.radius_meters.value as any)===o.v ? 'bg-ink-900 text-white border-ink-900 shadow-soft' : 'bg-white border-stone-200 hover:bg-stone-50']">
                {{ o.l }}
              </button>
            </div>
          </div>
          <label class="flex items-center gap-2.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-stone-100 transition">
            <input type="checkbox" v-model="(pinCreate.is_anonymous.value as any)" class="rounded text-ink-900 w-[16px] h-[16px] border-stone-300" />
            <div class="flex-1 min-w-0"><div class="text-xs font-semibold leading-none">Анонимно</div><div class="text-[11px] text-stone-500 mt-0.5">без репутации</div></div>
          </label>
          <div class="flex gap-2 pt-2">
            <Button type="button" severity="secondary" outlined rounded class="flex-1" label="Отмена" @click="closeCreate" />
            <Button :loading="pinCreate.creating" :disabled="!pinCreate.title.value?.trim()" type="submit" rounded class="flex-[1.4] !bg-ink-900 !border-ink-900" :label="pinCreate.creating ? 'Создаём…' : 'Создать пин →'" />
          </div>
          <p class="text-[10px] text-stone-400 text-center leading-relaxed">Free: 3/день · Pro $4.99 · 2–24ч · правила района</p>
        </form>
      </Dialog>

      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-y-4 sm:translate-x-4 sm:translate-y-0" enter-to-class="opacity-100 translate-y-0 sm:translate-x-0" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0 translate-y-4 sm:translate-x-4">
        <div v-if="selectedPin" class="absolute inset-x-3 bottom-3 top-auto max-h-[78vh] sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[380px] sm:max-h-none bg-white rounded-[20px] shadow-float border border-stone-200 flex flex-col overflow-hidden z-20">
          <div class="p-5 border-b border-stone-200">
            <div v-if="!pinEdit.editing.value" class="flex justify-between items-start gap-3"><h3 class="font-bold leading-tight pr-2 text-[15px]">{{ selectedPin.title }}</h3><div class="flex items-center gap-1 shrink-0"><Button v-if="selectedPin.is_owner" icon="pi pi-pencil" rounded text size="small" @click="pinEdit.start(selectedPin)" /><Button v-if="selectedPin.is_owner" icon="pi pi-trash" severity="danger" rounded text size="small" :loading="store.deleting" @click="deleteSelectedPin" /><Button icon="pi pi-times" rounded text size="small" @click="pinDetails.closePin()" /></div></div>
            <div v-else class="space-y-3">
              <InputText v-model="pinEdit.title.value" v-bind="pinEdit.titleAttrs" maxlength="100" placeholder="Заголовок" class="w-full !rounded-xl" />
              <small class="text-red-500 text-xs">{{ pinEdit.errors.value.title }}</small>
              <Textarea v-model="pinEdit.body.value" rows="3" maxlength="1000" placeholder="Подробности" autoResize class="w-full !rounded-xl" />
              <div class="flex gap-1.5 flex-wrap">
                <button v-for="c in categories" :key="c.v" @click="(pinEdit.category.value as any)=c.v" :class="['px-3 py-1.5 rounded-full text-xs font-semibold border', (pinEdit.category.value as any)===c.v?'bg-ink-900 text-white border-ink-900':'bg-white border-stone-200']">{{ c.i }} {{ c.l }}</button>
              </div>
              <div class="flex gap-2">
                <Button label="Сохранить" rounded class="flex-1 !bg-ink-900 !border-ink-900" :loading="pinEdit.updating" @click="saveEdit" />
                <Button label="Отмена" severity="secondary" outlined rounded class="flex-1" @click="pinEdit.cancel()" />
              </div>
            </div>
            <p v-if="!pinEdit.editing.value" class="text-sm text-stone-600 mt-2 leading-relaxed">{{ selectedPin.body }}</p>
            <div v-if="!pinEdit.editing.value" class="flex flex-wrap gap-1.5 mt-3 items-center">
              <span class="text-xs bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1 font-medium">{{ selectedPin.category }}</span>
              <Link v-if="selectedPin.user && !selectedPin.is_anonymous" :href="`/users/${selectedPin.user.id}`" class="hover:opacity-80">
                <Chip :label="`${selectedPin.user?.name} · ${selectedPin.user?.level||'novice'}`" :image="avatarSrcFor(selectedPin.user) || undefined" class="!bg-white !border !border-stone-200 !rounded-full !pl-1 !pr-2.5 !py-1 !text-xs" />
              </Link>
              <span v-else class="text-xs bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1">{{ selectedPin.is_anonymous ? 'аноним' : 'аноним' }} · {{ selectedPin.user?.level||'novice' }}</span>
              <span class="text-xs bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">до {{ formatTime(selectedPin.expires_at) }}</span>
            </div>
            <div v-if="!pinEdit.editing.value && selectedPin.user && !selectedPin.is_owner && !selectedPin.is_anonymous" class="flex gap-2 mt-3">
              <button
                @click="pinChat.startChat(selectedPin.user.id)"
                :disabled="pinChat.loadingId.value===selectedPin.user.id || (pinChat.getStatus(selectedPin.user.id) && !pinChat.getStatus(selectedPin.user.id).can_message)"
                :title="pinChat.getStatus(selectedPin.user.id)?.can_message_reason || 'Начать чат — откроется окно диалога. Если закрыто — добавьте в друзья'"
                class="flex-1 py-2 rounded-full text-xs font-bold border bg-ink-900 text-white border-ink-900 hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                <span>💬</span> {{ pinChat.getStatus(selectedPin.user.id)?.can_message===false ? 'Закрыто' : 'Написать' }}
              </button>
              <button
                v-if="!pinChat.getStatus(selectedPin.user.id)?.is_friend"
                @click="pinChat.addFriend(selectedPin.user.id)"
                :disabled="pinChat.loadingId.value===selectedPin.user.id || pinChat.getStatus(selectedPin.user.id)?.is_pending"
                :title="pinChat.getStatus(selectedPin.user.id)?.is_pending ? 'Заявка уже отправлена, ждите принятия' : 'Отправить заявку в друзья — после принятия сможете писать, если у пользователя «только друзья»'"
                class="flex-1 py-2 rounded-full text-xs font-bold border bg-white border-stone-200 hover:bg-stone-50 disabled:opacity-40 flex items-center justify-center gap-1">
                {{ pinChat.getStatus(selectedPin.user.id)?.is_pending ? '⏳ Заявка' : '＋ В друзья' }}
              </button>
              <span v-else class="flex-1 py-2 rounded-full text-xs font-bold border bg-emerald-50 border-emerald-200 text-emerald-700 grid place-items-center">✓ Друзья</span>
            </div>
            <div v-if="!pinEdit.editing.value && selectedPin.user && pinChat.getStatus(selectedPin.user.id)?.can_message===false" class="mt-2 text-[11px] text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2" :title="pinChat.getStatus(selectedPin.user.id).can_message_reason">
              ⚠ {{ pinChat.getStatus(selectedPin.user.id).can_message_reason }} — добавьте в друзья
            </div>
            <div class="flex gap-1.5 mt-4">
              <button @click="react(selectedPin,'like')" :disabled="reactAsyncStatus?.value==='loading'" :class="['flex-1 rounded-full py-2.5 text-xs font-semibold border active:scale-95 transition flex items-center justify-center gap-1 disabled:opacity-50', selectedPin.my_reaction==='like'?'bg-rose-500 text-white border-rose-500 shadow-[0_2px_10px_rgba(244,63,94,0.35)]':'bg-white border-stone-200 hover:bg-stone-50']">❤️ {{ selectedPin.reactions_count||0 }}</button>
              <button @click="react(selectedPin,'fire')" :disabled="reactAsyncStatus?.value==='loading'" class="px-4 rounded-full text-xs font-semibold border active:scale-95 transition disabled:opacity-50" :class="selectedPin.my_reaction==='fire'?'bg-orange-500 text-white border-orange-500':'bg-white border-stone-200 hover:bg-stone-50'">🔥</button>
              <button @click="react(selectedPin,'useful')" :disabled="reactAsyncStatus?.value==='loading'" class="px-4 rounded-full text-xs font-semibold border active:scale-95 transition disabled:opacity-50" :class="selectedPin.my_reaction==='useful'?'bg-emerald-500 text-white border-emerald-500':'bg-white border-stone-200 hover:bg-stone-50'">👍</button>
              <button @click="reportPin(selectedPin)" :disabled="reportMutation?.asyncStatus?.value==='loading'" class="w-10 h-10 bg-white border border-stone-200 rounded-full grid place-items-center hover:bg-red-50 hover:text-red-600 disabled:opacity-50">⚠</button>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-4">
              <Button @click="boost(selectedPin,'top')" :loading="boostMutation?.asyncStatus?.value==='loading'" class="!rounded-2xl !bg-gradient-to-br !from-amber-400 !to-orange-500 !border-0 !text-stone-900 !py-3" label="👑 Топ $0.99" size="small" />
              <Button @click="boost(selectedPin,'glow')" :loading="boostMutation?.asyncStatus?.value==='loading'" class="!rounded-2xl !bg-gradient-to-br !from-violet-600 !to-indigo-600 !border-0 !py-3" label="✨ Подсветка $1.99" size="small" />
              <Button @click="boost(selectedPin,'extend')" :loading="boostMutation?.asyncStatus?.value==='loading'" class="!rounded-2xl !bg-gradient-to-br !from-emerald-500 !to-teal-600 !border-0 !py-3" label="⏳ +24ч $2.99" size="small" />
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-stone-50/40">
            <div v-for="c in comments" :key="c.id" class="bg-white border border-stone-200 rounded-2xl p-3.5">
              <div class="font-semibold text-xs flex items-center gap-2">
                {{ c.is_anonymous ? 'аноним' : c.user?.name }}
                <span class="text-stone-400 font-normal">{{ formatTime(c.created_at) }}</span>
              </div>
              <div v-if="editingCommentId!==c.id" class="text-sm text-stone-700 mt-1.5 leading-relaxed break-words">{{ c.content }}</div>
              <div v-else class="mt-2"><Textarea v-model="editingContent" rows="2" maxlength="1000" class="w-full !rounded-xl" /><div class="flex gap-2 mt-2"><Button label="Сохранить" size="small" rounded :loading="updateCommentMutation?.asyncStatus?.value==='loading'" @click="saveEditComment" /><Button label="Отмена" size="small" severity="secondary" outlined rounded @click="cancelEditComment" /></div></div>
              <div v-if="editingCommentId!==c.id" class="mt-2 flex gap-1"><Button v-if="c.user_id===(($page as any).props.auth.user.id)" label="ред." size="small" text @click="startEditComment(c)" /></div>
            </div>
            <div v-if="!comments.length" class="text-center py-10"><div class="w-10 h-10 rounded-full bg-white border grid place-items-center mx-auto text-stone-400">💬</div><div class="text-xs text-stone-400 mt-2">Комментариев пока нет<br/>Будь первым</div></div>
          </div>
          <form @submit.prevent="sendComment" class="p-3 border-t border-stone-200 bg-white flex gap-2">
            <InputText v-model="commentText" placeholder="Написать комментарий..." class="flex-1 !rounded-full" :disabled="createCommentAsyncStatus?.value==='loading'" />
            <Button type="submit" icon="pi pi-send" rounded class="!bg-ink-900 !border-ink-900" :loading="createCommentAsyncStatus?.value==='loading'" />
          </form>
        </div>
      </Transition>

      <Dialog v-model:visible="showLiveInfo" modal header="Что это?" :style="{ width: '420px', maxWidth: '92vw' }">
        <div class="space-y-3 text-sm leading-relaxed">
          <div class="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4">
            <span class="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]"></span>
            <span class="font-semibold">Зелёный датчик — живой статус карты</span>
          </div>
          <p class="text-stone-600 dark:text-zinc-400">Мигает, когда карта на связи. Каждые 30 секунд подтягивает новые пины рядом. Цифра рядом — сколько пинов сейчас вокруг тебя.</p>
          <ul class="list-disc pl-5 text-stone-600 dark:text-zinc-400 space-y-1">
            <li>Зелёный пульс = онлайн, данные свежие</li>
            <li>Серый спиннер = идёт загрузка</li>
            <li>Нажми на цифру ещё раз — подсказка закроется</li>
          </ul>
        </div>
      </Dialog>

      <Dialog v-model:visible="showMyPins" modal header="Мои пины" :style="{ width: '520px', maxWidth: '96vw' }">
        <div v-if="myPins.length" class="grid gap-2 max-h-[60vh] overflow-auto pr-1">
          <button v-for="p in myPins" :key="p.id" @click="flyToPin(p)" class="text-left bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4 hover:border-ink-900 dark:hover:border-white hover:shadow-soft transition">
            <div class="text-sm font-bold truncate">{{ p.title }}</div>
            <div class="text-xs text-stone-500 dark:text-zinc-400 line-clamp-2 mt-1">{{ p.body }}</div>
            <div class="flex items-center gap-1.5 mt-2 text-[11px]"><span class="bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-2 py-0.5">{{ p.category }}</span><span class="bg-stone-100 dark:bg-zinc-700 rounded-full px-2 py-0.5">до {{ formatTime(p.expires_at) }}</span><span class="ml-auto text-ink-900 dark:text-white font-semibold">На карте →</span></div>
          </button>
        </div>
        <div v-else class="text-center py-10">
          <div class="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-zinc-800 border mx-auto grid place-items-center">📍</div>
          <div class="text-sm font-semibold mt-3">Пока нет пинов</div>
          <div class="text-xs text-stone-500">Создай первый — он появится здесь</div>
        </div>
      </Dialog>
    </div>
  </AuthenticatedLayout>
</template>

<style scoped>
.fade-enter-active,.fade-leave-active{transition:opacity .22s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
.scrollbar-none::-webkit-scrollbar{display:none}
.scrollbar-none{scrollbar-width:none}
:deep(.maplibregl-ctrl-bottom-right){ bottom: 10px !important; right: 10px !important; display:flex !important; flex-direction:column !important; gap:8px !important; }
:deep(.maplibregl-ctrl-bottom-left){ bottom: 10px !important; left: 10px !important; }
:deep(.maplibregl-ctrl-group){ border-radius:18px !important; overflow:hidden !important; border:1px solid #e7e5e4 !important; box-shadow:0 6px 20px rgba(15,23,42,0.12) !important; background:white !important; }
:deep(.dark .maplibregl-ctrl-group){ background:#27272a !important; border-color:#3f3f46 !important; }
:deep(.dark .maplibregl-ctrl-group button){ filter:invert(1) hue-rotate(180deg); }
:deep(.maplibregl-ctrl-group button){ width:40px !important; height:40px !important; }
</style>
