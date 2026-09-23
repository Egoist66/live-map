<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import SelectButton from 'primevue/selectbutton'

import SettingsHiddenFriends from './SettingsHiddenFriends.vue'
import HomeZoneField from '@/Components/Features/HomeZone/HomeZoneField.vue'
import { planOf } from '@/composables/usePlanLimits'
import { useUlovePrivacy } from '@/composables/useUlovePrivacy'
import { useAppModulesStore } from '@/stores/appModules'
defineProps<{ user: any; invisible: any; hidden?: any; blur: any; photoPrivacy?: any; flowPrivacy?: any; homeRadius?: any }>()
const emit = defineEmits<{ (e: 'profile'): void }>()

const modules = useAppModulesStore()
const showMapSection = computed(() => modules.isEnabled('upin'))
const showUloveSection = computed(() => modules.isEnabled('ulove'))
const showFlowSection = computed(() => modules.isEnabled('uflow'))
const showFriendsSection = computed(() => !modules.isIsolated || modules.isEnabled('upin') || modules.isEnabled('uflow'))
const showSelector = computed(() => showMapSection.value && showUloveSection.value)

const privacyTab = ref<'map' | 'ulove'>(modules.isEnabled('upin') ? 'map' : 'ulove')
const privacyTabOptions = [
  { label: '⚙️ Общее', value: 'map' },
  { label: '💘 ULove', value: 'ulove' },
] as const
const ulove = useUlovePrivacy()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Приватность</h3>
      <p class="text-sm text-stone-500 mt-1">{{ showMapSection ? 'Ты — не точка, ты — пин. Управляй видимостью своей геопозиции и анонимностью.' : 'Управляй видимостью анкеты и анонимностью знакомств.' }}</p>
      <div class="mt-5 max-w-xl">
        <SelectButton v-if="showSelector" v-model="privacyTab" :options="[...privacyTabOptions]" option-label="label" option-value="value" class="w-full" />
        <div v-if="showMapSection && privacyTab === 'map'" class="mt-4 space-y-4">
        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Базовые принципы</div>
            <ul class="text-sm text-stone-600 mt-2 space-y-1 list-disc pl-5">
              <li>Твоя точка на карте всегда одна и пульсирует — видна только сдвинутая позиция</li>
              <li>Пины всегда точные — чтобы люди знали, где событие</li>
              <li>Анонимный пин скрывает имя и репутацию</li>
              <li>Блокировка в 1 клик скрывает контент пользователя</li>
            </ul>
          </template>
        </Card>
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold dark:text-white">Моя геопозиция · {{ blur.blurLabel.value }}</div>
                <p class="text-xs text-stone-500 mt-1 leading-relaxed">Насколько сдвигать твою пульсирующую точку от реального места. Координаты точки меняются соответственно.</p>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button v-for="o in blur.options" :key="o.v" type="button" @click="blur.setMeters(o.v)" :disabled="!!o.pro && !blur.canUse5km.value" :title="!!o.pro && !blur.canUse5km.value ? 'Только Pro' : o.d" :class="['px-2 py-2 rounded-xl border text-center transition active:scale-95 disabled:opacity-50', blur.blurMeters.value === o.v ? 'bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900 dark:border-white' : 'bg-white dark:bg-white/[0.06] border-stone-200 dark:border-white/10 text-stone-700 dark:text-zinc-100']">
                <span class="block text-xs font-bold leading-none">{{ o.l }}</span><span class="block text-[10px] opacity-60 leading-none mt-1">{{ o.pro && !blur.canUse5km.value ? 'PRO' : o.d }}</span>
              </button>
            </div>
            <div v-if="blur.saving.value" class="text-xs text-stone-400 mt-2">Сохраняем…</div>
            <div v-else-if="blur.saved.value && !blur.dirty.value" class="text-xs text-emerald-600 mt-2">✓ Запомнили — твоя точка сдвинута на «{{ blur.blurLabel.value }}»</div>
          </template>
        </Card>
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Радиус зоны — где вижу и ставлю пины</div>
            <p class="text-xs text-stone-500 mt-1 leading-relaxed">Создавать и видеть чужие пины можно только внутри зоны. Вне зоны операция запрещена. Free — до 10 км, больше — Pro/Business.</p>
            <div v-if="homeRadius" class="mt-3">
              <HomeZoneField :model-value="homeRadius.radius.value" :plan="String(homeRadius.plan.value)" :error="homeRadius.error.value" @update:model-value="(v:number)=>homeRadius.save(v)" />
              <div v-if="homeRadius.saving.value" class="text-xs text-stone-400 mt-2">Сохраняем…</div>
            </div>
          </template>
        </Card>
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Режим анонимности по умолчанию</div>
            <p class="text-xs text-stone-500 mt-1">Настраивается в разделе «Профиль» — переключатель «Анонимно по умолчанию».</p>
            <Button @click="emit('profile')" label="Перейти в Профиль →" rounded size="small" class="!bg-stone-900 !border-stone-900 !text-white mt-3" />
          </template>
        </Card>
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :class="invisible.isInvisible.value ? '!bg-violet-50 !border-violet-200' : ''" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold dark:text-white flex items-center gap-2">Режим «Невидимка» <Tag v-if="invisible.canUse.value" value="PRO" class="!bg-violet-600 !text-white !border-0 !text-[10px]" /><Tag v-else value="PRO only" class="!bg-stone-200 !text-stone-600 !border-0 !text-[10px]" /></div>
                <p class="text-xs text-stone-500 mt-1 leading-relaxed">Скрывает твой онлайн-статус — для других ты оффлайн.</p>
              </div>
              <ToggleSwitch :modelValue="invisible.isInvisible.value" @update:modelValue="(v:boolean)=>invisible.toggle(v)" :disabled="!invisible.canUse.value || invisible.loading.value" class="shrink-0" />
            </div>
            <Message v-if="!invisible.canUse.value" severity="warn" :closable="false" class="!mt-3 !rounded-2xl !text-xs">Нужен тариф Pro/Business -  сейчас у тебя {{ planOf(user) }}.</Message>
            <Message v-if="invisible.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ invisible.error.value }}</Message>
          </template>
        </Card>
        <SettingsHiddenFriends v-if="hidden && showFriendsSection" :hidden="hidden" />
        <Card v-if="photoPrivacy" class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Кто может комментировать мои фото</div>
            <p class="text-xs text-stone-500 mt-1 leading-relaxed">Галерея в профиле: 5 фото на Free, 6 на Pro, 15 на Business.</p>
            <div class="mt-3 grid gap-1.5">
              <button v-for="o in photoPrivacy.options" :key="o.value" type="button" @click="photoPrivacy.save(o.value)" :disabled="photoPrivacy.saving.value" :class="['flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border text-left transition active:scale-[0.99] disabled:opacity-60', photoPrivacy.value.value === o.value ? 'bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900 dark:border-white' : 'bg-white dark:bg-white/[0.06] border-stone-200 dark:border-white/10 text-stone-700 dark:text-zinc-100']">
                <i :class="[o.icon, 'text-sm']" />
                <span class="text-xs font-bold">{{ o.label }}</span>
                <i v-if="photoPrivacy.value.value === o.value" class="pi pi-check ml-auto text-xs" />
              </button>
            </div>
            <div v-if="photoPrivacy.saving.value" class="text-xs text-stone-400 mt-2">Сохраняем…</div>
            <div v-else-if="photoPrivacy.saved.value" class="text-xs text-emerald-600 mt-2">✓ Сохранено</div>
            <Message v-if="photoPrivacy.error.value" severity="error" :closable="false" class="!mt-2 !rounded-2xl !text-xs">{{ photoPrivacy.error.value }}</Message>
          </template>
        </Card>
        <Card v-if="flowPrivacy && showFlowSection" class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Кто может комментировать мои посты</div>
            <p class="text-xs text-stone-500 mt-1 leading-relaxed">Лента UFlow: читать могут все, писать — по твоему выбору.</p>
            <div class="mt-3 grid gap-1.5">
              <button v-for="o in flowPrivacy.options" :key="o.value" type="button" @click="flowPrivacy.save(o.value)" :disabled="flowPrivacy.saving.value" :class="['flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border text-left transition active:scale-[0.99] disabled:opacity-60', flowPrivacy.value.value === o.value ? 'bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900 dark:border-white' : 'bg-white dark:bg-white/[0.06] border-stone-200 dark:border-white/10 text-stone-700 dark:text-zinc-100']">
                <i :class="[o.icon, 'text-sm']" />
                <span class="text-xs font-bold">{{ o.label }}</span>
                <i v-if="flowPrivacy.value.value === o.value" class="pi pi-check ml-auto text-xs" />
              </button>
            </div>
            <div v-if="flowPrivacy.saving.value" class="text-xs text-stone-400 mt-2">Сохраняем…</div>
            <div v-else-if="flowPrivacy.saved.value" class="text-xs text-emerald-600 mt-2">✓ Сохранено</div>
            <Message v-if="flowPrivacy.error.value" severity="error" :closable="false" class="!mt-2 !rounded-2xl !text-xs">{{ flowPrivacy.error.value }}</Message>
          </template>
        </Card>
        </div>
        <div v-else-if="showUloveSection" class="mt-4 space-y-4">
          <div class="rounded-3xl border-2 border-rose-200 dark:border-rose-900 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/20 p-4">
            <div class="text-sm font-semibold dark:text-white">💘 ULove — платные фишки</div>
            <p class="text-xs text-stone-500 mt-1 leading-relaxed">Включай приватность знакомств. Твой тариф: {{ ulove.planLabel.value }}.</p>
            <Link href="/settings/billing"><Button label="Выбрать тариф" icon="pi pi-crown" rounded size="small" class="mt-3 !bg-white !text-orange-600 !border-0" /></Link>
          </div>
          <div v-for="feature in ulove.features" :key="feature.key" class="flex items-center gap-3 rounded-3xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <span :class="['w-10 h-10 rounded-2xl grid place-items-center shrink-0', feature.iconClass]"><i :class="feature.icon" /></span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-black text-stone-900 dark:text-white">{{ feature.title }} <span :class="feature.plan === 'PRO' ? 'text-amber-500' : 'text-emerald-500'">{{ feature.plan }}</span></div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400">{{ ulove.statusFor(feature.key) }}</div>
            </div>
            <ToggleSwitch :model-value="ulove.flags.value[feature.key]" :disabled="ulove.isLocked(feature.key) || ulove.saving.value" class="shrink-0" @update:model-value="(next:boolean)=>ulove.toggle(feature.key, next)" />
          </div>
          <div v-if="ulove.saving.value" class="text-xs text-stone-400">Сохраняем…</div>
          <Message v-if="!ulove.canPro.value" severity="warn" :closable="false" class="!rounded-2xl !text-xs">Скрытие имени и возраста — только на PRO/Business. Сейчас у тебя {{ planOf(user) }}.</Message>
          <Message v-if="ulove.error.value" severity="error" :closable="false" class="!rounded-2xl !text-xs">{{ ulove.error.value }}</Message>
        </div>
      </div>
    </template>
  </Card>
</template>
