<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import DeleteUserForm from './Partials/DeleteUserForm.vue'
import UpdatePasswordForm from './Partials/UpdatePasswordForm.vue'
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm.vue'
import { Head, usePage, Link } from '@inertiajs/vue3'
import { ref, computed, watch, onMounted } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useSupportExchange } from '@/composables/useSupportExchange'
import { useSettingsTabs } from '@/composables/useSettingsTabs'
import axios from 'axios'
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { myPinsQuery, PIN_KEYS } from '@/queries/pins'
import { pinsApi } from '@/services/pins.api'
import { formatDate, formatTime } from '@/utils/date'
import AvatarPreview from '@/Components/AvatarPreview.vue'
import { avatarSrcFor } from '@/composables/useAvatar'
import Toast from 'primevue/toast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import Menu from 'primevue/menu'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import { useInvisible } from '@/composables/useInvisible'
const props = defineProps<{ mustVerifyEmail: boolean; status?: string | null; user: any }>()
const page = usePage()
const u = computed(() => props.user || (page.props.auth as any).user)
const { theme, setTheme } = useTheme()
const { active, tabs, activeIndex, menuModel } = useSettingsTabs()
const cache = useQueryCache()
const { state: pinsState, refetch, asyncStatus: pinsAsyncStatus } = useQuery(() => ({ ...myPinsQuery, enabled: active.value === 'pins' }))
const myPins = computed(() => (pinsState.value.data as any[]) || [])
const loadingPins = computed(() => pinsState.value.status === 'pending' || pinsAsyncStatus.value === 'loading')
const { mutateAsync: deleteMutate, asyncStatus: deleteAsyncStatus } = useMutation({
  mutation: (id: number) => pinsApi.remove(id),
  onSuccess: () => cache.invalidateQueries({ key: PIN_KEYS.mine() as any }),
})
async function deleteMyPin(id:number){
  if(!confirm('Удалить пин?')) return
  try{ await deleteMutate(id); await refetch() } catch(e:any){ alert(e?.response?.data?.message||'Ошибка') }
}
const zoneCount = ref(0)
watch(active, v=>{ if(v==='pins') refetch(); if(v==='support') ex.load(); if(v==='billing') loadZoneCount() })
async function loadZoneCount(){ try{ const {data}=await axios.get('/api/zone-subscriptions'); zoneCount.value=Array.isArray(data)?data.length:0 }catch{} }
onMounted(loadZoneCount)
const showAvatar = ref(false)
const supportSubject = ref('')
const supportBody = ref('')
const donateSel = ref(5)
const ex = useSupportExchange()
function mailToSupport(){ const subj=encodeURIComponent(supportSubject.value||'Обращение в поддержку UPin'); const body=encodeURIComponent(supportBody.value+(supportBody.value?'\n\n---\n':''+`Пользователь: ${u.value.name} <${u.value.email}>`)); window.location.href=`mailto:razormad666@gmail.com?subject=${subj}&body=${body}` }
function mailToDonate(usd:number){ const byn = ex.usdRate.value? (usd*ex.usdRate.value).toFixed(2)+' BYN' : `${usd}$`; const subj=encodeURIComponent(`Донат UPin — $${usd} (~${byn})`); const body=encodeURIComponent(`Привет! Хочу задонатить $${usd} (~${byn}) разработчику UPin.\n\nПользователь: ${u.value.name} <${u.value.email}>\nТариф: ${u.value.plan||'free'}\n\nСообщение:\n`); window.location.href=`mailto:razormad666@gmail.com?subject=${subj}&body=${body}` }
const avatarSrc = computed(() => avatarSrcFor(u.value))
const bioPreviewText = computed(() => ((u.value as any).bio || '').trim())
const bioPreviewEmpty = computed(() => bioPreviewText.value.length === 0)
const invisible = useInvisible()
</script>
<template>
  <Head title="Настройки" />
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)] overflow-x-hidden">
      <div class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 overflow-hidden">
        <div class="grid lg:grid-cols-[300px_1fr] gap-6 items-start content-start w-full lg:items-start">
          <aside class="hidden lg:block self-start space-y-4 h-fit shrink-0">
            <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-3' }, content:{ class:'!p-0' } }">
              <template #content>
                <div class="px-2 py-2 text-[11px] font-bold tracking-widest text-stone-400 uppercase">Настройки</div>
                <Menu :model="(menuModel as any)" class="!bg-transparent !border-0 !w-full !p-0" :pt="{ root:{ class:'!bg-transparent !border-0 !p-0 !w-full' }, list:{ class:'!p-0 !flex !flex-col !gap-1 !bg-transparent' }, item:{ class:'!p-0' }, itemContent:{ class:'!p-0 !bg-transparent hover:!bg-transparent' }, submenuLabel:{ class:'!hidden' } }">
                  <template #item="{ item, props: p }">
                    <button v-bind="p.action" :class="['w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-colors border box-border', (item as any).active ? '!bg-violet-600 !border-violet-600 !text-white shadow-soft dark:!bg-violet-600 dark:!border-violet-600 dark:!text-white' : 'border-transparent hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300']">
                      <span :class="['w-9 h-9 rounded-2xl grid place-items-center text-sm shrink-0', (item as any).active ? 'bg-white/20 !text-white' : 'bg-stone-100 dark:bg-zinc-700']"><i :class="(item as any).icon" /></span>
                      <span class="min-w-0 text-left">
                        <span class="block text-sm font-semibold leading-none">{{ (item as any).label }}</span>
                        <span class="block text-xs opacity-60 leading-none mt-1">{{ (item as any).desc }}</span>
                      </span>
                      <span v-if="(item as any).active" class="ml-auto text-xs">→</span>
                    </button>
                  </template>
                </Menu>
                <Card class="!bg-gradient-to-br !from-amber-50 !to-orange-50 dark:!from-amber-950/20 dark:!to-orange-950/20 !border-amber-200 dark:!border-amber-900 !rounded-3xl !shadow-none mt-4" :pt="{ body:{ class:'!p-3' }, content:{ class:'!p-0' } }">
                  <template #content>
                    <div class="text-xs font-bold dark:text-white">Тариф {{ u.plan||'free' }}</div>
                    <div class="text-xs text-stone-600 dark:text-zinc-400 mt-1">{{ u.pins_today_count||0 }}/{{ u.plan==='free'?3:'∞' }} пинов сегодня · {{ zoneCount }} подписок</div>
                    <Button @click="active='billing'" label="Управление →" link size="small" class="!px-0 !text-xs !font-semibold !mt-2" />
                  </template>
                </Card>
              </template>
            </Card>
          </aside>
          <div class="space-y-4 min-w-0 w-full max-w-full lg:min-h-[600px] self-start">
            <Tabs :value="activeIndex" @update:value="(v:any)=>{ const e=tabs[Number(v)]; if(e) active=e.id as any }" class="w-full !mt-0">
              <TabList class="!flex lg:!hidden !bg-transparent !border-0 !gap-2 !overflow-x-auto !flex-nowrap !pb-2 !px-1 !scrollbar-none !snap-x" :pt="{ activeBar:{ class:'!hidden' } }">
                <Tab v-for="(t, idx) in tabs" :key="t.id" :value="String(idx)" class="!bg-transparent !border-0 !p-0 !shrink-0 !snap-start">
                  <div :class="['flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border transition whitespace-nowrap', active===t.id ? '!bg-violet-600 !text-white !border-violet-600 shadow-soft dark:!bg-violet-600 dark:!border-violet-600 dark:!text-white' : 'bg-white dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 border-stone-200 dark:border-zinc-700']">
                    <i :class="[t.icon, 'text-xs']" /><span>{{ t.label }}</span>
                  </div>
                </Tab>
              </TabList>
              <TabPanels class="!bg-transparent !p-0">
                <TabPanel value="0">
                  <div class="space-y-4">
                    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }">
                      <template #content>
                        <h3 class="font-black tracking-tight text-lg dark:text-white">Основное</h3>
                        <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Аватар, контакты и домашняя зона — что видят другие.</p>
                        <UpdateProfileInformationForm :must-verify-email="mustVerifyEmail" :status="status" class="mt-5 max-w-xl" />
                      </template>
                    </Card>
                    <Card v-if="!bioPreviewEmpty" class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }">
                      <template #content>
                        <h4 class="text-sm font-black flex items-center gap-2 dark:text-white">Превью «О себе» <Tag value="как видят другие" class="!text-xs !font-normal !bg-stone-100 !text-stone-500 !border-0" /></h4>
                        <div class="mt-3 bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 rounded-3xl p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-stone-700 dark:text-zinc-300">{{ bioPreviewText }}</div>
                      </template>
                    </Card>
                  </div>
                </TabPanel>
                <TabPanel value="1">
                  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }">
                    <template #content>
                      <h3 class="font-black tracking-tight text-lg dark:text-white">Тариф и лимиты</h3>
                      <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Метрики твоего плана — перенесены с дашборда сюда.</p>
                      <div class="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }"><template #content><div class="w-8 h-8 rounded-xl bg-ink-900 text-white grid place-items-center text-xs">◉</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-400 mt-3 uppercase tracking-wide">План</div><div class="font-black text-base capitalize dark:text-white">{{ u.plan||'free' }}</div><div class="text-xs text-stone-500 dark:text-zinc-400">{{ u.plan==='free'?'3 пина/день · 1 км':'Безлимит · 5 км' }}</div></template></Card>
                        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }"><template #content><div class="w-8 h-8 rounded-xl bg-brand-500 text-white grid place-items-center text-xs">✦</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-400 mt-3 uppercase tracking-wide">Пинов сегодня</div><div class="font-black text-base dark:text-white">{{ u.pins_today_count||0 }}/{{ u.plan==='free'?3:'∞' }}</div><div class="text-xs text-stone-500 dark:text-zinc-400">сброс в 00:00</div></template></Card>
                        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }"><template #content><div class="w-8 h-8 rounded-xl bg-emerald-600 text-white grid place-items-center text-xs">◐</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-400 mt-3 uppercase tracking-wide">Подписки</div><div class="font-black text-base dark:text-white">{{ zoneCount }}</div><div class="text-xs text-stone-500 dark:text-zinc-400">уведомления</div></template></Card>
                        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }"><template #content><div class="w-8 h-8 rounded-xl bg-amber-400 text-ink-900 grid place-items-center text-xs">◎</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-400 mt-3 uppercase tracking-wide">Радиус</div><div class="font-black text-base dark:text-white">{{ (u.home_radius_km||2) }} км</div><div class="text-xs text-stone-500 dark:text-zinc-400">{{ u.home_lat?'дом задан':'не задан' }}</div></template></Card>
                      </div>
                      <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none mt-5" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
                        <template #content>
                          <div class="text-sm font-bold dark:text-white">Сменить тариф — в разделе Профиль</div>
                          <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Free / Pro $4.99 / Business $19.99 — переключай внизу формы профиля.</p>
                          <Button @click="active='profile'" label="К выбору тарифа →" rounded size="small" class="!bg-ink-900 dark:!bg-white !border-ink-900 dark:!border-white dark:!text-ink-900 !text-white mt-3" />
                        </template>
                      </Card>
                    </template>
                  </Card>
                </TabPanel>
                <TabPanel value="2">
                  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }">
                    <template #content>
                      <h3 class="font-black tracking-tight text-lg dark:text-white">Мои пины</h3>
                      <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Правый клик по пину на карте тоже удаляет. Здесь — полный список.</p>
                      <div v-if="loadingPins" class="mt-5 flex items-center gap-2 text-sm text-stone-500"><span class="w-4 h-4 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin"></span> Загружаем…</div>
                      <div v-else-if="myPins.length" class="mt-5 grid sm:grid-cols-2 gap-3">
                        <Card v-for="p in myPins" :key="p.id" class="!border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none !bg-white dark:!bg-zinc-800 hover:!bg-stone-50 dark:hover:!bg-zinc-700 !transition relative" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
                          <template #content>
                            <Button @click="deleteMyPin(p.id)" :loading="(deleteAsyncStatus as any)?.value==='loading' || (deleteAsyncStatus as any)==='loading'" rounded text severity="secondary" class="!absolute !top-3 !right-3 !w-7 !h-7 !p-0 !bg-white dark:!bg-zinc-700 !border !border-stone-200 dark:!border-zinc-600 hover:!bg-red-50 dark:hover:!bg-red-950/30 hover:!text-red-600 dark:hover:!text-red-400 hover:!border-red-200 dark:hover:!border-red-800" icon="pi pi-times" aria-label="Удалить" />
                            <div class="text-sm font-bold pr-8 truncate dark:text-white">{{ p.title }}</div>
                            <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1 line-clamp-2">{{ p.body }}</div>
                            <div class="flex items-center gap-1.5 mt-3 text-[11px]"><Tag :value="p.category" class="!bg-ink-900 dark:!bg-zinc-700 !text-white !rounded-full !text-[11px] !px-2 !py-0.5 !border-0" /><Tag :value="`${formatDate(p.expires_at)} ${formatTime(p.expires_at)}`" class="!bg-stone-100 dark:!bg-zinc-700 !text-stone-600 dark:!text-zinc-300 !rounded-full !text-[11px] !px-2 !py-0.5 !border-0" /></div>
                          </template>
                        </Card>
                      </div>
                      <Card v-else class="!border-dashed !border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none mt-6 text-center !bg-white dark:!bg-zinc-900" :pt="{ body:{ class:'!py-8' }, content:{ class:'!p-0' } }">
                        <template #content>
                          <div class="w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 border dark:border-zinc-700 mx-auto grid place-items-center">📍</div><div class="text-sm font-medium mt-2 dark:text-white">Пока нет пинов</div><div class="text-xs text-stone-400 dark:text-zinc-500">Создай первый на карте</div><Link href="/map" class="mt-3 inline-flex"><Button label="На карту →" rounded size="small" class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !border-ink-900 dark:!border-white !text-white" /></Link>
                        </template>
                      </Card>
                    </template>
                  </Card>
                </TabPanel>
                <TabPanel value="3">
                  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }">
                    <template #content>
                      <h3 class="font-black tracking-tight text-lg dark:text-white">Приватность</h3>
                      <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Ты — не точка, ты — пин. Управляй размытием и анонимностью.</p>
                      <div class="mt-5 space-y-4 max-w-xl">
                        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
                          <template #content>
                            <div class="text-sm font-semibold dark:text-white">Базовые принципы</div>
                            <ul class="text-sm text-stone-600 dark:text-zinc-400 mt-2 space-y-1 list-disc pl-5">
                              <li>Размытие 200м по умолчанию — координаты смещаются случайно</li>
                              <li>Анонимный пин скрывает имя и репутацию</li>
                              <li>Блокировка в 1 клик скрывает контент пользователя</li>
                            </ul>
                          </template>
                        </Card>
                        <Card class="!border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
                          <template #content>
                            <div class="text-sm font-semibold dark:text-white">Режим анонимности по умолчанию</div>
                            <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Настраивается в разделе «Профиль» — переключатель «Анонимно по умолчанию». При создании пина можно переопределить.</p>
                            <Button @click="active='profile'" label="Перейти в Профиль →" rounded size="small" class="!bg-ink-900 dark:!bg-white !border-ink-900 dark:!border-white dark:!text-ink-900 !text-white mt-3" />
                          </template>
                        </Card>
                        <Card class="!border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none" :class="invisible.isInvisible.value ? '!bg-violet-50 dark:!bg-violet-950/20 !border-violet-200 dark:!border-violet-900' : ''" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
                          <template #content>
                            <div class="flex items-start justify-between gap-3">
                              <div class="min-w-0">
                                <div class="text-sm font-semibold dark:text-white flex items-center gap-2">Режим «Невидимка» <Tag v-if="invisible.canUse.value" value="PRO" class="!bg-violet-600 !text-white !border-0 !text-[10px] !px-1.5 !py-0.5 !rounded-full" /><Tag v-else value="PRO only" class="!bg-stone-200 !text-stone-600 !border-0 !text-[10px] !px-1.5 !py-0.5 !rounded-full" /></div>
                                <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">Скрывает твой онлайн-статус — для других ты офлайн, не попадаешь в «в сети» и не обновляется «был в сети». Доступен только админам и тарифу Pro и выше.</p>
                              </div>
                              <ToggleSwitch :modelValue="invisible.isInvisible.value" @update:modelValue="(v:boolean)=>invisible.toggle(v)" :disabled="!invisible.canUse.value || invisible.loading.value" />
                            </div>
                            <Message v-if="!invisible.canUse.value" severity="warn" :closable="false" class="!mt-3 !rounded-2xl !text-xs">Нужен тариф Pro/Business или права админа. Сейчас у тебя {{ u.plan||'free' }}.</Message>
                            <Message v-if="invisible.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ invisible.error.value }}</Message>
                            <p v-if="invisible.isInvisible.value" class="text-xs font-semibold text-violet-700 dark:text-violet-300 mt-2">Включена — ты скрыт в онлайне</p>
                          </template>
                        </Card>
                      </div>
                    </template>
                  </Card>
                </TabPanel>
                <TabPanel value="4">
                  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }">
                    <template #content>
                      <h3 class="font-black tracking-tight text-lg dark:text-white">Внешний вид</h3>
                      <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Тема оформления и отображение карты.</p>
                      <div class="mt-6 space-y-5 max-w-xl">
                        <div>
                          <div class="text-sm font-semibold dark:text-white">Тема</div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400">Выбери как выглядит UPin на этом устройстве</div>
                          <div class="mt-3 grid grid-cols-3 gap-2">
                            <Card @click="setTheme('light')" :class="['!rounded-3xl !cursor-pointer !transition', theme==='light' ? '!bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !border-ink-900 dark:!border-white !shadow-soft' : '!bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 hover:!bg-stone-50 dark:hover:!bg-zinc-700 !text-ink-900 dark:!text-white']" :pt="{ body:{ class:'!p-3 !flex !flex-col !items-center !gap-2' }, content:{ class:'!p-0' } }"><template #content><span class="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 grid place-items-center text-sm">☀️</span><span class="text-xs font-semibold">Светлая</span></template></Card>
                            <Card @click="setTheme('dark')" :class="['!rounded-3xl !cursor-pointer !transition', theme==='dark' ? '!bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !border-ink-900 dark:!border-white !shadow-soft' : '!bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 hover:!bg-stone-50 dark:hover:!bg-zinc-700 !text-ink-900 dark:!text-white']" :pt="{ body:{ class:'!p-3 !flex !flex-col !items-center !gap-2' }, content:{ class:'!p-0' } }"><template #content><span class="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 grid place-items-center text-sm text-white">🌙</span><span class="text-xs font-semibold">Тёмная</span></template></Card>
                            <Card @click="setTheme('system')" :class="['!rounded-3xl !cursor-pointer !transition', theme==='system' ? '!bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !border-ink-900 dark:!border-white !shadow-soft' : '!bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 hover:!bg-stone-50 dark:hover:!bg-zinc-700 !text-ink-900 dark:!text-white']" :pt="{ body:{ class:'!p-3 !flex !flex-col !items-center !gap-2' }, content:{ class:'!p-0' } }"><template #content><span class="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-zinc-800 grid place-items-center text-sm">◐</span><span class="text-xs font-semibold">Система</span></template></Card>
                          </div>
                        </div>
                      </div>
                    </template>
                  </Card>
                </TabPanel>
                <TabPanel value="5">
                  <div class="space-y-4">
                    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }"><template #content><UpdatePasswordForm class="max-w-xl" /></template></Card>
                    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }"><template #content><DeleteUserForm class="max-w-xl" /></template></Card>
                  </div>
                </TabPanel>
                <TabPanel value="6">
                  <div class="space-y-4">
                    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }">
                      <template #content>
                        <h3 class="font-black tracking-tight text-lg dark:text-white">Обратиться в поддержку</h3>
                        <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Опиши проблему — ответим в течение часа.</p>
                        <div class="mt-5 max-w-xl space-y-3">
                          <div><label class="text-sm font-medium dark:text-white">Тема</label><InputText v-model="supportSubject" placeholder="Напр. Не грузится карта в Минске" class="w-full mt-1 !rounded-2xl !bg-white dark:!bg-zinc-800 dark:!border-zinc-700 dark:!text-white dark:placeholder:text-zinc-500" /></div>
                          <div><label class="text-sm font-medium dark:text-white">Сообщение</label><Textarea v-model="supportBody" rows="6" placeholder="Опиши проблему подробно..." class="w-full mt-1 !rounded-3xl !bg-white dark:!bg-zinc-800 dark:!border-zinc-700 dark:!text-white dark:placeholder:text-zinc-500" autoResize /></div>
                          <Button @click="mailToSupport" label="✉️ Отправить обращение" rounded class="w-full !bg-ink-900 dark:!bg-white !border-ink-900 dark:!border-white dark:!text-ink-900 !text-white" />
                        </div>
                      </template>
                    </Card>
                    <Card class="!bg-gradient-to-br !from-amber-50 !to-orange-50 dark:!from-amber-950/20 dark:!to-orange-950/20 !border-amber-200 dark:!border-amber-900 !rounded-3xl" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }">
                      <template #content>
                        <h3 class="font-black tracking-tight dark:text-white">Задонатить разработчику ❤️</h3>
                        <p class="text-sm text-stone-600 dark:text-zinc-400 mt-1">Поддержи UPin — выбери сумму в долларах, покажем по курсу НБРБ (BYN).</p>
                        <div class="mt-4 flex items-center gap-2 text-xs"><Tag :value="`Курс: ${ex.usdRate.value ? ex.usdRate.value.toFixed(4)+' BYN / $' : ex.loading.value ? 'загрузка…' : '—'}`" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-700 !text-stone-600 !rounded-full !px-3 !py-1.5" /><Button @click="ex.load" label="обновить" link size="small" /></div>
                        <div class="mt-4 grid grid-cols-3 gap-2">
                          <Card v-for="usd in [2,5,10]" :key="usd" @click="donateSel=usd" :class="['!rounded-3xl !cursor-pointer !text-center !transition', donateSel===usd?'!bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !border-ink-900 dark:!border-white !shadow-lg':'!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-700 hover:!bg-stone-50']" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }"><template #content><div class="text-lg font-black">${{ usd }}</div><div class="text-xs opacity-70">{{ ex.fmtByn(usd) }}</div></template></Card>
                        </div>
                        <Button @click="mailToDonate(donateSel)" :label="`💛 Задонатить $${donateSel} → ${ex.fmtByn(donateSel)}`" rounded class="mt-4 w-full !bg-gradient-to-br !from-amber-400 !to-orange-500 !border-0 !text-stone-900 !font-black" />
                        <p class="text-[11px] text-stone-500 dark:text-zinc-400 mt-2 text-center">Откроется почтовый клиент с письмом — укажи удобный способ перевода</p>
                      </template>
                    </Card>
                  </div>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </div>
        </div>
      </div>
      <AvatarPreview :src="avatarSrc" :name="u.name" :open="showAvatar" @close="showAvatar=false" />
    </div>
  </AuthenticatedLayout>
</template>
