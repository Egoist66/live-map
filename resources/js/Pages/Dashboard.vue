<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { onMounted, ref, computed } from 'vue'
import axios from 'axios'
import { useGeolocation } from '@/composables/useGeolocation'

const page = usePage()
const user = (page.props.auth as any).user
const pins = ref<any[]>([])
const zoneCount = ref(0)
const { coords, requestGeolocation } = useGeolocation([user.longitude ? Number(user.longitude) : 37.6173, user.latitude ? Number(user.latitude) : 55.7558] as any)
const zoneForm = ref({ radius_km: user.home_radius_km || 2, notify_via: 'in_app' })
const showZoneForm = ref(false)
const myPins = computed(() => pins.value.filter((p:any) => p.is_owner || p.user?.id === user.id))
const otherPins = computed(() => pins.value.filter((p:any) => !(p.is_owner || p.user?.id === user.id)))

async function deletePin(id: number) {
  if (!confirm('Удалить пин?')) return
  try { await axios.delete(`/api/pins/${id}`); pins.value = pins.value.filter(p => p.id !== id) } catch(e:any){ alert(e?.response?.data?.message||'Ошибка удаления') }
}
async function boostFromDashboard(type: 'top'|'glow'|'extend') {
  const target = myPins.value[0] || otherPins.value[0] || pins.value[0]
  if (!target) { alert('Создай пин на карте чтобы попробовать буст'); return }
  if (type==='top' && !confirm(`Поднять пин "${target.title}" в ТОП на 1ч за $0.99?`)) return
  if (type==='glow' && !confirm(`Подсветить пин "${target.title}" анимацией за $1.99?`)) return
  if (type==='extend' && !confirm(`Продлить пин "${target.title}" на 24ч за $2.99?`)) return
  try { await axios.post(`/api/pins/${target.id}/boost`, { type }); alert('Буст активирован: '+type+' — пин "'+target.title+'"') } catch(e:any){ alert(e?.response?.data?.message||'Ошибка буста') }
}

onMounted(async () => {
  const loc = user.home_lat && user.home_lng ? { lat: Number(user.home_lat), lng: Number(user.home_lng) } : await requestGeolocation().catch(() => ({ lat: 53.9022, lng: 27.5615 }))
  try {
    const [nearRes, mineRes] = await Promise.allSettled([
      axios.get('/api/pins', { params: { lat: loc.lat, lng: loc.lng, radius: 5000 } }),
      axios.get('/api/pins/mine'),
    ])
    const near = nearRes.status==='fulfilled' ? (Array.isArray(nearRes.value.data) ? nearRes.value.data : nearRes.value.data.data || []) : []
    const mine = mineRes.status==='fulfilled' ? (Array.isArray(mineRes.value.data) ? mineRes.value.data : mineRes.value.data.data || []) : []
    const map = new Map()
    ;[...mine, ...near].forEach((p:any)=> { if(!map.has(p.id)) map.set(p.id,p) })
    pins.value = Array.from(map.values()).slice(0,12)
    if (!pins.value.length && mine.length) pins.value = mine.slice(0,12)
  } catch {}
  try {
    const { data } = await axios.get('/api/zone-subscriptions')
    zoneCount.value = Array.isArray(data) ? data.length : 0
  } catch (e: any) {
    if (e?.response?.status !== 401) console.error(e)
  }
})

async function createZone() {
  await axios.post('/api/zone-subscriptions', { lat: coords.value.lat, lng: coords.value.lng, radius_km: zoneForm.value.radius_km, notify_via: zoneForm.value.notify_via })
  zoneCount.value++
  showZoneForm.value = false
}

const levelLabel: Record<string,string> = { novice:'Новичок', local:'Местный', guide:'Гид района' }
const levelColor: Record<string,string> = { novice:'bg-stone-100 text-stone-700 border-stone-200', local:'bg-emerald-50 text-emerald-700 border-emerald-200', guide:'bg-amber-50 text-amber-700 border-amber-200' }
</script>

