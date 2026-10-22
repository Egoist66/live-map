<script setup lang="ts">
import { useBranding } from '@/composables/useBranding'

/**
 * Бренд-марка приложения — иконка из админки или дефолтный ULove.
 *
 * URL приходит из общих Inertia-пропсов `branding`, поэтому смена
 * логотипа в админке сразу обновляет все места без пересборки.
 * Компонент отвечает только за картинку: заливку в контейнер делает
 * родительский слот (`overflow-hidden` + скругление).
 */
const { appIconUrl } = useBranding()
</script>
<template>
  <img
    :src="appIconUrl"
    alt=""
    aria-hidden="true"
    role="presentation"
    class="h-full w-full object-cover"
    loading="eager"
    decoding="async"
  />
</template>
