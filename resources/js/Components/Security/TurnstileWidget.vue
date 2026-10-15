<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useTurnstile } from '@/composables/useTurnstile'
import Message from 'primevue/message'

/**
 * Виджет капчи Cloudflare Turnstile (display-компонент).
 *
 * Вся логика — в `useTurnstile` (Правило №1): здесь только контейнер
 * и прокидка токена наружу через `v-model:token`. Когда капча выключена
 * на бэке (нет ключей) — не рендерит ничего.
 *
 * Исключение из Правила №5: у PrimeVue нет капчи, iframe грузится
 * с challenges.cloudflare.com (разрешён в CSP).
 */
const props = defineProps<{ token: string }>()

const emit = defineEmits<{
  (e: 'update:token', value: string): void
}>()

const t = useTurnstile()
const box = ref<HTMLElement | null>(null)

watch(
  () => t.token.value,
  (next) => {
    if (next !== props.token) {
      emit('update:token', next)
    }
  },
)

// Родитель сбросил токен (новая попытка) — сбросить и виджет,
// иначе в форме пусто, а Cloudflare ждёт старый одноразовый токен.
watch(
  () => props.token,
  (next) => {
    if (next === '' && t.token.value !== '') {
      t.reset()
    }
  },
)

/**
 * Сбросить виджет наружу (после отправки / при 422 captcha_token).
 */
function reset(): void {
  t.reset()
  emit('update:token', '')
}

defineExpose({ reset })

onMounted(async () => {
  t.container.value = box.value
  await t.render()
})
</script>

<template>
  <div v-if="t.captchaEnabled.value">
    <div ref="box" class="turnstile-box min-h-[65px]"></div>
    <Message v-if="t.loadError.value" severity="warn" :closable="false" class="mt-2 !rounded-xl !py-1 !text-xs">
      {{ t.loadError.value }}
    </Message>
  </div>
</template>

<style scoped>
.turnstile-box {
  display: flex;
  justify-content: flex-start;
}
</style>
