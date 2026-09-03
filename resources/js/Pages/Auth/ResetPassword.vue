<script setup>
import GuestLayout from '@/Layouts/GuestLayout.vue';
import InputError from '@/Components/InputError.vue';
import InputLabel from '@/Components/InputLabel.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import TextInput from '@/Components/TextInput.vue';
import { Head, useForm } from '@inertiajs/vue3';
import { ref } from 'vue'

const props = defineProps({
    email: {
        type: String,
        required: true,
    },
    token: {
        type: String,
        required: true,
    },
});

const form = useForm({
    token: props.token,
    email: props.email,
    password: '',
    password_confirmation: '',
});

const show1 = ref(false)
const show2 = ref(false)

const submit = () => {
    form.post(route('password.store'), {
        onFinish: () => form.reset('password', 'password_confirmation'),
    });
};
</script>

<template>
    <GuestLayout>
        <Head title="Новый пароль" />

        <form @submit.prevent="submit">
            <div>
                <InputLabel for="email" value="Email" />

                <TextInput
                    id="email"
                    type="email"
                    class="mt-1 block w-full"
                    v-model="form.email"
                    required
                    autofocus
                    autocomplete="username"
                />

                <InputError class="mt-2" :message="form.errors.email" />
            </div>

            <div class="mt-4">
                <InputLabel for="password" value="Новый пароль" />
                <div class="relative mt-1">
                    <TextInput
                        id="password"
                        :type="show1 ? 'text' : 'password'"
                        class="block w-full pr-11"
                        v-model="form.password"
                        required
                        autocomplete="new-password"
                    />
                    <button type="button" @click="show1=!show1" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500 text-sm">{{ show1?'🙈':'👁' }}</button>
                </div>
                <InputError class="mt-2" :message="form.errors.password" />
            </div>

            <div class="mt-4">
                <InputLabel for="password_confirmation" value="Подтвердите пароль" />
                <div class="relative mt-1">
                    <TextInput
                        id="password_confirmation"
                        :type="show2 ? 'text' : 'password'"
                        class="block w-full pr-11"
                        v-model="form.password_confirmation"
                        required
                        autocomplete="new-password"
                    />
                    <button type="button" @click="show2=!show2" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500 text-sm">{{ show2?'🙈':'👁' }}</button>
                </div>
                <InputError class="mt-2" :message="form.errors.password_confirmation" />
            </div>

            <div class="mt-4 flex items-center justify-end">
                <PrimaryButton
                    :class="{ 'opacity-25': form.processing }"
                    :disabled="form.processing"
                >
                    Сохранить пароль
                </PrimaryButton>
            </div>
        </form>
    </GuestLayout>
</template>
