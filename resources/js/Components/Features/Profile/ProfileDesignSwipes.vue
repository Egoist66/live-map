<script setup lang="ts">
const emit = defineEmits<{
  (e: 'go'): void
}>()
</script>

<template>
  <button
    type="button"
    class="relative block w-full overflow-hidden rounded-[24px] bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 p-5 text-left text-white transition hover:opacity-95 active:scale-[0.99]"
    @click="emit('go')"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.12]"
      style="background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0); background-size: 18px 18px"
    ></div>
    <div class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl"></div>
    <span class="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-white/15">
      <i class="pi pi-heart text-2xl"></i>
    </span>
    <span class="relative mt-4 block text-lg font-extrabold leading-tight">Начать<br />знакомиться</span>
    <span class="relative mt-1 block text-xs leading-snug text-white/70">Люди рядом на живой карте — напиши первым</span>
    <span class="relative mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-ink-900">
      Найти людей<i class="pi pi-arrow-right text-xs"></i>
    </span>
  </button>
</template>
