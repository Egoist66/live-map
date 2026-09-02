<script setup lang="ts">
import { Head, usePage } from '@inertiajs/vue3'
import { onMounted, onUnmounted, ref, nextTick, watch, computed } from 'vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import { usePins } from '@/composables/usePins'
import { useMap } from '@/composables/useMap'
import { usePinForm } from '@/composables/usePinForm'
import { usePinDetails } from '@/composables/usePinDetails'
import { useGeolocation } from '@/composables/useGeolocation'
import { useTheme } from '@/composables/useTheme'

const { store, categories, selectedCategory, fetchNearby } = usePins()
const { selectedPin, comments, commentText, openPin, closePin, react, sendComment, reportPin, boost, editingCommentId, editingContent, startEditComment, cancelEditComment, saveEditComment } = usePinDetails()
const { newPin, setCoords, submit: submitPin } = usePinForm(() => mapApi.renderPins())
const { requestGeolocation } = useGeolocation()

const showCreate = ref(false)
const creating = ref(false)
const myStreet = ref('')
const loadingStreet = ref(false)
const showCoords = ref(false)
const pinAddress = ref('')
const loadingPinAddress = ref(false)
const editing = ref(false)
const editForm = ref({ title:'', body:'', category:'announcement' })
function startEdit(){ if(!selectedPin.value) return; editing.value=true; editForm.value={ title:selectedPin.value.title, body:selectedPin.value.body||'', category:selectedPin.value.category } }
function cancelEdit(){ editing.value=false }
async function saveEdit(){
  if(!selectedPin.value) return
  if(!editForm.value.title.trim()) return alert('Заголовок обязателен')
  try{ const data:any = await store.updatePin(selectedPin.value.id, { title: editForm.value.title.trim(), body: editForm.value.body, category: editForm.value.category }); Object.assign(selectedPin.value, data); editing.value=false; mapApi.renderPins() } catch(e:any){ alert(e?.response?.data?.message || 'Ошибка сохранения') }
}
const mapApi = useMap(openPin, (p:any)=>{ openPin(p); nextTick(()=> startEdit()) })
const { mapContainer, loaded } = mapApi
const { isDark } = useTheme()
watch(isDark, (v) => mapApi.setThemeStyle(v))

const page: any = usePage()
const userPlan = computed(() => page.props.auth?.user?.plan || 'free')
const radiusOptions = computed(() => {
  const isPro = userPlan.value === 'pro' || userPlan.value === 'business'
  return [
    { v: 500, l: '500 м' },
    { v: 1000, l: '1 км' },
    { v: 2000, l: '2 км', pro: true },
    { v: 5000, l: '5 км', pro: true },
  ].map(o => ({ ...o, disabled: (o as any).pro && !isPro }))
})
const radiusLabel = computed(() => {
  const v = newPin.value.radius_meters
  return v >= 1000 ? `${v/1000} км` : `${v} м`
})

function formatAddr(d: any): string {
  const a = d.address || {}
  const road = a.road || a.pedestrian || a.footway || a.street || a.path || a.cycleway || ''
  const house = a.house_number ? `, ${a.house_number}` : ''
  const city = a.city || a.town || a.village || a.municipality || a.county || ''
  const suburb = a.suburb || a.neighbourhood || a.quarter || ''
  if (road) return `${road}${house}${city ? ` · ${city}` : ''}`
  if (suburb && city) return `${suburb} · ${city}`
  return d.display_name?.split(',').slice(0, 3).join(', ') || 'Адрес не определён'
}

async function reverseGeocode(lat: number, lng: number) {
  loadingStreet.value = true
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=ru`, { headers: { Accept: 'application/json' } })
    const d: any = await r.json()
    myStreet.value = formatAddr(d)
  } catch { myStreet.value = '' }
  finally { loadingStreet.value = false }
}

async function fetchPinAddress(lat: number, lng: number) {
  loadingPinAddress.value = true
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=ru`, { headers: { Accept: 'application/json' } })
    const d: any = await r.json()
    pinAddress.value = formatAddr(d)
  } catch { pinAddress.value = '' }
  finally { loadingPinAddress.value = false }
}

