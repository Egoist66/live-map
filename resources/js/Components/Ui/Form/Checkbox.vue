<script setup lang="ts">
import PrimeCheckbox from 'primevue/checkbox'
import { computed } from 'vue'
const props = defineProps<{ checked: any; value?: any }>()
const emit = defineEmits(['update:checked'])
const model = computed({
  get: () => props.checked,
  set: (v: any) => emit('update:checked', v)
})
const binary = computed(() => !Array.isArray(props.checked))
</script>
<template>
  <PrimeCheckbox v-model="model" :binary="binary" :value="value" v-bind="$attrs" class="!rounded !border-stone-300 dark:!border-zinc-600" />
</template>
