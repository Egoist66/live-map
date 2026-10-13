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
  <!-- Grid-стек вместо потока: входящее и уходящее дерево лежат в одной
       ячейке друг ПОД другом (кроссфейд), а не друг ЗА другом. Без этого
       на входе в высокие страницы (свайпы = 100dvh-лок) новый экран
       сначала рисовался под старым за фолдом, а после unmount старого
       прыгал наверх — топбар «дёргался снизу вверх». Высота стека =
       max(старое, новое), скролл не скачет. -->
  <div class="page-transition-stack">
    <Transition :name="transitionName" :appear="appear" @before-leave="blurActiveElement">
      <div :key="pageKey" class="page-transition-wrapper page-transition-cell">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page-transition-stack {
  display: grid;
}
.page-transition-cell {
  grid-area: 1 / 1;
  min-width: 0;
}
</style>
