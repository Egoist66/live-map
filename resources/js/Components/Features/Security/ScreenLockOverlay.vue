<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { route } from '@/route'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputOtp from 'primevue/inputotp'
import Message from 'primevue/message'
import { useScreenLock } from '@/composables/useScreenLock'
import { useScreenLockReset } from '@/composables/useScreenLockReset'
import { avatarSrcFor } from '@/composables/useAvatar'

const lock = useScreenLock()
const page = usePage()
const user = computed(() => (page.props.auth as any)?.user)
const avatarSrc = computed(() => avatarSrcFor(user.value))

const input = ref('')
const shakeKey = ref(0)
const showPass = ref(false)
const leaving = ref(false)
const resetOpen = ref(false)
const textInput = ref<any>(null)

const reset = useScreenLockReset(async (resetAt) => {
  await lock.resetByRemote(resetAt)
  resetOpen.value = false
})

const need = computed(() => (lock.kind.value === 'alpha8' ? 8 : 4))
const dots = computed(() => Array.from({ length: Math.max(input.value.length, 0) }))

function press(d: string) {
  if (!lock.locked.value || lock.verifying.value) return
  if (input.value.length >= 8) return
  input.value += d
  if (input.value.length === need.value) void submit()
}

function backspace() {
  input.value = input.value.slice(0, -1)
}

function cleanInput() {
  input.value = input.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  if (input.value.length === need.value) void submit()
}

async function submit() {
  if (input.value.length < need.value || lock.verifying.value) return
  const ok = await lock.verify(input.value)
  if (ok) input.value = ''
  else {
    shakeKey.value++
    setTimeout(() => { input.value = '' }, 450)
  }
}

function onKey(e: KeyboardEvent) {
  if (!lock.locked.value) return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  const okKey = lock.kind.value === 'alpha8' ? /^[A-Za-z0-9]$/.test(e.key) : /^[0-9]$/.test(e.key)
  if (okKey) press(e.key)
  else if (e.key === 'Backspace') backspace()
  else if (e.key === 'Enter') void submit()
}

function openReset() {
  reset.backToChoice()
  resetOpen.value = true
}

async function logout() {
  if (leaving.value) return
  leaving.value = true
  // Выход не должен стирать настройку устройства: локер переживает
  // logout/login тем же аккаунтом, а чужой таймер гасит useAuthSession.
  router.post(route('logout'))
}

