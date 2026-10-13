<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useRouteErrorBoundary } from '@/composables/useRouteErrorBoundary'

/**
 * Тонкая обёртка над `useRouteErrorBoundary`: только отображение.
 *
 * Вся логика (перехват, авто-ретрай, сброс при навигации) — в хуке
 * по Правилу №1. Ставится вокруг контента лейаута: падение страницы
 * показывает панель восстановления вместо белого экрана, корневой
 * инстанс при этом не отравляется — кнопка «назад» продолжает работать.
 */
const boundary = useRouteErrorBoundary()
</script>

<template>
  <slot v-if="!boundary.routeError.value" />
  <div v-else class="mx-auto w-full max-w-[560px] px-4 py-10" role="alert">
    <Message severity="error" :closable="false" class="!rounded-3xl">
      <div class="flex flex-col items-center gap-2 py-2 text-center">
        <span class="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-500">
          <i class="pi pi-exclamation-triangle text-xl" />
        </span>
        <div class="text-base font-black text-stone-900 dark:text-white">Не получилось открыть страницу</div>
        <div class="max-w-[380px] text-sm text-stone-500 dark:text-zinc-400">
          Похоже, вышла новая версия или страница загрузилась не полностью. Данные не потеряны.
        </div>
        <div class="mt-2 flex flex-wrap justify-center gap-2">
          <Button label="Повторить" icon="pi pi-refresh" rounded size="small" @click="boundary.reset()" />
          <Button label="Обновить страницу" icon="pi pi-download" rounded outlined size="small" severity="secondary" @click="boundary.hardReload()" />
        </div>
      </div>
    </Message>
  </div>
</template>