function openCreate(lngLat: any) {
  setCoords(lngLat.lat, lngLat.lng)
  fetchPinAddress(lngLat.lat, lngLat.lng)
  mapApi.addTempMarker(lngLat)
  showCreate.value = true
}
function closeCreate() {
  showCreate.value = false
  mapApi.removeTempMarker()
}
watch(showCreate, (v) => { if (v && !pinAddress.value) fetchPinAddress(newPin.value.latitude, newPin.value.longitude) })
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
async function deleteSelectedPin() {
  if (!selectedPin.value) return
  if (!confirm(`Удалить пин "${selectedPin.value.title}"?`)) return
  try { await store.deletePin(selectedPin.value.id); closePin(); mapApi.renderPins() } catch(e:any){ alert(e?.response?.data?.message || 'Ошибка удаления') }
}
watch(selectedPin, ()=> { editing.value=false })

function onEsc(e: KeyboardEvent){
  if(e.key !== 'Escape') return
  if(showCreate.value){ closeCreate(); return }
  if(editing.value){ cancelEdit(); return }
  if(editingCommentId.value){ cancelEditComment(); return }
  if(selectedPin.value){ closePin(); return }
}
onMounted(async () => {
  window.addEventListener('keydown', onEsc)
  let geo = { lat: 53.9022, lng: 27.5615 }
  let gotGeo = false
  try { geo = await requestGeolocation(); gotGeo = true } catch {}
  if (gotGeo) reverseGeocode(geo.lat, geo.lng)
  try { await fetchNearby(geo.lat, geo.lng) } catch {}
  try { const mine:any[] = await store.fetchMine(); mine.forEach((p:any)=> { if(!store.pins.find((x:any)=>x.id===p.id)) store.pins.unshift(p) }) } catch {}
  await nextTick()
  await mapApi.initMap([geo.lng, geo.lat] as any, (e: any) => {
    const target = e.originalEvent?.target as HTMLElement
    if (target?.closest?.('.maplibregl-marker')) return
    openCreate(e.lngLat)
  })
  if (gotGeo) mapApi.showUserLocation(geo.lat, geo.lng)
  else try { mapApi.map?.setZoom(7) } catch {}
  setTimeout(() => mapApi.triggerGeolocate(), 800)
  mapApi.renderPins()
  mapApi.startPolling(30000)
  mapApi.bindRealtime()
  try { (mapApi.map as any)?.on('geolocate', (e: any) => { const c = e.coords; if (c) { reverseGeocode(c.latitude, c.longitude); mapApi.showUserLocation(c.latitude, c.longitude) } }) } catch {}
})
onUnmounted(()=> window.removeEventListener('keydown', onEsc))
</script>

