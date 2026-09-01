<script setup>
import { computed } from 'vue';
import { Link } from '@inertiajs/vue3';
const props = defineProps({ href: { type: String, required: true }, active: Boolean });
const classes = computed(() => props.active ? 'inline-flex items-center px-1 pt-1 border-b-2 border-ink-900 text-sm font-semibold text-ink-900' : 'inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-stone-500 hover:text-ink-900 hover:border-stone-300');
</script>
<template>
  <Link :href="href" :class="classes"><slot /></Link>
</template>
