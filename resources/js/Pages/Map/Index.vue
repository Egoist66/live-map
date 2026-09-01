<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { onMounted, ref, nextTick, watch } from 'vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import { usePins } from '@/composables/usePins'
import { useMap } from '@/composables/useMap'
import { usePinForm } from '@/composables/usePinForm'
import { usePinDetails } from '@/composables/usePinDetails'
import { useGeolocation } from '@/composables/useGeolocation'
import { useTheme } from '@/composables/useTheme'

const { store, categories, selectedCategory, fetchNearby } = usePins()
const { selectedPin, comments, commentText, openPin, closePin, react, sendComment, reportPin, boost } = usePinDetails()
const { newPin, setCoords, submit: submitPin } = usePinForm(() => mapApi.renderPins())
const { requestGeolocation } = useGeolocation()

const mapApi = useMap(openPin)
const { mapContainer, loaded } = mapApi
const { isDark } = useTheme()
watch(isDark, (v) => mapApi.setThemeStyle(v))

const showCreate = ref(false)
const creating = ref(false)

function openCreate(lngLat: any) {
  setCoords(lngLat.lat, lngLat.lng)
  mapApi.addTempMarker(lngLat)
  showCreate.value = true
}
function closeCreate() {
  showCreate.value = false
  mapApi.removeTempMarker()
}
async function flyToMe() {
  try {
    const g = await requestGeolocation()
    mapApi.flyToMyLocation(g.lat, g.lng)
    await fetchNearby(g.lat, g.lng)
    mapApi.renderPins()
  } catch {}
}
async function submit() {
  if (creating.value) return
  creating.value = true
  try {
    await submitPin(true)
    mapApi.removeTempMarker()
    mapApi.renderPins()
    showCreate.value = false
  } catch (e:any) { alert(e?.response?.data?.message || 'Ошибка создания пина') }
  finally { creating.value = false }
}

onMounted(async () => {
  let geo = { lat: 53.9022, lng: 27.5615 }
  try { geo = await requestGeolocation() } catch {}
  try { await fetchNearby(geo.lat, geo.lng) } catch {}
  await nextTick()
  await mapApi.initMap([geo.lng, geo.lat] as any, (e: any) => {
    const target = e.originalEvent?.target as HTMLElement
    if (target?.closest?.('.maplibregl-marker')) return
    openCreate(e.lngLat)
  })
  mapApi.renderPins()
  mapApi.startPolling(30000)
  mapApi.bindRealtime()
})
</script>

