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

const { pageKey, transitionName, blurActiveElement } = usePageTransition({ preset: props.preset })
</script>

<template>
  <!-- Без mode="out-in": out-in держит старое дерево в leave-лимбо, где
       vee-validate/PrimeVue-эффекты патчат уже разобранные Teleport/Portal
       (`insertBefore of null`), а брошенное исключение гасит саму анимацию.
       Одновременный кроссфейд безопасен и реально виден между экранами. -->
  <Transition :name="transitionName" :appear="appear" @before-leave="blurActiveElement">
    <div :key="pageKey" class="page-transition-wrapper">
      <slot />
    </div>
  </Transition>
</template>
