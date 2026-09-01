<script setup>
import { onMounted, ref } from 'vue';
const model = defineModel({ type: String, required: true });
const input = ref(null);
onMounted(() => { if (input.value?.hasAttribute('autofocus')) input.value.focus(); });
defineExpose({ focus: () => input.value.focus() });
</script>

<template>
  <input class="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm placeholder:text-stone-400 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition" v-model="model" ref="input" />
</template>
