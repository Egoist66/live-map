<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import DeleteUserForm from './Partials/DeleteUserForm.vue'
import UpdatePasswordForm from './Partials/UpdatePasswordForm.vue'
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm.vue'
import { Head, usePage } from '@inertiajs/vue3'
import { Link } from '@inertiajs/vue3'
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { useTheme } from '@/composables/useTheme'
import AvatarPreview from '@/Components/AvatarPreview.vue'

const props = defineProps<{ mustVerifyEmail: boolean; status: string; user: any }>()
const page = usePage()
const u = computed(() => props.user || (page.props.auth as any).user)
const { theme, setTheme } = useTheme()
const active = ref<'profile'|'privacy'|'appearance'|'security'|'pins'|'support'>('profile')

const tabs = [
  { id:'profile', label:'Профиль', icon:'◉', desc:'Фото, имя, дом' },
  { id:'pins', label:'Мои пины', icon:'📍', desc:'Созданные, удалить' },
  { id:'privacy', label:'Приватность', icon:'🔒', desc:'Анонимность, зона' },
  { id:'appearance', label:'Внешний вид', icon:'◐', desc:'Тема, карта' },
  { id:'security', label:'Безопасность', icon:'🛡', desc:'Пароль, удаление' },
  { id:'support', label:'Поддержка', icon:'💬', desc:'Письмо, донат' },
] as const
const myPins = ref<any[]>([])
const loadingPins = ref(false)
async function loadMyPins(){ loadingPins.value=true; try{ const {data}=await axios.get('/api/pins/mine'); myPins.value=Array.isArray(data)?data:[] }catch{} finally{loadingPins.value=false} }
async function deleteMyPin(id:number){ if(!confirm('Удалить пин?')) return; try{ await axios.delete(`/api/pins/${id}`); myPins.value=myPins.value.filter(p=>p.id!==id)}catch(e:any){ alert(e?.response?.data?.message||'Ошибка') } }
watch(active, v=>{ if(v==='pins') loadMyPins(); if(v==='support') loadRate() })
const showAvatar = ref(false)
const supportSubject = ref('')
const supportBody = ref('')
const supportBodyRef = ref<HTMLTextAreaElement|null>(null)
const donateSel = ref(5)
const usdRate = ref<number|null>(null)
const rateLoading = ref(false)
async function loadRate(){ if(usdRate.value) return; rateLoading.value=true; try{ const r=await fetch('https://api.nbrb.by/exrates/rates/431?parammode=2'); const d:any=await r.json(); usdRate.value = d.Cur_OfficialRate / d.Cur_Scale } catch{ try{ const r2=await fetch('https://api.exchangerate-api.com/v4/latest/USD'); const d2:any=await r2.json(); usdRate.value = d2.rates?.BYN || null } catch{} } finally{ rateLoading.value=false } }
function fmtByn(usd:number){ if(!usdRate.value) return '—'; return (usd*usdRate.value).toFixed(2)+' BYN' }
function wrapSelection(before:string, after:string){ const el=supportBodyRef.value; if(!el) return; const s=el.selectionStart||0, e=el.selectionEnd||0; const v=supportBody.value; supportBody.value = v.slice(0,s)+before+v.slice(s,e)+after+v.slice(e); setTimeout(()=>{ el.focus(); el.setSelectionRange(s+before.length, e+before.length) },0) }
function mailToSupport(){ const subj=encodeURIComponent(supportSubject.value||'Обращение в поддержку Live Map'); const body=encodeURIComponent(supportBody.value+(supportBody.value?'\n\n---\n':''+`Пользователь: ${u.value.name} <${u.value.email}>`)); window.location.href=`mailto:razormad666@gmail.com?subject=${subj}&body=${body}` }
function mailToDonate(usd:number){ const byn = usdRate.value? (usd*usdRate.value).toFixed(2)+' BYN' : `${usd}$`; const subj=encodeURIComponent(`Донат Live Map — $${usd} (~${byn})`); const body=encodeURIComponent(`Привет! Хочу задонатить $${usd} (~${byn}) разработчику Live Map.\n\nПользователь: ${u.value.name} <${u.value.email}>\nТариф: ${u.value.plan||'free'}\n\nСообщение:\n`); window.location.href=`mailto:razormad666@gmail.com?subject=${subj}&body=${body}` }
const avatarSrc = computed(() => u.value.avatar_path ? `/storage/${u.value.avatar_path}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.value.name)}&background=0F172A&color=fff&bold=true`)
</script>

