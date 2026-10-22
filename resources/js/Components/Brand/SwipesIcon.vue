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
 * Иконка раздела «Свайпы»: две карточки с сердцем на передней.
 *
 * Задняя карточка и сердце всегда залиты фирменным розово-персиковым
 * градиентом, передняя в активном состоянии заливается currentColor,
 * в неактивном — остаётся контуром. Единый SVG для десктопной
 * и мобильной навигации.
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
        <stop offset="0" stop-color="#FD267D" />
        <stop offset="0.55" stop-color="#F04D9F" />
        <stop offset="1" stop-color="#FF8A5B" />
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
    <path
      d="M10 16.5c-2.1-1.6-3.7-2.95-3.7-4.6 0-1.25 1-2.2 2.2-2.2.7 0 1.25.3 1.5.75.25-.45.8-.75 1.5-.75 1.2 0 2.2.95 2.2 2.2 0 1.65-1.6 3-3.7 4.6z"
      fill="url(#swipes-icon-gradient)"
    />
  </svg>
</template>
