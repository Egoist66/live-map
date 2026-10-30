<script setup lang="ts">
import { computed, onMounted } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useSessions } from '@/composables/useSessions'
import { useAnchorScroll } from '@/composables/useAnchorScroll'

const sessions = useSessions()
useAnchorScroll('sessions')

onMounted(() => {
  void sessions.load()
})

/**
 * Сколько устройств ждут подтверждения «Это я».
 */
const pendingDevices = computed(() => sessions.devices.value.filter((d) => !d.trusted && !d.blocked).length)

/**
 * Иконка под класс устройства.
 *
 * @param device desktop|phone|tablet
 * @returns primeicon-класс
 */
function deviceIcon(device: string): string {
  if (device === 'phone') return 'pi pi-mobile'
  if (device === 'tablet') return 'pi pi-tablet'
  return 'pi pi-desktop'
}

/**
 * Короткая дата активности сеанса.
 *
 * @param iso ISO-дата last_activity
 * @returns локализованная строка или заглушка
 */
function fmtActivity(iso: string | null): string {
  if (!iso) return 'давно'
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
</script>
<template>
  <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <span id="sessions" class="block scroll-mt-28" aria-hidden="true" />
      <div class="flex items-center gap-2 flex-wrap">
        <div class="font-black dark:text-white">Сеансы</div>
        <Tag v-if="sessions.items.value.length" :value="`активно: ${sessions.items.value.length}`" severity="contrast" class="!text-[9px]" />
        <Button label="обновить" link size="small" class="ml-auto !text-xs !px-1" @click="sessions.load()" />
      </div>
      <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Кто, откуда и с чего зашёл в аккаунт. Чужой сеанс можно завершить — устройство вылетит из аккаунта. О новом устройстве предупредим в колокольчик и Telegram.</p>
      <div v-if="sessions.loading.value" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else-if="!sessions.items.value.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">Активных сеансов нет</div>
      <div v-else class="mt-3 space-y-2">
        <div v-for="s in sessions.items.value" :key="s.id" class="rounded-2xl border border-stone-200 dark:border-white/10 p-3" :class="s.is_current ? '!border-emerald-300 dark:!border-emerald-800' : ''">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-10 h-10 rounded-2xl grid place-items-center shrink-0" :class="s.is_current ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-stone-100 text-stone-500 dark:bg-white/10 dark:text-zinc-300'">
              <i :class="deviceIcon(s.device)" class="text-base" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-[13px] font-semibold truncate dark:text-white">{{ s.label }}
                <Tag v-if="s.is_current" value="это вы" severity="success" class="!text-[9px] ml-1" />
              </div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">IP {{ s.ip || 'скрыт' }} · активен {{ fmtActivity(s.last_activity_at) }}</div>
            </div>
            <Button
              v-if="!s.is_current"
              @click="sessions.closeOne(s.id)"
              :loading="sessions.closingId.value === s.id"
              label="Завершить"
              size="small"
              rounded
              outlined
              severity="danger"
              class="!text-xs !py-1 shrink-0"
            />
          </div>
        </div>
      </div>
      <Button
        v-if="sessions.items.value.some((s) => !s.is_current)"
        @click="sessions.closeOthers()"
        :loading="sessions.closingOthers.value"
        label="Завершить все остальные"
        size="small"
        rounded
        outlined
        severity="danger"
        class="mt-3 !text-xs"
      />
      <div class="mt-5 pt-4 border-t border-stone-100 dark:border-white/10">
        <div class="flex items-center gap-2 flex-wrap">
          <div class="font-black dark:text-white text-[15px]">Устройства</div>
          <Tag v-if="pendingDevices" :value="`требуют подтверждения: ${pendingDevices}`" severity="warn" class="!text-[9px]" />
        </div>
        <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Подтвердите свои телефон и ноутбук кнопкой «Это я» — чужие гасите или блокируйте навсегда.</p>
        <div v-if="!sessions.devices.value.length" class="py-4 text-center text-sm text-stone-400 dark:text-zinc-500">Устройств пока нет</div>
        <div v-else class="mt-3 space-y-2">
          <div v-for="d in sessions.devices.value" :key="d.id" class="rounded-2xl border p-3" :class="d.blocked ? '!border-red-300 dark:!border-red-800' : (!d.trusted ? '!border-amber-300 dark:!border-amber-800' : 'border-stone-200 dark:border-white/10')">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-10 h-10 rounded-2xl grid place-items-center shrink-0 bg-stone-100 text-stone-500 dark:bg-white/10 dark:text-zinc-300">
                <i :class="deviceIcon(d.device)" class="text-base" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="text-[13px] font-semibold truncate dark:text-white">{{ d.label }}</div>
                <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">
                  <template v-if="d.ip">IP {{ d.ip }} · </template>{{ [d.city, d.country].filter(Boolean).join(', ') || 'место неизвестно' }}
                </div>
              </div>
              <div class="flex gap-1 shrink-0 items-center">
                <Tag v-if="d.blocked" value="заблокировано" severity="danger" class="!text-[9px]" />
                <template v-else>
                  <Tag v-if="d.is_current" value="это устройство" severity="success" class="!text-[9px]" />
                  <Tag v-else-if="!d.trusted" value="подтвердите" severity="warn" class="!text-[9px]" />
                </template>
              </div>
            </div>
            <div class="mt-2 flex gap-1.5 flex-wrap">
              <Button
                v-if="!d.trusted && !d.blocked"
                @click="sessions.deviceAction(d.id, 'trust')"
                :loading="sessions.actingDeviceId.value === d.id"
                label="Это я"
                icon="pi pi-check"
                size="small"
                rounded
                severity="success"
                class="!text-xs !py-1"
              />
              <Button
                v-if="d.has_session && !d.is_current && !d.blocked"
                @click="sessions.deviceAction(d.id, 'terminate')"
                :loading="sessions.actingDeviceId.value === d.id"
                label="Завершить сеанс"
                icon="pi pi-sign-out"
                size="small"
                rounded
                outlined
                severity="warn"
                class="!text-xs !py-1"
              />
              <Button
                v-if="!d.blocked && !d.is_current"
                @click="sessions.deviceAction(d.id, 'block')"
                :loading="sessions.actingDeviceId.value === d.id"
                label="Заблокировать"
                icon="pi pi-ban"
                size="small"
                rounded
                outlined
                severity="danger"
                class="!text-xs !py-1"
              />
              <Button
                v-if="d.blocked"
                @click="sessions.deviceAction(d.id, 'unblock')"
                :loading="sessions.actingDeviceId.value === d.id"
                label="Разблокировать"
                size="small"
                rounded
                outlined
                severity="secondary"
                class="!text-xs !py-1"
              />
            </div>
          </div>
        </div>
      </div>
      <Message v-if="sessions.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ sessions.error.value }}</Message>
    </template>
  </Card>
</template>
