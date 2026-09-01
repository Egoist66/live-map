<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
const props = defineProps<{ src: string; name?: string; open: boolean }>()
const emit = defineEmits<{ (e:'close'):void }>()
function onKey(e: KeyboardEvent){ if(e.key==='Escape') emit('close') }
watch(()=>props.open, (v)=> {
  if(v) { document.body.style.overflow='hidden'; window.addEventListener('keydown', onKey) }
  else { document.body.style.overflow=''; window.removeEventListener('keydown', onKey) }
})
onBeforeUnmount(()=> { document.body.style.overflow=''; window.removeEventListener('keydown', onKey) })
</script>
<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <div class="absolute inset-0 bg-ink-900/70 dark:bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>
      <Transition name="zoom" appear>
        <div class="relative">
          <div class="relative bg-white dark:bg-zinc-900 rounded-[24px] p-2 shadow-float border border-white/20 dark:border-zinc-700 max-w-[92vw] max-h-[88vh] flex flex-col">
            <img :src="src" :alt="name||'avatar'" class="max-w-[80vw] sm:max-w-[420px] max-h-[70vh] w-auto h-auto rounded-[16px] object-cover bg-stone-100 dark:bg-zinc-800" />
            <div class="flex items-center justify-between gap-4 px-2 py-3">
              <div class="min-w-0">
                <div class="text-sm font-bold dark:text-white truncate">{{ name || 'Фото профиля' }}</div>
                <div class="text-xs text-stone-500 dark:text-zinc-400">Нажми вне фото чтобы закрыть · Esc</div>
              </div>
              <a :href="src" target="_blank" class="shrink-0 text-xs font-semibold bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-4 py-2 rounded-full hover:opacity-90 transition">Открыть</a>
            </div>
            <button @click="emit('close')" class="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft grid place-items-center hover:bg-stone-50 dark:hover:bg-zinc-700 transition text-stone-600 dark:text-zinc-300">✕</button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
<style scoped>
.fade-enter-active,.fade-leave-active{transition:opacity .2s}
.fade-enter-from,.fade-leave-to{opacity:0}
.zoom-enter-active{transition:all .32s cubic-bezier(.16,1,.3,1)}
.zoom-leave-active{transition:all .2s ease}
.zoom-enter-from{opacity:0; transform:scale(.92) translateY(8px)}
.zoom-leave-to{opacity:0; transform:scale(.96)}
</style>
