<script setup>
import GuestLayout from '@/Layouts/GuestLayout.vue';
import InputError from '@/Components/InputError.vue';
import InputLabel from '@/Components/InputLabel.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import TextInput from '@/Components/TextInput.vue';
import { Head, useForm } from '@inertiajs/vue3';
import { ref } from 'vue'

const form = useForm({
    password: '',
});

const show = ref(false)

const submit = () => {
    form.post(route('password.confirm'), {
        onFinish: () => form.reset(),
    });
};
</script>

<template>
    <GuestLayout>
        <Head title="Подтвердите пароль" />

        <div class="mb-4 text-sm text-stone-600 dark:text-zinc-400">
            Это защищённый раздел. Подтвердите пароль, чтобы продолжить.
        </div>

        <form @submit.prevent="submit">
            <div>
                <InputLabel for="password" value="Пароль" />
                <div class="relative mt-1">
                    <TextInput
                        id="password"
                        :type="show ? 'text' : 'password'"
                        class="block w-full pr-11"
                        v-model="form.password"
                        required
                        autocomplete="current-password"
                        autofocus
                    />
                    <button type="button" @click="show=!show" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500 text-sm">{{ show?'🙈':'👁' }}</button>
                </div>
                <InputError class="mt-2" :message="form.errors.password" />
            </div>

            <div class="mt-4 flex justify-end">
                <PrimaryButton
                    class="ms-4"
                    :class="{ 'opacity-25': form.processing }"
                    :disabled="form.processing"
                >
                    Подтвердить
                </PrimaryButton>
            </div>
        </form>
    </GuestLayout>
</template>
