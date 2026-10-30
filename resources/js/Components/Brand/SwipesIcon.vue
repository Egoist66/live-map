<script setup lang="ts">
/**
 * SwipesIconAccentProps — пропсы иконки раздела «Свайпы».
 *
 * @property size px-высота/ширина иконки (по умолчанию 18)
 * @property active активный раздел: передняя карточка залита currentColor
 * @property className доп. Tailwind-классы на корне
 */
type SwipesIconAccentProps = {
  size?: number
  active?: boolean
  className?: string
}

/**
 * Иконка раздела «Свайпы»: две карточки (колода для свайпа).
 *
 * Задняя карточка всегда залита фирменным розово-персиковым градиентом,
 * передняя в активном состоянии заливается currentColor, в неактивном —
 * остаётся контуром. Единый SVG для десктопной и мобильной навигации.
 *
 * @example <SwipesIcon :size="18" active />
 */
const props = withDefaults(defineProps<SwipesIconAccentProps>(), { size: 18, active: false })
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    :class="props.className"
  >
    <defs>
      <linearGradient id="swipes-icon-gradient" x1="4" y1="5" x2="21" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#f43f5e" />
        <stop offset="0.55" stop-color="#ec4899" />
        <stop offset="1" stop-color="#d946ef" />
      </linearGradient>
    </defs>
    <rect
      x="12.8"
      y="5"
      width="8"
      height="11.5"
      rx="2"
      transform="rotate(10 16.8 10.75)"
      fill="url(#swipes-icon-gradient)"
    />
    <rect
      x="4.5"
      y="6"
      width="11"
      height="14"
      rx="2.5"
      :fill="props.active ? 'currentColor' : 'none'"
      :stroke="props.active ? 'none' : 'currentColor'"
      stroke-width="2"
      stroke-linejoin="round"
    />
  </svg>
</template>
