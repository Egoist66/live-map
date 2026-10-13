<script setup lang="ts">
import Button from 'primevue/button'

/**
 * Пропсы верхней админ-панели (как `#wpadminbar` в WordPress).
 */
interface AdminTopbarProps {
  /** Крутится ли обновление статистики (спиннер на кнопке). */
  refreshLoading?: boolean
}

withDefaults(defineProps<AdminTopbarProps>(), {
  refreshLoading: false,
})

const emit = defineEmits<{
  /** Бургер: открыть Drawer-меню (мобила). */
  (event: 'menu'): void
  /** Стрелка сворачивания сайдбара (десктоп). */
  (event: 'collapse'): void
  /** Клик «На сайт». */
  (event: 'home'): void
  /** Клик «Обновить данные». */
  (event: 'refresh'): void
  /** Клик «Мой профиль». */
  (event: 'profile'): void
  /** Клик «Закрыть панель». */
  (event: 'lock'): void
}>()
</script>

<template>
  <header class="wp-adminbar native-safe-top sticky top-0 z-40 bg-[#1d2327] text-[#eee]" aria-label="Верхняя панель админки">
    <div class="mx-auto flex h-14 max-w-[1600px] items-center gap-1.5 px-2 sm:gap-2 sm:px-4">
      <Button
        icon="pi pi-bars"
        text
        rounded
        aria-label="Открыть меню"
        class="!h-10 !w-10 !p-0 !text-[#eee] hover:!bg-[#2c3338] hover:!text-white lg:!hidden shrink-0"
        @click="emit('menu')"
      />
      <Button
        icon="pi pi-angle-double-left"
        text
        rounded
        aria-label="Свернуть боковое меню"
        title="Свернуть меню"
        class="!hidden !h-10 !w-10 !p-0 !text-[#a7aaad] hover:!bg-[#2c3338] hover:!text-white lg:!inline-flex shrink-0"
        @click="emit('collapse')"
      />

      <button
        type="button"
        class="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#2c3338]"
        aria-label="ULove — консоль администратора"
        @click="emit('home')"
      >
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#2271b1] text-sm font-black text-white">
          U
        </span>
        <span class="hidden min-w-0 sm:block">
          <span class="block truncate text-sm font-black leading-tight text-white">ULove · Консоль</span>
          <span class="block truncate text-[11px] leading-tight text-[#a7aaad]">панель администратора</span>
        </span>
      </button>

      <span class="flex-1" />

      <Button
        label="На сайт"
        icon="pi pi-external-link"
        text
        size="small"
        class="!hidden !text-[#eee] hover:!bg-[#2c3338] hover:!text-white md:!inline-flex !text-[13px]"
        @click="emit('home')"
      />
      <Button
        icon="pi pi-refresh"
        :loading="refreshLoading"
        text
        rounded
        size="small"
        aria-label="Обновить данные"
        title="Обновить данные"
        class="!h-10 !w-10 !p-0 !text-[#eee] hover:!bg-[#2c3338] hover:!text-white shrink-0"
        @click="emit('refresh')"
      />
      <Button
        label="Профиль"
        icon="pi pi-user"
        text
        size="small"
        class="!hidden !text-[#eee] hover:!bg-[#2c3338] hover:!text-white sm:!inline-flex !text-[13px]"
        @click="emit('profile')"
      />
      <Button
        icon="pi pi-user"
        text
        rounded
        aria-label="Мой профиль"
        class="!h-10 !w-10 !p-0 !text-[#eee] hover:!bg-[#2c3338] hover:!text-white sm:!hidden shrink-0"
        @click="emit('profile')"
      />
      <span class="h-6 w-px bg-white/15" aria-hidden="true" />
      <Button
        icon="pi pi-lock"
        text
        rounded
        size="small"
        aria-label="Закрыть панель до следующего ввода пароля"
        title="Закрыть панель"
        class="!h-10 !w-10 !p-0 !text-[#a7aaad] hover:!bg-[#2c3338] hover:!text-white shrink-0"
        @click="emit('lock')"
      />
    </div>
  </header>
</template>

<style scoped>
.wp-adminbar {
  color-scheme: dark;
}
</style>
