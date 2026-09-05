<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import { useScreenLock } from '@/composables/useScreenLock'
import { avatarSrcFor } from '@/composables/useAvatar'

const lock = useScreenLock()
const page = usePage()
const user = computed(() => (page.props.auth as any)?.user)
const avatarSrc = computed(() => avatarSrcFor(user.value))

const input = ref('')
const shakeKey = ref(0)
const showPass = ref(false)
const textInput = ref<any>(null)

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

function logout() {
  router.post(route('logout'))
}

watch(() => lock.locked.value, (v) => {
  if (v) {
    input.value = ''
    showPass.value = false
    window.addEventListener('keydown', onKey)
    if (lock.kind.value === 'alpha8') setTimeout(() => { try { textInput.value?.focus() } catch {} }, 350)
  } else {
    window.removeEventListener('keydown', onKey)
  }
}, { immediate: true })

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
<template>
  <Teleport to="body">
    <Transition name="lock-fade">
      <div v-if="lock.locked.value" data-lock-overlay data-lock-scroll class="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-[#0f1420]/70 backdrop-blur-2xl">
        <div class="min-h-full grid place-items-center p-4">
          <div :key="shakeKey" :class="['w-full max-w-[340px] rounded-[28px] bg-white dark:bg-zinc-900 border border-white/10 shadow-2xl px-6 py-8 text-center', shakeKey && 'lock-shake']">
            <Avatar :image="avatarSrc" shape="circle" size="xlarge" class="!w-20 !h-20 mx-auto shadow-soft" />
            <div class="mt-4 font-black text-lg tracking-tight dark:text-white truncate">{{ user?.name || 'UPin' }}</div>
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
            <p v-else-if="lock.offline.value" class="mt-2 text-[11px] text-amber-500">Оффлайн — проверка по локальному коду</p>
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
            <button type="button" @click="logout" class="mt-3 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 transition">Забыл код? Выйти из аккаунта</button>
          </div>
        </div>
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
</style>