watch(() => lock.locked.value, (v) => {
  if (typeof window === 'undefined') return
  if (v) {
    input.value = ''
    showPass.value = false
    window.addEventListener('keydown', onKey)
    if (lock.kind.value === 'alpha8') setTimeout(() => { try { textInput.value?.focus() } catch {} }, 350)
  } else {
    window.removeEventListener('keydown', onKey)
    resetOpen.value = false
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
  reset.dispose()
})
</script>
<template>
  <Teleport to="body">
    <Transition name="lock-fade">
      <div v-if="lock.locked.value" data-lock-overlay data-lock-scroll class="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-[#0f1420]/70 backdrop-blur-2xl">
        <div class="min-h-full grid place-items-center p-4">
          <div :key="shakeKey" :class="['w-full max-w-[340px] rounded-[28px] bg-white dark:bg-zinc-900 border border-white/10 shadow-2xl px-6 py-8 text-center', shakeKey && 'lock-shake']">
            <Avatar :image="avatarSrc" shape="circle" size="xlarge" class="!w-20 !h-20 mx-auto shadow-soft" />
            <div class="mt-4 font-black text-lg tracking-tight dark:text-white truncate">{{ user?.name || 'ULove' }}</div>
            <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">{{ lock.kind.value === 'alpha8' ? 'Введи пароль · 8 символов' : 'Введи PIN · 4 цифры' }}</p>
            <div v-if="lock.kind.value === 'alpha8'" class="mt-5 relative">
              <input ref="textInput" v-model="input" @input="cleanInput" @keydown.enter.prevent="submit" :type="showPass ? 'text' : 'password'" maxlength="8" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="••••••••" class="w-full min-h-[52px] px-4 pr-12 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-center text-lg font-black tracking-[0.3em] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition dark:text-white" />
              <button type="button" @click="showPass = !showPass" class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 transition" :aria-label="showPass ? 'Скрыть' : 'Показать'">
                <i :class="showPass ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
              </button>
            </div>
            <div v-else class="mt-5 flex items-center justify-center gap-2.5 min-h-[16px]">
              <span v-for="(_, i) in dots" :key="i" class="w-3.5 h-3.5 rounded-full bg-ink-900 dark:bg-white transition-all" />
              <span v-if="!dots.length" class="text-xs text-stone-400">••••</span>
            </div>
            <p v-if="lock.error.value" class="mt-2 text-xs font-semibold text-red-500">{{ lock.error.value }}</p>
            <p v-else class="mt-2 text-[11px] text-stone-400">Код проверяется на этом устройстве</p>
            <div v-if="lock.kind.value !== 'alpha8'" class="mt-5 grid grid-cols-3 gap-2.5">
              <button v-for="n in 9" :key="n" type="button" @click="press(String(n))" class="h-14 rounded-2xl bg-stone-100 dark:bg-zinc-800 text-xl font-bold dark:text-white hover:bg-stone-200 dark:hover:bg-zinc-700 active:scale-95 transition">
                {{ n }}
              </button>
              <span />
              <button type="button" @click="press('0')" class="h-14 rounded-2xl bg-stone-100 dark:bg-zinc-800 text-xl font-bold dark:text-white hover:bg-stone-200 dark:hover:bg-zinc-700 active:scale-95 transition">0</button>
              <button type="button" @click="backspace" class="h-14 rounded-2xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 active:scale-95 transition grid place-items-center">
                <i class="pi pi-delete-left text-lg dark:text-white" />
              </button>
            </div>
            <Button @click="submit" :loading="lock.verifying.value" :disabled="input.length < need" label="Разблокировать" rounded class="w-full mt-5 !bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white !shadow-glow" />
            <button type="button" @click="openReset" class="mt-3 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 transition">Забыл код? Сбросить</button>
          </div>
        </div>

        <Dialog
          v-model:visible="resetOpen"
          modal
          :draggable="false"
          :closable="!reset.sending.value && !reset.verifying.value"
          header="Сброс скринлокера"
          :style="{ width: '400px', maxWidth: '94vw' }"
          :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-zinc-900 dark:!text-white' }, content: { class: '!px-5 !py-4 dark:!bg-zinc-900' }, footer: { class: '!px-5 !pb-5 !pt-1 !border-0 dark:!bg-zinc-900' } }"
        >
          <div class="flex items-start gap-3">
            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300"><i class="pi pi-unlock" /></span>
            <p class="text-sm text-stone-600 dark:text-zinc-300">
              {{ reset.step.value === 'code' ? 'Введи 6-значный код из письма — код блокировки на этом устройстве будет стёрт.' : 'Подтверди, что аккаунт твой: пришлём код на почту или сбросим через Telegram-бота.' }}
            </p>
          </div>

          <template v-if="reset.step.value === 'choice'">
            <div class="mt-4 space-y-2">
              <Button
                v-if="reset.canUseEmail.value"
                label="Получить код на почту"
                icon="pi pi-envelope"
                rounded
                class="w-full !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-orange-400 !border-0 !text-white !shadow-lg !shadow-pink-500/25 active:!scale-[0.98] transition"
                :loading="reset.sending.value"
                @click="reset.requestCode()"
              />
              <a
                v-if="reset.isTelegramLinked.value"
                :href="reset.botLink.value"
                target="_blank"
                rel="noopener"
                class="flex items-center justify-center gap-2 w-full min-h-[42px] rounded-full border border-pink-200 dark:border-pink-500/30 text-sm font-semibold text-pink-600 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-500/10 active:scale-[0.98] transition"
              >
                <i class="pi pi-send" />
                Сбросить через @{{ reset.botUsername.value }}
              </a>
              <p v-else-if="!reset.canUseEmail.value" class="text-[11px] text-stone-400 text-center">Нет рабочей почты и Telegram не привязан — привяжи Telegram в настройках.</p>
              <p v-else class="text-[11px] text-stone-400 text-center">Telegram не привязан — используй почту.</p>
            </div>
            <Message v-if="reset.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ reset.error.value }}</Message>
          </template>

          <template v-else>
            <div class="mt-3 text-xs text-stone-500 dark:text-zinc-400">Код отправлен на <b class="dark:text-zinc-200">{{ user?.email }}</b>. Действует 10 минут.</div>
            <div class="mt-3 flex justify-center">
              <InputOtp v-model="reset.code.value" :length="6" integerOnly class="otp-pink" />
            </div>
            <p v-if="reset.info.value" class="mt-2 text-center text-[11px] font-semibold text-pink-600 dark:text-pink-300">{{ reset.info.value }}</p>
            <Message v-if="reset.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ reset.error.value }}</Message>
            <div class="mt-2 flex flex-wrap justify-center gap-2">
              <Button
                :label="reset.cooldown.value > 0 ? `Отправить снова (${reset.cooldown.value}с)` : 'Отправить снова'"
                link
                size="small"
                class="!text-pink-600 dark:!text-pink-300 !font-semibold"
                :disabled="reset.cooldown.value > 0 || reset.sending.value"
                @click="reset.requestCode()"
              />
              <Button label="Назад" link size="small" class="!text-pink-600 dark:!text-pink-300 !font-semibold" @click="reset.backToChoice()" />
            </div>
          </template>

          <template #footer>
            <div class="flex flex-col gap-2 w-full">
              <Button
                v-if="reset.step.value === 'code'"
                label="Сбросить код"
                icon="pi pi-check"
                rounded
                class="w-full !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-orange-400 !border-0 !text-white !shadow-lg !shadow-pink-500/25 active:!scale-[0.98] transition"
                :loading="reset.verifying.value"
                :disabled="!reset.canSubmit.value"
                @click="reset.verifyCode()"
              />
              <button type="button" class="text-xs text-stone-400 hover:text-pink-600 dark:hover:text-pink-300 transition" @click="logout">Выйти из аккаунта</button>
            </div>
          </template>
        </Dialog>
      </div>
    </Transition>
  </Teleport>
</template>
<style scoped>
.lock-fade-enter-active, .lock-fade-leave-active { transition: opacity .25s ease }
.lock-fade-enter-from, .lock-fade-leave-to { opacity: 0 }
.lock-shake { animation: lock-shake .4s ease }
@keyframes lock-shake {
  0%, 100% { transform: translateX(0) }
  20% { transform: translateX(-10px) }
  40% { transform: translateX(9px) }
  60% { transform: translateX(-6px) }
  80% { transform: translateX(4px) }
}

/* OTP в диалоге сброса — в фирменном розовом: дефолтная тема PrimeVue
   красит фокус первичным (фиолетовым) цветом, а вся модалка розовая.
   Dialog телепортируется в body, поэтому правила через :deep от
   не-телепортируемого scoped-компонента доехать до него должны: slot-контент
   этого компонента хранит data-v атрибуты даже за пределами приложения. */
.otp-pink :deep(.p-inputotp-input) {
  border-radius: 12px;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.otp-pink :deep(.p-inputotp-input:enabled:focus) {
  border-color: #ec4899 !important;
  box-shadow: 0 0 0 2px rgb(236 72 153 / 0.2) !important;
  outline: none !important;
}
/* Уточнение радиуса под скруглённую модалку и тач-тарабельность:
   сегменты не сжирают палец, между ними хватает воздуха. */
@media (max-width: 640px) {
  .otp-pink :deep(.p-inputotp-input) {
    width: 2.6rem !important;
    height: 3rem !important;
    font-size: 1.15rem !important;
  }
}
</style>
