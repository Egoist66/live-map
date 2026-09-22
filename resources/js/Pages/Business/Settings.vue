<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { h } from 'vue'
import BusinessLayout from '@/Layouts/BusinessLayout.vue'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
import ThemeToggle from '@/Components/Brand/ThemeToggle.vue'
import { useBusinessSettings } from '@/composables/useBusinessSettings'
import { useSeo } from '@/composables/useSeo'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ToggleSwitch from 'primevue/toggleswitch'
import BusinessPhotosManager from '@/Components/Features/Business/BusinessPhotosManager.vue'
import BusinessLogoPicker from '@/Components/Features/Business/BusinessLogoPicker.vue'
import type { BusinessDashboard } from '@/types/entities/Business'

defineOptions({
  layout: (createElement: typeof h, child: unknown) => createElement(BusinessLayout, () => child),
})

const props = defineProps<{ initialDashboard?: BusinessDashboard | null }>()

useSeo({ title: 'Настройки бизнеса — UPin', description: 'Тариф, уведомления и приложение компании.', noindex: true })

const settings = useBusinessSettings()

if (props.initialDashboard && !settings.store.dashboard) {
  settings.store.dashboard = props.initialDashboard
  settings.store.profile = props.initialDashboard.business
}

async function onPushToggle(): Promise<void> {
  await settings.push.toggle()
}
</script>

<template>
  <Head title="Настройки бизнеса" />
  <div class="max-w-[760px] mx-auto space-y-3 pb-2">
    <div class="flex flex-wrap items-center gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="text-[22px] sm:text-[26px] font-black tracking-tight dark:text-white">Настройки</h1>
        <p class="text-[13px] text-stone-500 dark:text-zinc-400 mt-0.5">Компания, тариф, уведомления и приложение</p>
      </div>
      <BusinessVerificationBadge :status="settings.profile.value?.verification_status ?? 'draft'" />
    </div>

    <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
      <template #content>
        <div class="flex items-start gap-3">
          <BusinessLogoPicker />
          <div class="min-w-0 flex-1">
            <div class="font-black text-[16px] dark:text-white truncate">{{ settings.profile.value?.name ?? 'Моя компания' }}</div>
            <div class="text-[13px] text-stone-500 dark:text-zinc-400 mt-0.5">
              {{ settings.legalFormLabel(settings.profile.value?.legal_form) }} · УНП {{ settings.profile.value?.unp ?? '—' }}
            </div>
            <div class="text-[13px] text-stone-500 dark:text-zinc-400 truncate">{{ settings.profile.value?.legal_address ?? 'Юридический адрес не указан' }}</div>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Link href="/cabinet/onboarding"><Button label="Реквизиты" icon="pi pi-id-card" outlined class="w-full !rounded-full" /></Link>
          <Link v-if="settings.profile.value?.owner_profile" :href="`/users/${settings.profile.value.owner_profile}`"><Button label="Как видят клиенты" icon="pi pi-eye" outlined class="w-full !rounded-full" /></Link>
        </div>
      </template>
    </Card>

    <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
      <template #content>
        <div class="font-black text-[16px] dark:text-white">Фотографии</div>
        <p class="text-[13px] text-stone-500 dark:text-zinc-400 mt-0.5">Листаются в пинах компании на карте.</p>
        <div class="mt-2">
          <BusinessPhotosManager v-if="settings.profile.value" :business-id="settings.profile.value.id" />
          <div v-else class="text-sm text-stone-500 dark:text-zinc-400">Загружаем профиль…</div>
        </div>
      </template>
    </Card>

    <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
      <template #content>
        <div class="flex items-center gap-3">
          <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white grid place-items-center shrink-0"><i class="pi pi-crown" /></span>
          <div class="min-w-0 flex-1">
            <div class="font-black text-[16px] dark:text-white">Тариф</div>
            <div class="text-[13px] text-stone-500 dark:text-zinc-400">Сейчас: {{ settings.planLabel.value }}</div>
          </div>
        </div>
        <div class="mt-3 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 p-3.5">
          <div class="text-sm font-bold text-indigo-900 dark:text-indigo-200">Визитка бизнеса — $9.99/мес</div>
          <ul class="mt-1.5 space-y-1 text-[13px] text-indigo-900/80 dark:text-indigo-200/80">
            <li>· Бессрочные пины и радиус 50 км</li>
            <li>· Бейдж «Проверено» и адрес, телефон, часы</li>
            <li>· Статистика просмотров и маршрутов</li>
          </ul>
        </div>
      </template>
    </Card>

    <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
      <template #content>
        <div class="font-black text-[16px] dark:text-white">Уведомления</div>
        <p class="text-[13px] text-stone-500 dark:text-zinc-400 mt-0.5">Сообщения клиентов и статус проверки — даже при закрытой вкладке.</p>
        <div class="mt-3 flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-4 py-3">
          <i class="pi pi-bell text-lg text-indigo-500 shrink-0" />
          <div class="flex-1 text-sm min-w-0">
            <p class="font-semibold dark:text-white">Системные уведомления</p>
            <p class="text-xs text-stone-500 dark:text-zinc-400">
              <span v-if="settings.push.permission.value === 'denied'">заблокированы в браузере</span>
              <span v-else-if="settings.push.subscribed.value">включены</span>
              <span v-else>выключены</span>
            </p>
            <p v-if="settings.push.pushError.value" class="text-xs text-red-500 mt-1">{{ settings.push.pushError.value }}</p>
          </div>
          <ToggleSwitch
            :model-value="settings.push.subscribed.value"
            :disabled="settings.push.loading.value || settings.push.permission.value === 'denied'"
            @update:model-value="onPushToggle"
          />
        </div>
      </template>
    </Card>

    <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
      <template #content>
        <div class="font-black text-[16px] dark:text-white">Внешний вид</div>
        <div class="mt-3 flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-4 py-3">
          <i class="pi pi-palette text-lg text-indigo-500 shrink-0" />
          <div class="flex-1 text-sm min-w-0">
            <p class="font-semibold dark:text-white">Тёмная тема</p>
            <p class="text-xs text-stone-500 dark:text-zinc-400">{{ settings.isDark.value ? 'включена' : 'выключена' }}</p>
          </div>
          <ThemeToggle />
        </div>
      </template>
    </Card>

    <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
      <template #content>
        <div class="font-black text-[16px] dark:text-white">Приложение</div>
        <div class="mt-3 flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-4 py-3">
          <i class="pi pi-mobile text-lg text-indigo-500 shrink-0" />
          <div class="flex-1 text-sm min-w-0">
            <p class="font-semibold dark:text-white">Режим приложения</p>
            <p class="text-xs text-stone-500 dark:text-zinc-400">
              <span v-if="settings.pwa.standalone.value">установлено как приложение</span>
              <span v-else>открыто в браузере</span>
              <span v-if="!settings.pwa.online.value"> · сейчас оффлайн</span>
            </p>
          </div>
          <Button
            v-if="!settings.pwa.standalone.value"
            :label="settings.guide.installing.value ? '…' : 'Установить'"
            size="small"
            rounded
            class="!bg-indigo-500 !border-0"
            :disabled="settings.guide.installing.value"
            @click="settings.guide.install()"
          />
        </div>
        <Button
          label="Очистить оффлайн-кэш карты"
          icon="pi pi-database"
          text
          rounded
          size="small"
          class="mt-2"
          @click="settings.pwa.clearCache()"
        />
      </template>
    </Card>
  </div>
</template>
