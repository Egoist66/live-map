<script setup lang="ts">
import { onMounted, ref } from 'vue'
import InputText from 'primevue/inputtext'
const model = defineModel<string>({ required: true })
const input = ref<any>(null)
onMounted(() => { if (input.value?.$el?.hasAttribute?.('autofocus') || input.value?.hasAttribute?.('autofocus')) input.value.$el?.focus?.() })
defineExpose({ focus: () => input.value?.$el?.focus?.() })
</script>
<template>
  <InputText ref="input" v-model="model" v-bind="$attrs" class="w-full !rounded-2xl !border-stone-200 !bg-white !px-4 !py-3 !text-sm placeholder:!text-stone-400 !shadow-sm focus:!border-brand-500 focus:!ring-4 focus:!ring-brand-500/10 !transition" />
</template>