<template>
  <Head title="Настройки" />
  <AuthenticatedLayout>
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]">
      <div class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
        <div class="bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-6 sm:p-7 flex flex-col sm:flex-row justify-between gap-4 relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"></div>
          <div class="relative flex items-center gap-4 min-w-0">
            <button @click="showAvatar=true" class="group relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/20 shrink-0 focus:outline-none focus:ring-2 focus:ring-white/40">
              <img :src="avatarSrc" class="w-full h-full object-cover group-hover:scale-105 transition duration-300"/>
              <span class="absolute inset-0 bg-black/0 group-hover:bg-black/20 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-xs">🔍</span>
            </button>
            <div class="min-w-0">
              <h1 class="text-xl font-black tracking-tight truncate">{{ u.name }} <span class="font-medium text-white/60 text-sm ml-2">{{ u.level || 'novice' }} · {{ u.reputation_score||0 }} ★</span></h1>
              <p class="text-white/60 text-sm mt-0.5 truncate">{{ u.email }} · <span class="capitalize">{{ u.plan||'free' }}</span> · {{ u.home_lat ? `дом ${Number(u.home_lat).toFixed(3)}, ${Number(u.home_lng).toFixed(3)}` : 'дом не задан' }}</p>
            </div>
          </div>
          <Link href="/map" class="relative bg-white text-ink-900 px-6 py-3 rounded-full font-bold h-fit hover:bg-stone-50 transition shrink-0 self-start sm:self-center">На карту →</Link>
        </div>

        <div class="mt-6 grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          <div class="lg:sticky lg:top-[80px] bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-2 shadow-soft">
            <div class="hidden lg:block px-2 py-2 text-[11px] font-bold tracking-widest text-stone-400 uppercase">Настройки</div>
            <nav class="flex lg:block gap-1.5 lg:space-y-1 overflow-x-auto scrollbar-none pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0 snap-x">
              <button v-for="t in tabs" :key="t.id" @click="active=t.id" :class="['shrink-0 lg:w-full text-left flex items-center gap-3 px-3 py-2.5 lg:py-3 rounded-xl transition snap-start', active===t.id ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 shadow-soft' : 'hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 bg-stone-50 lg:bg-transparent dark:bg-zinc-800/50 lg:dark:bg-transparent border lg:border-0 border-stone-200 dark:border-zinc-700']">
                <span class="w-8 h-8 lg:w-9 lg:h-9 rounded-xl grid place-items-center text-sm shrink-0" :class="active===t.id ? 'bg-white/15 dark:bg-ink-900/10' : 'bg-white lg:bg-stone-100 dark:bg-zinc-700'">{{ t.icon }}</span>
                <div class="min-w-0 hidden sm:block lg:block"><div class="text-sm font-semibold leading-none whitespace-nowrap">{{ t.label }}</div><div class="text-xs opacity-60 leading-none mt-1 hidden lg:block">{{ t.desc }}</div></div>
                <span class="text-xs font-semibold sm:hidden lg:hidden">{{ t.label }}</span>
                <span v-if="active===t.id" class="ml-auto text-xs hidden lg:inline">→</span>
              </button>
            </nav>
            <div class="mt-4 mx-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
              <div class="text-xs font-bold">Подписка {{ u.plan||'free' }}</div>
              <div class="text-xs text-stone-600 dark:text-zinc-400 mt-1">{{ u.pins_today_count||0 }}/{{ u.plan==='free'?3:'∞' }} пинов сегодня</div>
              <Link href="/profile" class="text-xs font-semibold underline mt-2 inline-block">Управление →</Link>
            </div>
          </div>

          <div class="space-y-4 min-w-0">
            <div v-show="active==='profile'" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover">
              <h3 class="font-black tracking-tight text-lg">Профиль</h3>
              <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Фото, имя и домашняя зона — на них строится весь Live Map.</p>
              <UpdateProfileInformationForm :must-verify-email="mustVerifyEmail" :status="status" class="mt-5 max-w-xl" />
            </div>

            <div v-show="active==='privacy'" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover">
              <h3 class="font-black tracking-tight text-lg">Приватность</h3>
              <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Ты — не точка, ты — пин. Управляй размытием и анонимностью.</p>
              <div class="mt-5 space-y-4 max-w-xl">
                <div class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4">
                  <div class="text-sm font-semibold">Базовые принципы</div>
                  <ul class="text-sm text-stone-600 dark:text-zinc-400 mt-2 space-y-1 list-disc pl-5">
                    <li>Размытие 200м по умолчанию — координаты смещаются случайно</li>
                    <li>Анонимный пин скрывает имя и репутацию</li>
                    <li>Блокировка в 1 клик скрывает контент пользователя</li>
                  </ul>
                </div>
                <div class="border border-stone-200 dark:border-zinc-700 rounded-2xl p-4">
                  <div class="text-sm font-semibold">Режим анонимности по умолчанию</div>
                  <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Настраивается в разделе «Профиль» — переключатель «Анонимно по умолчанию». При создании пина можно переопределить.</p>
                  <button @click="active='profile'" class="mt-3 text-xs font-semibold bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-4 py-2 rounded-full">Перейти в Профиль →</button>
                </div>
              </div>
            </div>

            <div v-show="active==='appearance'" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover">
              <h3 class="font-black tracking-tight text-lg">Внешний вид</h3>
              <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Тема оформления и отображение карты.</p>
              <div class="mt-6 space-y-5 max-w-xl">
                <div>
                  <div class="text-sm font-semibold">Тема</div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400">Выбери как выглядит Live Map на этом устройстве</div>
                  <div class="mt-3 grid grid-cols-3 gap-2">
                    <button @click="setTheme('light')" :class="['rounded-2xl border p-3 flex flex-col items-center gap-2 transition', theme==='light' ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft' : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50']">
                      <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 grid place-items-center text-sm">☀️</span>
                      <span class="text-xs font-semibold">Светлая</span>
                    </button>
                    <button @click="setTheme('dark')" :class="['rounded-2xl border p-3 flex flex-col items-center gap-2 transition', theme==='dark' ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft' : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50']">
                      <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 grid place-items-center text-sm text-white">🌙</span>
                      <span class="text-xs font-semibold">Тёмная</span>
                    </button>
                    <button @click="setTheme('system')" :class="['rounded-2xl border p-3 flex flex-col items-center gap-2 transition', theme==='system' ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft' : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50']">
                      <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-zinc-800 grid place-items-center text-sm">◐</span>
                      <span class="text-xs font-semibold">Система</span>
                    </button>
                  </div>
                  <div class="text-[11px] text-stone-400 mt-2">Система = следует настройкам OS</div>
                </div>

              
              </div>
            </div>

            <div v-show="active==='pins'" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft">
              <h3 class="font-black tracking-tight text-lg">Мои пины</h3>
              <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Правый клик по пину на карте тоже удаляет. Здесь — полный список.</p>
              <div v-if="loadingPins" class="mt-5 flex items-center gap-2 text-sm text-stone-500"><span class="w-4 h-4 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin"></span> Загружаем…</div>
              <div v-else-if="myPins.length" class="mt-5 grid sm:grid-cols-2 gap-3">
                <div v-for="p in myPins" :key="p.id" class="border border-stone-200 rounded-2xl p-4 hover:bg-stone-50 transition relative">
                  <button @click="deleteMyPin(p.id)" class="absolute top-3 right-3 w-7 h-7 rounded-full bg-white border border-stone-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center text-xs" title="Удалить">✕</button>
                  <div class="text-sm font-bold pr-8 truncate">{{ p.title }}</div>
                  <div class="text-xs text-stone-500 mt-1 line-clamp-2">{{ p.body }}</div>
                  <div class="flex items-center gap-1.5 mt-3 text-[11px]"><span class="bg-ink-900 text-white rounded-full px-2 py-0.5">{{ p.category }}</span><span class="bg-stone-100 rounded-full px-2 py-0.5">{{ new Date(p.expires_at).toLocaleDateString() }} {{ new Date(p.expires_at).toLocaleTimeString().slice(0,5) }}</span></div>
                </div>
              </div>
              <div v-else class="mt-6 text-center py-8 border border-dashed border-stone-200 rounded-2xl"><div class="w-10 h-10 rounded-xl bg-stone-100 border mx-auto grid place-items-center">📍</div><div class="text-sm font-medium mt-2">Пока нет пинов</div><div class="text-xs text-stone-400">Создай первый на карте</div><Link href="/map" class="mt-3 inline-flex bg-ink-900 text-white px-5 py-2 rounded-full text-sm font-semibold">На карту →</Link></div>
            </div>

            <div v-show="active==='support'" class="space-y-4">
              <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft">
                <h3 class="font-black tracking-tight text-lg">Обратиться в поддержку</h3>
                <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Опиши проблему — ответим в течение часа.</p>
                <div class="mt-5 max-w-xl space-y-3">
                  <div><label class="text-sm font-medium">Тема</label><input v-model="supportSubject" placeholder="Напр. Не грузится карта в Минске" class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700"/></div>
                  <div>
                    <label class="text-sm font-medium">Сообщение</label>
                    <textarea ref="supportBodyRef" v-model="supportBody" rows="6" placeholder="Опиши проблему подробно..." class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700 resize-y"></textarea>
                  </div>
                  <button @click="mailToSupport" class="w-full bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full py-3 font-semibold hover:bg-ink-800 dark:hover:bg-zinc-100">✉️ Отправить обращение</button>
                </div>
              </div>
              <div class="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900 rounded-[20px] p-6">
                <h3 class="font-black tracking-tight">Задонатить разработчику ❤️</h3>
                <p class="text-sm text-stone-600 dark:text-zinc-400 mt-1">Поддержи Live Map — выбери сумму в долларах, покажем по курсу НБРБ (BYN).</p>
                <div class="mt-4 flex items-center gap-2 text-xs"><span class="bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded-full px-3 py-1.5">Курс: <b v-if="usdRate">{{ usdRate.toFixed(4) }} BYN / $</b><span v-else-if="rateLoading" class="inline-flex items-center gap-1"><span class="w-3 h-3 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin"></span> загрузка…</span><span v-else>—</span></span><button @click="loadRate" class="text-xs underline">обновить</button></div>
                <div class="mt-4 grid grid-cols-3 gap-2">
                  <button v-for="usd in [2,5,10]" :key="usd" @click="donateSel=usd" :class="['rounded-2xl border p-4 text-center transition', donateSel===usd?'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 dark:border-white shadow-lg':'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 hover:bg-stone-50']">
                    <div class="text-lg font-black">${{ usd }}</div><div class="text-xs opacity-70">{{ fmtByn(usd) }}</div>
                  </button>
                </div>
                <button @click="mailToDonate(donateSel)" class="mt-4 w-full bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 rounded-full py-3.5 font-black shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] transition">💛 Задонатить ${{ donateSel }} → {{ fmtByn(donateSel) }}</button>
                <p class="text-[11px] text-stone-500 dark:text-zinc-400 mt-2 text-center">Откроется почтовый клиент с письмом — укажи удобный способ перевода, банк пересчитает по курсу</p>
              </div>
            </div>

            <div v-show="active==='security'" class="space-y-4">
              <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover"><UpdatePasswordForm class="max-w-xl" /></div>
              <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover"><DeleteUserForm class="max-w-xl" /></div>
            </div>
          </div>
        </div>
      </div>
      <AvatarPreview :src="avatarSrc" :name="u.name" :open="showAvatar" @close="showAvatar=false" />
    </div>
  </AuthenticatedLayout>
</template>

<style scoped>
.privacy-only :deep(form) { display: contents; }
</style>
