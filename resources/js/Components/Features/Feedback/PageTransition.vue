<script setup lang="ts">
import { usePageTransition, type PageTransitionPreset } from '@/composables/usePageTransition'

const props = withDefaults(defineProps<{
  preset?: PageTransitionPreset
  appear?: boolean
}>(), {
  preset: 'fade-slide',
  // appear выключен сознательно: appear-transition поверх SSR-гидратации
  // роняет Teleport внутри страницы (`insertBefore of null`), а визуальной
  // пользы на первом кадре нет — контент уже отрисован сервером.
  appear: false,
})

const { pageKey, transitionName, transitionMode } = usePageTransition({ preset: props.preset })
</script>

<template>
  <Transition :name="transitionName" :mode="transitionMode" :appear="appear">
    <div :key="pageKey" class="page-transition-wrapper">
      <slot />
    </div>
  </Transition>
</template>
