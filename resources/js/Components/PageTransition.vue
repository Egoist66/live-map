<script setup lang="ts">
import { usePageTransition, type PageTransitionPreset } from '@/composables/usePageTransition'

const props = withDefaults(defineProps<{
  preset?: PageTransitionPreset
  appear?: boolean
}>(), {
  preset: 'fade-slide',
  appear: true,
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
