<script setup>
import { Link } from '@inertiajs/vue3';

defineProps({
    href: {
        type: String,
        required: true,
    },
});
</script>

<template>
    <Link
        :href="href"
        class="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 dark:text-zinc-200 transition duration-150 ease-in-out hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-white focus:bg-gray-100 dark:focus:bg-white/10 focus:outline-none"
    >
        <slot />
    </Link>
</template>