<template>
  <Head title="Дашборд" />
  <AuthenticatedLayout>
    <div class="bg-surface min-h-[calc(100vh-64px)]">
      <div class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div class="bg-ink-900 text-white rounded-[24px] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"></div>
          <div class="absolute -right-10 bottom-0 w-64 h-64 bg-white rounded-full blur-[80px] opacity-[0.05]"></div>
          <div class="relative">
            <div class="flex items-center gap-2 text-xs font-medium text-white/60">
              Привет, {{ user.name }}
              <span :class="['px-2.5 py-1 rounded-full text-xs font-bold border', levelColor[user.level||'novice']]">{{ levelLabel[user.level||'novice'] }}</span>
              <span class="bg-white/10 border border-white/15 rounded-full px-2.5 py-1 text-white">{{ user.reputation_score||0 }} ★</span>
            </div>
            <h1 class="text-[24px] font-black tracking-tight mt-2">Твой район живой?</h1>
            <p class="text-white/60 text-sm mt-1.5 max-w-xl leading-relaxed">Пины живут 2ч (free) / 24ч (pro). Проверь карту — не пропусти помощь и события рядом.</p>
          </div>
          <Link href="/map" class="relative bg-white text-ink-900 px-7 py-3 rounded-full font-bold hover:bg-stone-50 shadow-soft transition inline-flex items-center gap-2">Открыть карту <span>→</span></Link>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group">
            <div class="w-8 h-8 rounded-xl bg-ink-900 text-white grid place-items-center text-xs card-icon">◉</div>
            <div class="text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide">План</div><div class="font-black text-lg capitalize tracking-tight">{{ user.plan||'free' }}</div><div class="text-xs text-stone-500 dark:text-zinc-500">{{ user.plan==='free' ? '3 пина/день · 1 км' : 'Безлимит · 5 км' }}</div>
          </div>
          <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group">
            <div class="w-8 h-8 rounded-xl bg-brand-500 text-white grid place-items-center text-xs card-icon">✦</div>
            <div class="text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide">Пинов сегодня</div><div class="font-black text-lg tracking-tight">{{ user.pins_today_count||0 }}/{{ user.plan==='free' ? 3 : '∞' }}</div><div class="text-xs text-stone-500 dark:text-zinc-500">сброс в 00:00</div>
          </div>
          <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group">
            <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white grid place-items-center text-xs card-icon">◐</div>
            <div class="text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide">Подписки</div><div class="font-black text-lg tracking-tight">{{ zoneCount }}</div><div class="text-xs text-stone-500 dark:text-zinc-500">уведомления о пинах</div>
          </div>
          <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group">
            <div class="w-8 h-8 rounded-xl bg-amber-400 text-ink-900 grid place-items-center text-xs card-icon">◎</div>
            <div class="text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide">Радиус</div><div class="font-black text-lg tracking-tight">{{ (user.home_radius_km||2) }} км</div><div class="text-xs text-stone-500 dark:text-zinc-500">{{ user.home_lat ? 'дом задан' : 'не задан' }}</div>
          </div>
        </div>

        <div class="grid lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2 bg-white border border-stone-200 rounded-[20px] p-6 shadow-soft">
            <div class="flex items-center justify-between"><h3 class="font-black tracking-tight">Быстрые действия</h3><Link href="/map" class="text-xs font-semibold text-stone-500 hover:text-ink-900 bg-stone-100 rounded-full px-3 py-1">На карту →</Link></div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <Link href="/map" class="bg-ink-900 text-white rounded-[16px] p-4 flex flex-col gap-2 hover:bg-ink-800 transition shadow-soft"><span class="w-8 h-8 rounded-xl bg-white/15 grid place-items-center">＋</span><span class="text-sm font-bold leading-tight">Создать пин</span><span class="text-[11px] text-white/60">в 2 клика</span></Link>
              <Link href="/map" class="bg-stone-50 border border-stone-200 rounded-[16px] p-4 flex flex-col gap-2 hover:bg-white hover:shadow-soft transition"><span class="w-8 h-8 rounded-xl bg-white border grid place-items-center text-sm">🗺️</span><span class="text-sm font-bold leading-tight">Карта</span><span class="text-[11px] text-stone-500">30с polling</span></Link>
              <button @click="showZoneForm=!showZoneForm" class="bg-stone-50 border border-stone-200 rounded-[16px] p-4 flex flex-col gap-2 text-left hover:bg-white hover:shadow-soft transition"><span class="w-8 h-8 rounded-xl bg-white border grid place-items-center text-sm">🔔</span><span class="text-sm font-bold leading-tight">Зона</span><span class="text-[11px] text-stone-500">подписаться</span></button>
              <Link href="/profile" class="bg-gradient-to-br from-amber-400 to-amber-500 rounded-[16px] p-4 flex flex-col gap-2 hover:from-amber-300 transition"><span class="w-8 h-8 rounded-xl bg-white/90 grid place-items-center text-sm">★</span><span class="text-sm font-bold leading-tight">Pro $4.99</span><span class="text-[11px] text-ink-900/60">безлимит</span></Link>
            </div>
            <div v-if="showZoneForm" class="mt-4 border border-stone-200 rounded-2xl p-4 bg-stone-50 flex flex-wrap gap-3 items-end">
              <div><div class="text-xs font-medium">Радиус км</div><input v-model.number="zoneForm.radius_km" type="number" min="1" max="10" class="mt-1 border border-stone-200 rounded-xl px-3 py-2 w-24 text-sm bg-white focus:border-ink-900 outline-none"/></div>
              <div><div class="text-xs font-medium">Уведомления</div><select v-model="zoneForm.notify_via" class="mt-1 border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white"><option value="in_app">в приложении</option><option value="push">пуш</option><option value="email">email</option></select></div>
              <div class="text-[11px] text-stone-500 bg-white border rounded-full px-3 py-2">{{ coords.lat.toFixed(4) }}, {{ coords.lng.toFixed(4) }}</div>
              <button @click="createZone" class="bg-ink-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold ml-auto hover:bg-ink-800">Подписаться</button>
            </div>
            <div class="mt-5 grid grid-cols-3 gap-2">
              <button @click="boostFromDashboard('top')" class="group relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all text-center">
                <span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
                <span class="text-lg">👑</span><span class="text-[15px] font-black">Топ $0.99</span><span class="text-sm font-semibold opacity-80">поднять 1ч</span>
              </button>
              <button @click="boostFromDashboard('glow')" class="group relative overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all text-center">
                <span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
                <span class="text-lg">✨</span><span class="text-[15px] font-black">Подсветка $1.99</span><span class="text-sm font-semibold opacity-80">анимация</span>
              </button>
              <button @click="boostFromDashboard('extend')" class="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all text-center">
                <span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
                <span class="text-lg">⏳</span><span class="text-[15px] font-black">+24ч $2.99</span><span class="text-sm font-semibold opacity-80">продлить</span>
              </button>
            </div>
          </div>
          <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft">
            <h3 class="font-black tracking-tight">Свежие пины рядом</h3>
            <div v-if="pins.length" class="mt-4 space-y-5">
              <div v-if="myPins.length">
                <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">Мои · {{ myPins.length }}</div>
                <div class="mt-2 space-y-2.5">
                  <div v-for="p in myPins.slice(0,4)" :key="'m'+p.id" class="border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/25 rounded-2xl p-3.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition relative">
                    <button @click="deletePin(p.id)" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 hover:border-red-200 dark:hover:border-red-800 grid place-items-center text-xs" title="Удалить пин">✕</button>
                    <div class="text-sm font-semibold truncate pr-8 dark:text-zinc-100">{{ p.title }}</div><div class="text-xs text-stone-600 dark:text-zinc-400 line-clamp-1 mt-0.5">{{ p.body }}</div><div class="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-zinc-400 mt-2"><span class="bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-full px-2 py-0.5">{{ p.category }}</span><span>{{ p.reactions_count||0 }} ❤️</span><span class="ml-auto bg-white dark:bg-zinc-800 rounded-full px-2 py-0.5 border border-stone-200 dark:border-zinc-700">до {{ new Date(p.expires_at).toLocaleTimeString().slice(0,5) }}</span></div>
                  </div>
                </div>
              </div>
              <div v-if="otherPins.length">
                <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">Пользователей · {{ otherPins.length }}</div>
                <div class="mt-2 space-y-2.5">
                  <div v-for="p in otherPins.slice(0,6)" :key="p.id" class="border border-stone-200 dark:border-zinc-700 rounded-2xl p-3.5 hover:bg-stone-50 dark:hover:bg-zinc-800 hover:border-stone-300 dark:hover:border-zinc-600 transition bg-white dark:bg-zinc-800/50">
                    <div class="text-sm font-semibold truncate dark:text-zinc-100">{{ p.title }}</div><div class="text-xs text-stone-500 dark:text-zinc-400 line-clamp-1 mt-0.5">{{ p.body }}</div><div class="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-zinc-400 mt-2"><span class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full px-2 py-0.5">{{ p.category }}</span><span>{{ p.reactions_count||0 }} ❤️</span><span class="ml-auto bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full px-2 py-0.5">до {{ new Date(p.expires_at).toLocaleTimeString().slice(0,5) }}</span></div>
                  </div>
                </div>
              </div>
              <div v-if="!myPins.length && !otherPins.length" class="text-center py-4 text-xs text-stone-400">Нет пинов</div>
            </div>
            <div v-else class="text-center py-8"><div class="w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 mx-auto grid place-items-center text-stone-400">◎</div><div class="text-sm font-medium text-stone-600 dark:text-zinc-400 mt-3">Пинов пока нет</div><div class="text-xs text-stone-400">Стань первым в районе</div></div>
            <Link href="/map" class="mt-4 inline-flex bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-ink-800 dark:hover:bg-zinc-100">Открыть карту</Link>
          </div>
        </div>

        <div class="bg-white border border-stone-200 rounded-[20px] p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-soft">
          <div class="text-sm flex items-center gap-3"><span class="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 grid place-items-center text-emerald-700 text-xs">✓</span><span><b>Приватность:</b> <span class="text-stone-600">ты — не точка, ты — пин. Размытие 200м · анонимно · блок в 1 клик.</span></span></div>
          <Link href="/profile" class="text-sm font-semibold bg-stone-100 hover:bg-stone-200 rounded-full px-4 py-2 transition whitespace-nowrap">Настройки →</Link>
        </div>
      </div>
    </div>
  </AuthenticatedLayout>
</template>
