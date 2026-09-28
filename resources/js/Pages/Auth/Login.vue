<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Message from 'primevue/message'
import LoginForm from '@/Components/Features/Auth/LoginForm.vue'
import RegisterForm from '@/Components/Features/Auth/RegisterForm.vue'
import { useAuthMode, type AuthMode } from '@/composables/useAuthMode'

const props = defineProps<{ canResetPassword: boolean; status?: string | null; mode?: AuthMode }>()

const { isLogin, transitionName, setMode } = useAuthMode(props.mode)
</script>

<template>
  <Head title="Вход и регистрация — ULove" />
  <Message v-if="status" severity="success" class="mb-4 w-full">{{ status }}</Message>

  <div role="tablist" aria-label="Вход или регистрация" class="auth-mode-toggle relative grid grid-cols-2 gap-0 rounded-full bg-stone-100 dark:bg-zinc-800 p-1">
    <span aria-hidden="true" class="auth-mode-thumb absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 shadow-lg shadow-rose-500/30 transition-transform duration-300 ease-out" :class="isLogin ? 'translate-x-0' : 'translate-x-full'" />
    <Button
      role="tab"
      :aria-selected="isLogin"
      text
      rounded
      label="Вход"
      icon="pi pi-sign-in"
      class="auth-mode-btn relative z-10 min-h-[48px] !border-0 !shadow-none"
      :class="isLogin ? '!text-white' : '!text-stone-500 dark:!text-zinc-400'"
      @click="setMode('login')"
    />
    <Button
      role="tab"
      :aria-selected="!isLogin"
      text
      rounded
      label="Регистрация"
      icon="pi pi-user-plus"
      class="auth-mode-btn relative z-10 min-h-[48px] !border-0 !shadow-none"
      :class="!isLogin ? '!text-white' : '!text-stone-500 dark:!text-zinc-400'"
      @click="setMode('register')"
    />
  </div>

  <div class="mt-2 min-w-0">
    <Transition :name="transitionName" mode="out-in">
      <div v-if="isLogin" key="login" role="tabpanel">
        <LoginForm :can-reset-password="canResetPassword" />
      </div>
      <div v-else key="register" role="tabpanel">
        <RegisterForm />
      </div>
    </Transition>
  </div>

  <p class="mt-5 text-center text-[13px] leading-relaxed text-stone-500 dark:text-zinc-400">
    <template v-if="isLogin">Нет аккаунта? <button type="button" class="font-semibold text-ink-900 dark:text-white hover:underline" @click="setMode('register')">Создай анкету</button> — это быстро 💘</template>
    <template v-else>Уже есть аккаунт? <button type="button" class="font-semibold text-ink-900 dark:text-white hover:underline" @click="setMode('login')">Войти</button></template>
  </p>
</template>

<style scoped>
/* Плавная смена форм: fade + сдвиг по направлению тоггла.
   Только opacity + transform (GPU), без blur — не фризит мобилы.
   Длительность короче карточных переходов, форма не «плавает». */
.auth-swap-r-enter-active,
.auth-swap-r-leave-active,
.auth-swap-l-enter-active,
.auth-swap-l-leave-active {
  transition: opacity 240ms ease-out, transform 260ms cubic-bezier(0.33, 1, 0.68, 1);
}
.auth-swap-r-enter-from,
.auth-swap-l-leave-to {
  opacity: 0;
  transform: translateX(28px);
}
.auth-swap-r-leave-to,
.auth-swap-l-enter-from {
  opacity: 0;
  transform: translateX(-28px);
}

/* Кнопки тоггла: текст PrimeVue Button, подложка — thumb.
   Убираем фоновые состояния наведения, чтобы не спорили с thumb. */
.auth-mode-btn {
  background: transparent !important;
}
.auth-mode-btn:hover {
  background: transparent !important;
}

@media (prefers-reduced-motion: reduce) {
  .auth-mode-thumb,
  .auth-swap-r-enter-active,
  .auth-swap-r-leave-active,
  .auth-swap-l-enter-active,
  .auth-swap-l-leave-active {
    transition: none !important;
  }
}
</style>