<template>
  <Head title="Карта" />
  <AuthenticatedLayout>
    <div class="relative w-full h-[calc(100dvh-64px)] min-h-[400px] bg-[#eaf0f6] overflow-hidden">
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
            <button @click="selectedCategory='mine'" :class="['shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition inline-flex items-center gap-1', selectedCategory==='mine'?'bg-amber-400 text-stone-900 border-amber-400 shadow-soft':'bg-white border-amber-200 hover:bg-amber-50']">📍 Мои</button>
            <button v-for="c in categories" :key="c.v" @click="selectedCategory=c.v" :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition hidden sm:inline-flex items-center gap-1', selectedCategory===c.v?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50']">{{ c.i }} <span>{{ c.l }}</span></button>
            <button v-for="c in categories.slice(0,4)" :key="'m'+c.v" @click="selectedCategory=c.v" :class="['shrink-0 w-9 h-9 rounded-full text-sm grid place-items-center border sm:hidden', selectedCategory===c.v?'bg-ink-900 text-white border-ink-900':'bg-white border-stone-200']" :title="c.l">{{ c.i }}</button>
          </div>
        </div>
        <Transition name="fade">
          <div v-if="myStreet || loadingStreet" class="pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-full pl-1 pr-3 py-1 shadow-soft flex items-center gap-2 w-fit max-w-[min(92vw,380px)]">
            <span class="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div class="min-w-0 leading-none">
              <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400">вы здесь</div>
              <div class="text-xs font-semibold text-ink-900 truncate">{{ loadingStreet ? 'Определяем улицу…' : myStreet }}</div>
            </div>
            <span v-if="loadingStreet" class="w-3.5 h-3.5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin shrink-0"></span>
            <span v-else class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
          </div>
        </Transition>
        <div class="hidden sm:flex pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-full px-3.5 py-2 text-xs font-medium shadow-soft items-center gap-2 w-fit">
          <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> кликнуть по карте — создашь пин
          <span class="bg-ink-900 text-white rounded-full px-2 py-0.5 text-[11px] font-bold">2 мин</span>
        </div>
      </div>

      <div class="absolute bottom-4 right-4 sm:bottom-6 sm:right-4 flex flex-col items-center gap-2.5 z-10 pointer-events-none">
        <button @click="showCreate = true" class="pointer-events-auto sm:hidden w-14 h-14 rounded-full bg-ink-900 text-white shadow-float grid place-items-center text-xl hover:bg-ink-800 active:scale-95 transition">＋</button>
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
          <div class="relative w-full sm:max-w-[520px] bg-white sm:rounded-[24px] rounded-t-[20px] shadow-float border border-stone-200 overflow-hidden max-h-[88vh] sm:max-h-[84vh] flex flex-col">
            <div class="sm:hidden w-10 h-1 bg-stone-200 rounded-full mx-auto mt-2.5 shrink-0"></div>
            <div class="px-4 sm:px-5 pt-3.5 sm:pt-4 pb-3 border-b border-stone-100 flex items-start justify-between gap-3 shrink-0">
              <div class="min-w-0">
                <h3 class="text-[16px] font-black tracking-tight leading-none">Новый пин</h3>
                <p class="text-[11px] text-stone-500 mt-1 leading-relaxed">Клик по карте — переместить точку</p>
              </div>
              <button @click="closeCreate" class="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 grid place-items-center text-stone-600 shrink-0 transition text-sm">✕</button>
            </div>

            <form @submit.prevent="submit" class="p-4 sm:p-5 space-y-3 overflow-y-auto overscroll-contain scrollbar-thin">
              <div class="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                <span class="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-[12px] font-semibold text-ink-900 leading-tight truncate">
                    <span v-if="loadingPinAddress" class="text-stone-400">Определяем адрес…</span>
                    <span v-else-if="showCoords" class="font-mono">{{ newPin.latitude.toFixed(5) }}, {{ newPin.longitude.toFixed(5) }}</span>
                    <span v-else>{{ pinAddress || 'Адрес не определён' }}</span>
                  </div>
                  <div class="text-[10px] text-stone-400 leading-none mt-0.5 truncate">
                    <span v-if="showCoords">{{ pinAddress || 'кликни → переместить' }}</span>
                    <span v-else>кликни → переместить</span>
                  </div>
                </div>
                <span v-if="loadingPinAddress" class="w-3.5 h-3.5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin shrink-0"></span>
                <span v-else-if="!showCoords" class="hidden sm:inline text-[10px] font-medium bg-white border border-stone-200 rounded-full px-2 py-0.5 shrink-0">✓</span>
              </div>
              <label class="flex items-center justify-between bg-white border border-stone-200 rounded-full px-3 py-2 cursor-pointer hover:bg-stone-50 transition">
                <span class="text-[11px] font-semibold flex items-center gap-1.5"><span class="w-5 h-5 rounded-full bg-stone-100 border border-stone-200 grid place-items-center text-[10px]">◈</span> Показать координаты</span>
                <span class="relative inline-flex items-center">
                  <input type="checkbox" v-model="showCoords" class="sr-only" />
                  <span :class="['w-8 h-5 rounded-full p-0.5 flex items-center transition', showCoords ? 'bg-ink-900' : 'bg-stone-300']">
                    <span :class="['w-4 h-4 bg-white rounded-full shadow transition', showCoords ? 'translate-x-3' : 'translate-x-0']"></span>
                  </span>
                </span>
              </label>

              <div>
                <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Заголовок *</label>
                <input v-model="newPin.title" placeholder="Напр. Отдам стул, где кофе?" maxlength="100" required class="mt-1 input-premium !py-2.5 text-[13px]" />
                <div class="flex justify-between text-[10px] mt-1"><span class="text-stone-400">Коротко</span><span :class="newPin.title.length>80?'text-amber-600':'text-stone-400'">{{ newPin.title.length }}/100</span></div>
              </div>

              <div>
                <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Подробности</label>
                <textarea v-model="newPin.body" placeholder="Адрес, время, контакты…" rows="2" maxlength="1000" class="mt-1 input-premium resize-none !py-2.5 text-[13px]"></textarea>
              </div>

              <div>
                <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Категория</label>
                <div class="mt-1.5 grid grid-cols-3 gap-1.5">
                  <button v-for="c in categories" :key="c.v" type="button" @click="newPin.category=c.v" :class="['group relative px-2 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition', newPin.category===c.v?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">
                    <span class="text-sm leading-none">{{ c.i }}</span><span class="leading-none text-[11px]">{{ c.l }}</span>
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Приватность</label>
                <div class="mt-1.5 grid grid-cols-3 gap-1.5">
                  <button type="button" @click="newPin.location_precision='blur_200'" :class="['rounded-full py-2 text-xs font-semibold border transition flex items-center justify-center gap-1', newPin.location_precision==='blur_200'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">Размыто <span class="text-[11px] opacity-60">200м</span></button>
                  <button type="button" @click="newPin.location_precision='exact'" :class="['rounded-full py-2 text-xs font-semibold border transition', newPin.location_precision==='exact'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">Точно</button>
                  <button type="button" @click="newPin.location_precision='district'" :class="['rounded-full py-2 text-xs font-semibold border transition', newPin.location_precision==='district'?'bg-ink-900 text-white border-ink-900 shadow-soft':'bg-white border-stone-200 hover:bg-stone-50']">Район</button>
                </div>
                <p class="text-[10px] text-stone-400 mt-1 text-center">200м по умолчанию</p>
              </div>

              <div class="bg-white border border-stone-200 rounded-xl p-2.5">
                <div class="flex items-center justify-between">
                  <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Радиус</label>
                  <span class="text-[11px] font-bold bg-ink-900 text-white rounded-full px-2 py-0.5">{{ radiusLabel }}</span>
                </div>
                <div class="mt-1.5 grid grid-cols-4 gap-1">
                  <button v-for="o in radiusOptions" :key="o.v" type="button" :disabled="o.disabled" @click="newPin.radius_meters=o.v" :class="['rounded-full py-2 text-xs font-semibold border transition', o.disabled ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed' : newPin.radius_meters===o.v ? 'bg-ink-900 text-white border-ink-900 shadow-soft' : 'bg-white border-stone-200 hover:bg-stone-50']">
                    {{ o.l }}
                  </button>
                </div>
              </div>

              <label class="flex items-center gap-2.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-stone-100 transition">
                <input type="checkbox" v-model="newPin.is_anonymous" class="rounded text-ink-900 w-[16px] h-[16px] border-stone-300" />
                <div class="flex-1 min-w-0"><div class="text-xs font-semibold leading-none">Анонимно</div><div class="text-[11px] text-stone-500 mt-0.5">без репутации</div></div>
                <span class="hidden sm:inline text-[11px] font-medium bg-white border border-stone-200 rounded-full px-2 py-0.5">🔒</span>
              </label>

              <div class="sticky bottom-0 bg-white pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] -mx-1 px-1 flex gap-2 border-t border-stone-100 mt-1.5">
                <button type="button" @click="closeCreate" class="flex-1 bg-white border border-stone-200 rounded-full py-2.5 font-semibold hover:bg-stone-50 active:scale-[0.98] transition min-h-[42px] text-sm">Отмена</button>
                <button :disabled="creating || !newPin.title.trim()" type="submit" class="flex-[1.4] bg-ink-900 text-white rounded-full py-2.5 font-semibold hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-soft active:scale-[0.98] transition flex items-center justify-center gap-2 min-h-[42px] text-sm">
                  <span v-if="creating" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  {{ creating ? 'Создаём…' : 'Создать пин →' }}
                </button>
              </div>
              <p class="text-[10px] text-stone-400 text-center leading-relaxed">Free: 3/день · Pro $4.99 · 2–24ч · правила района</p>
            </form>
          </div>
        </div>
      </Transition>

      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-y-4 sm:translate-x-4 sm:translate-y-0" enter-to-class="opacity-100 translate-y-0 sm:translate-x-0" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0 translate-y-4 sm:translate-x-4">
        <div v-if="selectedPin" class="absolute inset-x-3 bottom-3 top-auto max-h-[78vh] sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[380px] sm:max-h-none bg-white rounded-[20px] shadow-float border border-stone-200 flex flex-col overflow-hidden z-20">
          <div class="p-5 border-b border-stone-200">
            <div v-if="!editing" class="flex justify-between items-start gap-3"><h3 class="font-bold leading-tight pr-2 text-[15px]">{{ selectedPin.title }}</h3><div class="flex items-center gap-1 shrink-0"><button v-if="selectedPin.is_owner" @click="startEdit" class="w-8 h-8 rounded-full bg-white border border-stone-200 hover:bg-stone-50 grid place-items-center" title="Редактировать">✎</button><button v-if="selectedPin.is_owner" @click="deleteSelectedPin" class="w-8 h-8 rounded-full bg-white border border-stone-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center" title="Удалить пин">🗑</button><button @click="closePin()" class="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 grid place-items-center text-stone-600">✕</button></div></div>
            <div v-else class="space-y-3">
              <input v-model="editForm.title" maxlength="100" placeholder="Заголовок" class="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-ink-900" />
              <textarea v-model="editForm.body" rows="3" maxlength="1000" placeholder="Подробности" class="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-ink-900 resize-none"></textarea>
              <div class="flex gap-1.5 flex-wrap">
                <button v-for="c in categories" :key="c.v" @click="editForm.category=c.v" :class="['px-3 py-1.5 rounded-full text-xs font-semibold border', editForm.category===c.v?'bg-ink-900 text-white border-ink-900':'bg-white border-stone-200']">{{ c.i }} {{ c.l }}</button>
              </div>
              <div class="flex gap-2">
                <button @click="saveEdit" class="flex-1 bg-ink-900 text-white rounded-full py-2.5 text-sm font-semibold hover:bg-ink-800">Сохранить</button>
                <button @click="cancelEdit" class="flex-1 bg-white border border-stone-200 rounded-full py-2.5 text-sm font-semibold hover:bg-stone-50">Отмена</button>
              </div>
            </div>
            <p v-if="!editing" class="text-sm text-stone-600 mt-2 leading-relaxed">{{ selectedPin.body }}</p>
            <div v-if="!editing" class="flex flex-wrap gap-1.5 mt-3 items-center">
              <span class="text-xs bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1 font-medium">{{ selectedPin.category }}</span>
              <span class="text-xs bg-white border border-stone-200 rounded-full pl-1 pr-2.5 py-1 flex items-center gap-1.5">
                <img v-if="selectedPin.user?.avatar_path" :src="`/storage/${selectedPin.user.avatar_path}`" class="w-5 h-5 rounded-full object-cover border border-stone-200" />
                <span v-else-if="selectedPin.user?.name" class="w-5 h-5 rounded-full bg-ink-900 text-white grid place-items-center text-[10px] font-bold">{{ selectedPin.user.name[0].toUpperCase() }}</span>
                <span v-else class="w-5 h-5 rounded-full bg-stone-200 border border-stone-300 grid place-items-center text-[10px]">?</span>
                {{ selectedPin.user?.name || 'аноним' }} · {{ selectedPin.user?.level||'novice' }}
              </span>
              <span class="text-xs bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">до {{ new Date(selectedPin.expires_at).toLocaleTimeString().slice(0,5) }}</span>
            </div>
            <div class="flex gap-1.5 mt-4">
              <button @click="react(selectedPin,'like')" :class="['flex-1 rounded-full py-2.5 text-xs font-semibold border active:scale-95 transition flex items-center justify-center gap-1', selectedPin.my_reaction==='like'?'bg-rose-500 text-white border-rose-500 shadow-[0_2px_10px_rgba(244,63,94,0.35)]':'bg-white border-stone-200 hover:bg-stone-50']">❤️ {{ selectedPin.reactions_count||0 }}<span v-if="selectedPin.my_reaction==='like'" class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span></button>
              <button @click="react(selectedPin,'fire')" :class="['px-4 rounded-full text-xs font-semibold border active:scale-95 transition', selectedPin.my_reaction==='fire'?'bg-orange-500 text-white border-orange-500 shadow-[0_2px_10px_rgba(249,115,22,0.35)]':'bg-white border-stone-200 hover:bg-stone-50']">🔥</button>
              <button @click="react(selectedPin,'useful')" :class="['px-4 rounded-full text-xs font-semibold border active:scale-95 transition', selectedPin.my_reaction==='useful'?'bg-emerald-500 text-white border-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.35)]':'bg-white border-stone-200 hover:bg-stone-50']">👍</button>
              <button @click="reportPin(selectedPin)" class="w-10 h-10 bg-white border border-stone-200 rounded-full grid place-items-center hover:bg-red-50 hover:text-red-600">⚠</button>
            </div>
            <div v-if="selectedPin.my_reaction" class="mt-2 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5">✓ Выбрано: {{ ({like:'❤️ Лайк', fire:'🔥 Огонь', useful:'👍 Полезно', laugh:'😂 Смешно', sad:'😢 Грустно', angry:'😡 Злость'} as any)[selectedPin.my_reaction] || selectedPin.my_reaction }}</div>
            <div class="grid grid-cols-3 gap-2 mt-4">
              <button @click="boost(selectedPin,'top')" class="group relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all">
                <span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
                <span class="text-[15px] leading-none">👑</span>
                <span class="text-xs font-black leading-none">Топ $0.99</span>
                <span class="text-[11px] font-bold leading-none opacity-80">поднять 1ч</span>
              </button>
              <button @click="boost(selectedPin,'glow')" class="group relative overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all">
                <span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
                <span class="text-[15px] leading-none">✨</span>
                <span class="text-xs font-black leading-none">Подсветка $1.99</span>
                <span class="text-[11px] font-semibold leading-none opacity-80">анимация</span>
              </button>
              <button @click="boost(selectedPin,'extend')" class="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all">
                <span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
                <span class="text-[15px] leading-none">⏳</span>
                <span class="text-xs font-black leading-none">+24ч $2.99</span>
                <span class="text-[11px] font-semibold leading-none opacity-80">продлить</span>
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-stone-50/40">
            <div v-for="c in comments" :key="c.id" class="bg-white border border-stone-200 rounded-2xl p-3.5">
              <div class="font-semibold text-xs flex items-center gap-2">
                {{ c.is_anonymous ? 'аноним' : c.user?.name }}
                <span class="text-stone-400 font-normal">{{ new Date(c.created_at).toLocaleTimeString() }}</span>
                <span v-if="c.user_id===page.props.auth.user.id || page.props.auth.user.is_admin || page.props.auth.user.role==='admin'" class="ml-auto flex gap-1">
                  <template v-if="editingCommentId!==c.id"><button @click="startEditComment(c)" class="text-[11px] px-2 py-0.5 rounded-full border hover:bg-stone-50">✎ ред.</button></template>
                  <template v-else>
                    <button @click="saveEditComment" class="text-[11px] px-2.5 py-1 rounded-full bg-ink-900 text-white font-semibold">✓ Сохранить</button>
                    <button @click="cancelEditComment" class="text-[11px] px-2.5 py-1 rounded-full border hover:bg-stone-50">✕</button>
                  </template>
                </span>
              </div>
              <div v-if="editingCommentId===c.id" class="mt-2"><textarea v-model="editingContent" rows="2" maxlength="1000" class="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-ink-900"></textarea><div class="text-[11px] text-stone-400 mt-1 text-right">{{ editingContent.length }}/1000 · 3/день на пин</div></div>
              <div v-else class="text-sm text-stone-700 mt-1.5 leading-relaxed break-words">{{ c.content }}</div>
            </div>
            <div v-if="!comments.length" class="text-center py-10"><div class="w-10 h-10 rounded-full bg-white border grid place-items-center mx-auto text-stone-400">💬</div><div class="text-xs text-stone-400 mt-2">Комментариев пока нет<br/>Будь первым</div></div>
          </div>
          <form @submit.prevent="sendComment" class="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-stone-200 bg-white flex gap-2">
            <input v-model="commentText" placeholder="Написать комментарий..." class="flex-1 min-w-0 bg-stone-50 border border-stone-200 rounded-full px-4 py-3 text-[16px] sm:text-sm focus:outline-none focus:border-ink-900 focus:bg-white transition"/>
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
@media (max-width: 640px){
  :deep(.maplibregl-ctrl-bottom-right){ bottom: 84px !important; right: 8px !important; }
  :deep(.maplibregl-ctrl-bottom-left){ bottom: 14px !important; left: 8px !important; }
  :deep(.maplibregl-ctrl-group button){ width:44px !important; height:44px !important; }
}
</style>