<template>
  <Head title="Карта — Live Map" />
  <AuthenticatedLayout>
    <div class="relative w-full h-[calc(100vh-64px)] min-h-[400px] bg-[#eaf0f6] overflow-hidden">
      <div ref="mapContainer" class="absolute inset-0 w-full h-full bg-[#eaf0f6]"></div>

      <div v-if="!loaded" class="absolute inset-0 grid place-items-center bg-[#eef3f8] z-[5]">
        <div class="bg-white border border-stone-200 rounded-2xl px-5 py-4 shadow-soft flex items-center gap-3">
          <span class="w-5 h-5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin"></span>
          <span class="text-sm font-medium">Загружаем карту…</span>
        </div>
      </div>

      <div class="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-auto flex flex-col gap-2.5 z-10 pointer-events-none">
        <div class="pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-2xl sm:rounded-full p-1.5 sm:pl-2 sm:pr-2 shadow-soft flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full">
          <span class="shrink-0 bg-ink-900 text-white rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>{{ store.pins.length }}
          </span>
          <div class="h-5 w-px bg-stone-200 shrink-0 hidden sm:block"></div>
          <div class="flex items-center gap-1 overflow-x-auto scrollbar-none">
            <button @click="selectedCategory='all'" :class="['shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition', selectedCategory==='all'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50']">Все</button>
            <button v-for="c in categories" :key="c.v" @click="selectedCategory=c.v" :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition hidden sm:inline-flex items-center gap-1', selectedCategory===c.v?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50']">{{ c.i }} <span>{{ c.l }}</span></button>
            <button v-for="c in categories.slice(0,4)" :key="'m'+c.v" @click="selectedCategory=c.v" :class="['shrink-0 w-9 h-9 rounded-full text-sm grid place-items-center border sm:hidden', selectedCategory===c.v?'bg-ink-900 text-white border-ink-900':'bg-white border-stone-200']" :title="c.l">{{ c.i }}</button>
          </div>
        </div>
        <div class="hidden sm:flex pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-full px-3.5 py-2 text-xs font-medium shadow-soft items-center gap-2 w-fit">
          <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> кликнуть по карте — создашь пин
          <span class="bg-ink-900 text-white rounded-full px-2 py-0.5 text-[11px] font-bold">2 мин</span>
        </div>
      </div>

      <div class="absolute bottom-4 right-4 sm:bottom-6 sm:right-4 flex flex-col items-center gap-2.5 z-10">
        <button @click="flyToMe" class="w-[44px] h-[44px] rounded-full bg-white border border-stone-200 shadow-card grid place-items-center hover:bg-stone-50 hover:shadow-soft active:scale-95 transition" title="Моя локация">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M17.66 17.66l2.12 2.12M4.93 19.07l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
        </button>
        <button @click="showCreate = true" class="sm:hidden w-14 h-14 rounded-full bg-ink-900 text-white shadow-float grid place-items-center text-xl hover:bg-ink-800 active:scale-95 transition">＋</button>
      </div>

      <div class="absolute bottom-4 left-4 hidden xl:flex z-10 pointer-events-none">
        <div class="bg-white/95 backdrop-blur border border-stone-200 rounded-full px-3.5 py-2 shadow-soft flex items-center gap-2 text-xs font-medium">
          <span class="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 grid place-items-center text-[11px]">◐</span>
          {{ store.pins.length }} пинов · живёт 2–24ч · размытие 200м
        </div>
      </div>

      <Transition name="fade">
        <div v-if="showCreate" class="absolute inset-0 z-30 flex items-end sm:items-center justify-center sm:p-4">
          <div @click="closeCreate" class="absolute inset-0 bg-ink-900/30 backdrop-blur-[2px]"></div>
          <div class="relative w-full sm:max-w-[560px] bg-white sm:rounded-[24px] rounded-t-[24px] shadow-float border border-stone-200 overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col">
            <div class="sm:hidden w-10 h-1 bg-stone-200 rounded-full mx-auto mt-3 shrink-0"></div>
            <div class="px-5 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-stone-100 flex items-start justify-between gap-4 shrink-0">
              <div class="min-w-0">
                <h3 class="text-[18px] font-black tracking-tight leading-none">Новый пин</h3>
                <p class="text-xs text-stone-500 mt-1.5 leading-relaxed">Ткни по карте чтобы выбрать точку — можно переместить повторным кликом</p>
              </div>
              <button @click="closeCreate" class="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 grid place-items-center text-stone-600 shrink-0 transition">✕</button>
            </div>

            <form @submit.prevent="submit" class="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain scrollbar-thin">
              <div class="bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-3 flex items-center gap-2.5 text-xs">
                <span class="w-8 h-8 rounded-full bg-ink-900 text-white grid place-items-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                </span>
                <div class="min-w-0">
                  <div class="font-mono font-semibold text-ink-900">{{ newPin.latitude.toFixed(5) }}, {{ newPin.longitude.toFixed(5) }}</div>
                  <div class="text-stone-400 leading-none mt-0.5">кликни по карте → переместить</div>
                </div>
                <span class="ml-auto hidden sm:inline text-[11px] font-medium bg-white border border-stone-200 rounded-full px-2.5 py-1">точка выбрана</span>
              </div>

              <div>
                <label class="text-[11px] font-bold tracking-wide uppercase text-stone-500">Заголовок *</label>
                <input v-model="newPin.title" placeholder="Напр. Отдам стул, где кофе?" maxlength="100" required class="mt-1.5 input-premium !py-3 text-[14px]" />
                <div class="flex justify-between text-[11px] mt-1.5"><span class="text-stone-400">Коротко и понятно</span><span :class="newPin.title.length>80?'text-amber-600':'text-stone-400'">{{ newPin.title.length }}/100</span></div>
              </div>

              <div>
                <label class="text-[11px] font-bold tracking-wide uppercase text-stone-500">Подробности</label>
                <textarea v-model="newPin.body" placeholder="Адрес, время, контакты, фото позже…" rows="3" maxlength="1000" class="mt-1.5 input-premium resize-none"></textarea>
              </div>

              <div>
                <label class="text-[11px] font-bold tracking-wide uppercase text-stone-500">Категория</label>
                <div class="mt-2 grid grid-cols-3 gap-2 sm:gap-1.5">
                  <button v-for="c in categories" :key="c.v" type="button" @click="newPin.category=c.v" :class="['group relative px-2 py-3 sm:py-2.5 rounded-2xl border text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition', newPin.category===c.v?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50']">
                    <span class="text-[16px] sm:text-sm leading-none">{{ c.i }}</span><span class="leading-none">{{ c.l }}</span>
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[11px] font-bold tracking-wide uppercase text-stone-500">Приватность</label>
                <div class="mt-2 grid grid-cols-3 gap-2">
                  <button type="button" @click="newPin.location_precision='blur_200'" :class="['rounded-full py-3 sm:py-2.5 text-xs font-semibold border transition flex flex-col sm:flex-row items-center justify-center gap-1', newPin.location_precision==='blur_200'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']"><span class="hidden sm:inline">●</span> Размыто <span class="text-[11px] opacity-60">200м</span></button>
                  <button type="button" @click="newPin.location_precision='exact'" :class="['rounded-full py-3 sm:py-2.5 text-xs font-semibold border transition', newPin.location_precision==='exact'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">Точно</button>
                  <button type="button" @click="newPin.location_precision='district'" :class="['rounded-full py-3 sm:py-2.5 text-xs font-semibold border transition', newPin.location_precision==='district'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">Район</button>
                </div>
                <p class="text-[11px] text-stone-400 mt-1.5 text-center">По умолчанию 200м — тебя не видно точкой</p>
              </div>

              <label class="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 cursor-pointer hover:bg-stone-100 transition">
                <input type="checkbox" v-model="newPin.is_anonymous" class="rounded text-ink-900 w-[18px] h-[18px] border-stone-300" />
                <div class="flex-1 min-w-0"><div class="text-sm font-semibold leading-none">Анонимно</div><div class="text-xs text-stone-500 mt-0.5">без имени и репутации</div></div>
                <span class="hidden sm:inline text-xs font-medium bg-white border border-stone-200 rounded-full px-3 py-1.5">🔒 приватно</span>
              </label>

              <div class="sticky bottom-0 bg-white pt-3 -mx-1 px-1 flex gap-2.5 border-t border-stone-100 mt-2">
                <button type="button" @click="closeCreate" class="flex-1 bg-white border border-stone-200 rounded-full py-3.5 font-semibold hover:bg-stone-50 active:scale-[0.98] transition">Отмена</button>
                <button :disabled="creating || !newPin.title.trim()" type="submit" class="flex-[1.4] bg-ink-900 text-white rounded-full py-3.5 font-semibold hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-soft active:scale-[0.98] transition flex items-center justify-center gap-2">
                  <span v-if="creating" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  {{ creating ? 'Создаём…' : 'Создать пин →' }}
                </button>
              </div>
              <p class="text-[11px] text-stone-400 text-center leading-relaxed">Free: 3/день · Pro $4.99 безлимит · Пины живут 2–24ч<br/>Нажимая создать, ты соглашаешься с правилами района</p>
            </form>
          </div>
        </div>
      </Transition>

      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-x-4" enter-to-class="opacity-100 translate-x-0" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0 translate-x-4">
        <div v-if="selectedPin" class="absolute right-3 top-3 bottom-3 sm:right-4 sm:top-4 sm:bottom-4 w-[380px] max-w-[calc(100vw-24px)] bg-white rounded-[20px] shadow-float border border-stone-200 flex flex-col overflow-hidden z-20">
          <div class="p-5 border-b border-stone-200">
            <div class="flex justify-between items-start gap-3"><h3 class="font-bold leading-tight pr-2 text-[15px]">{{ selectedPin.title }}</h3><button @click="closePin()" class="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 grid place-items-center text-stone-600 shrink-0">✕</button></div>
            <p class="text-sm text-stone-600 mt-2 leading-relaxed">{{ selectedPin.body }}</p>
            <div class="flex flex-wrap gap-1.5 mt-3">
              <span class="text-xs bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1 font-medium">{{ selectedPin.category }}</span>
              <span class="text-xs bg-white border border-stone-200 rounded-full px-2.5 py-1">{{ selectedPin.user?.name || 'аноним' }} · {{ selectedPin.user?.level||'novice' }}</span>
              <span class="text-xs bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">до {{ new Date(selectedPin.expires_at).toLocaleTimeString().slice(0,5) }}</span>
            </div>
            <div class="flex gap-1.5 mt-4">
              <button @click="react(selectedPin,'like')" class="flex-1 bg-white border border-stone-200 rounded-full py-2.5 text-xs font-semibold hover:bg-stone-50 active:scale-95 transition">❤️ {{ selectedPin.reactions_count||0 }}</button>
              <button @click="react(selectedPin,'fire')" class="px-4 bg-white border border-stone-200 rounded-full text-xs font-semibold hover:bg-stone-50">🔥</button>
              <button @click="react(selectedPin,'useful')" class="px-4 bg-white border border-stone-200 rounded-full text-xs font-semibold hover:bg-stone-50">👍</button>
              <button @click="reportPin(selectedPin)" class="w-10 h-10 bg-white border border-stone-200 rounded-full grid place-items-center hover:bg-red-50 hover:text-red-600">⚠</button>
            </div>
            <div class="grid grid-cols-3 gap-1.5 mt-2.5">
              <button @click="boost(selectedPin,'top')" class="bg-amber-400 hover:bg-amber-500 rounded-full py-2.5 text-xs font-bold active:scale-95 transition">Топ $0.99</button>
              <button @click="boost(selectedPin,'glow')" class="bg-ink-900 text-white hover:bg-ink-800 rounded-full py-2.5 text-xs font-semibold active:scale-95 transition">Подсветка</button>
              <button @click="boost(selectedPin,'extend')" class="bg-white border border-stone-200 hover:bg-stone-50 rounded-full py-2.5 text-xs font-semibold active:scale-95 transition">+24ч</button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-stone-50/40">
            <div v-for="c in comments" :key="c.id" class="bg-white border border-stone-200 rounded-2xl p-3.5">
              <div class="font-semibold text-xs flex items-center gap-2">{{ c.is_anonymous ? 'аноним' : c.user?.name }} <span class="text-stone-400 font-normal">{{ new Date(c.created_at).toLocaleTimeString() }}</span></div>
              <div class="text-sm text-stone-700 mt-1.5 leading-relaxed">{{ c.content }}</div>
            </div>
            <div v-if="!comments.length" class="text-center py-10"><div class="w-10 h-10 rounded-full bg-white border grid place-items-center mx-auto text-stone-400">💬</div><div class="text-xs text-stone-400 mt-2">Комментариев пока нет<br/>Будь первым</div></div>
          </div>
          <form @submit.prevent="sendComment" class="p-3 border-t border-stone-200 bg-white flex gap-2">
            <input v-model="commentText" placeholder="Написать комментарий..." class="flex-1 bg-stone-50 border border-stone-200 rounded-full px-4 py-3 text-sm focus:outline-none focus:border-ink-900 focus:bg-white transition"/>
            <button class="w-11 h-11 rounded-full bg-ink-900 text-white grid place-items-center hover:bg-ink-800 active:scale-95 transition shrink-0">↗</button>
          </form>
        </div>
      </Transition>
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
:deep(.maplibregl-ctrl-group button){ width:40px !important; height:40px !important; }
:deep(.maplibregl-ctrl-group button + button){ border-top:1px solid #f1f0ed !important; }
:deep(.maplibregl-ctrl-attrib){ border-radius:999px !important; font-size:10px !important; }
</style>
