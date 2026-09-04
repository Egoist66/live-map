<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import AvatarPreview from '@/Components/Features/Media/AvatarPreview.vue'
import { useProfileForm } from '@/composables/useProfileForm'
import { useAvatarUpload } from '@/composables/useAvatarUpload'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Card from 'primevue/card'
import Select from 'primevue/select'
import Message from 'primevue/message'
import Avatar from 'primevue/avatar'
defineProps<{ mustVerifyEmail: boolean; status?: string | null }>()
const f = useProfileForm()
const a = useAvatarUpload()
const planOptions = [{ label:'Free — 3/день · 1км', value:'free', icon:'pi pi-ticket' },{ label:'Pro — Безлимит · 5км', value:'pro', icon:'pi pi-bolt' },{ label:'Business — Безлимит · 50км', value:'business', icon:'pi pi-briefcase' }]
</script>
<template>
  <section>
    <header>
      <h2 class="font-bold dark:text-white">Данные аккаунта</h2>
      <p class="text-sm text-zinc-500 mt-1">Контакты, домашняя зона и видимость пинов по умолчанию.</p>
    </header>
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft mt-6" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
      <template #content>
        <div class="flex flex-col sm:flex-row items-start gap-5">
          <div class="relative shrink-0">
            <button @click="a.showPreview.value=true" class="group relative w-20 h-20 rounded-3xl overflow-hidden border border-stone-200 dark:border-zinc-700 bg-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <Avatar :image="a.avatarSrc.value" shape="square" class="!w-full !h-full [&_img]:object-cover" />
              <span class="absolute inset-0 bg-black/0 group-hover:bg-black/25 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-[10px] font-bold">🔍 превью</span>
            </button>
            <span v-if="a.avatarOk.value" class="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[11px] px-1.5 py-0.5 rounded-full">✓</span>
          </div>
          <div class="flex-1 min-w-0 w-full">
            <label class="text-sm font-semibold dark:text-white">Фото профиля</label>
            <p class="text-xs text-zinc-500">JPG/PNG/WebP до 2МБ · сразу видно везде</p>
            <div class="flex gap-2 mt-3">
              <label class="flex-1 cursor-pointer">
                <input type="file" accept="image/*" @change="a.onAvatar" class="hidden" />
                <span class="block text-sm border border-stone-200 dark:border-zinc-700 rounded-2xl px-3 py-2.5 bg-stone-50 dark:bg-zinc-800 hover:bg-stone-100 text-stone-600 dark:text-zinc-300 truncate">{{ a.avatarFile.value ? a.avatarFile.value.name : 'Выбери файл…' }}</span>
              </label>
              <Button @click="a.uploadAvatar" :disabled="!a.avatarFile.value || a.uploading.value" :loading="a.uploading.value" label="Загрузить" rounded class="!bg-ink-900 !border-ink-900 dark:!bg-white dark:!border-white dark:!text-ink-900 shrink-0" />
            </div>
            <Message v-if="a.avatarOk.value" severity="success" :closable="false" class="mt-1.5 !rounded-2xl !py-2">✓ Фото обновлено — видно в шапке и на пинах</Message>
          </div>
        </div>
      </template>
    </Card>
    <form @submit.prevent="f.submit" class="mt-6 space-y-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="text-sm font-medium dark:text-white">Имя</label><InputText v-model="f.name.value" v-bind="f.nameAttrs" class="w-full mt-1 !rounded-2xl" :invalid="!!f.errors.value.name" /><Message v-if="f.errors.value.name" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.name }}</Message></div>
        <div><label class="text-sm font-medium dark:text-white">Email</label><InputText v-model="f.email.value" v-bind="f.emailAttrs" type="email" class="w-full mt-1 !rounded-2xl" :invalid="!!f.errors.value.email" /><Message v-if="f.errors.value.email" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.email }}</Message></div>
      </div>
      <Card class="!bg-zinc-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
        <template #content>
          <div class="flex items-center justify-between"><h4 class="text-sm font-bold dark:text-white">Домашняя зона</h4><Button @click="f.useMyLocation" label="Моя геопозиция" size="small" rounded class="!bg-black dark:!bg-white !border-black dark:!border-white !text-white dark:!text-black" /></div>
          <div class="grid sm:grid-cols-3 gap-3 mt-3">
            <div><label class="text-xs font-medium dark:text-white">Широта</label><InputText v-model="f.home_lat.value" v-bind="f.homeLatAttrs" placeholder="55.75" class="w-full mt-1 !rounded-2xl" :invalid="!!f.errors.value.home_lat" /><Message v-if="f.errors.value.home_lat" severity="error" :closable="false" class="mt-1 !text-xs">{{ f.errors.value.home_lat }}</Message></div>
            <div><label class="text-xs font-medium dark:text-white">Долгота</label><InputText v-model="f.home_lng.value" v-bind="f.homeLngAttrs" placeholder="37.61" class="w-full mt-1 !rounded-2xl" :invalid="!!f.errors.value.home_lng" /><Message v-if="f.errors.value.home_lng" severity="error" :closable="false" class="mt-1 !text-xs">{{ f.errors.value.home_lng }}</Message></div>
            <div><label class="text-xs font-medium dark:text-white">Радиус км</label><InputText v-model.number="f.values.home_radius_km" type="number" class="w-full mt-1 !rounded-2xl" /><Message v-if="f.errors.value.home_radius_km" severity="error" :closable="false" class="mt-1 !text-xs">{{ f.errors.value.home_radius_km }}</Message></div>
          </div>
        </template>
      </Card>
      <div>
        <label class="text-sm font-semibold dark:text-white">О себе</label>
        <p class="text-xs text-zinc-500 mb-2">Расскажи о себе — видно всем в профиле в разделе «Общая информация».</p>
        <Textarea v-model="f.bio.value" rows="5" autoResize maxlength="10000" placeholder="Напиши пару строк о себе — интересы, чем занимаешься..." class="w-full mt-1 !rounded-3xl !bg-white dark:!bg-zinc-900" />
        <div class="flex justify-between mt-1">
          <Message v-if="f.errors.value.bio" severity="error" :closable="false" class="!py-1 !text-xs">{{ f.errors.value.bio }}</Message><span v-else></span>
          <small class="text-stone-400">{{ (f.bio.value || '').length }} / 10000</small>
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm dark:text-white"><Checkbox v-model="f.is_anonymous_default.value" :binary="true" /> Создавать пины анонимно по умолчанию</label>
      <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-700 !rounded-3xl" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
        <template #content>
          <h4 class="text-sm font-black dark:text-white">Тариф — {{ ({free:'Бесплатный',pro:'Pro',business:'Бизнес'} as any)[f.values.plan] }}</h4>
          <p class="text-xs text-zinc-500 mt-1">Переключи тариф — вступают сразу.</p>
          <Select
            v-model="f.plan.value"
            :options="planOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Выбери тариф"
            checkmark
            scrollHeight="12rem"
            fluid
            class="w-full min-w-0 mt-3 !rounded-xl"
            :pt="{
              root: { class: '!rounded-xl !border-stone-200 dark:!border-zinc-700 !bg-white dark:!bg-zinc-900' },
              label: { class: '!text-sm !py-2.5 !text-stone-900 dark:!text-zinc-100 placeholder:!text-stone-400 dark:placeholder:!text-zinc-500' },
              dropdown: { class: '!w-9' },
              dropdownIcon: { class: '!text-xs !text-stone-400 dark:!text-zinc-500' },
              overlay: { class: '!rounded-xl !border !border-stone-200 dark:!border-zinc-700 !bg-white dark:!bg-zinc-900 !shadow-xl !max-w-[calc(100vw-2rem)] !overflow-hidden' },
              listContainer: { class: '!bg-white dark:!bg-zinc-900 !p-1.5' },
              list: { class: '!bg-white dark:!bg-zinc-900 !flex !flex-col !gap-0.5' },
              option: { class: '!rounded-lg !px-3 !py-2.5 !text-sm !text-stone-800 dark:!text-zinc-100 hover:!bg-stone-100 dark:hover:!bg-zinc-800' },
            }"
          >
            <template #value="p">
              <span v-if="p.value" class="flex items-center gap-2 text-sm text-stone-900 dark:text-zinc-100 truncate">
                <i :class="(planOptions.find((o) => o.value === p.value)?.icon ?? 'pi pi-ticket') + ' text-xs text-violet-600 dark:text-violet-400 shrink-0'"></i>
                <span class="truncate">{{ planOptions.find((o) => o.value === p.value)?.label }}</span>
              </span>
              <span v-else class="text-sm text-stone-400 dark:text-zinc-500">Выбери тариф</span>
            </template>
            <template #option="p">
              <span class="flex items-center gap-2 text-sm truncate">
                <i :class="p.option.icon + ' text-xs opacity-60 shrink-0'"></i>
                <span class="truncate">{{ p.option.label }}</span>
              </span>
            </template>
          </Select>
          <div class="mt-3 grid sm:grid-cols-3 gap-2">
            <Card @click="(f.plan.value as any)='free'" :class="['!rounded-3xl !cursor-pointer !transition', f.values.plan==='free'?'!bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !border-ink-900 dark:!border-white':'!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !text-stone-800 dark:!text-zinc-200']" :pt="{ body:{ class:'!p-3' }, content:{ class:'!p-0' } }"><template #content><div class="text-sm font-bold">Free</div><div class="text-xs opacity-70">3/день · 1км · 2ч</div><div class="text-xs font-bold mt-1">Бесплатно</div></template></Card>
            <Card @click="(f.plan.value as any)='pro'" :class="['!rounded-3xl !cursor-pointer !transition', f.values.plan==='pro'?'!bg-gradient-to-br !from-violet-600 !to-indigo-600 !text-white !border-violet-600':'!bg-amber-50 dark:!bg-amber-950/30 !border-amber-200 dark:!border-amber-800 !text-stone-800 dark:!text-zinc-200']" :pt="{ body:{ class:'!p-3' }, content:{ class:'!p-0' } }"><template #content><div class="text-sm font-black">Pro</div><div class="text-xs opacity-80">Безлимит · 5км · 24ч</div><div class="text-xs font-bold mt-1">$4.99 / мес</div></template></Card>
            <Card @click="(f.plan.value as any)='business'" :class="['!rounded-3xl !cursor-pointer !transition', f.values.plan==='business'?'!bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !border-ink-900 dark:!border-white':'!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !text-stone-800 dark:!text-zinc-200']" :pt="{ body:{ class:'!p-3' }, content:{ class:'!p-0' } }"><template #content><div class="text-sm font-bold">Business</div><div class="text-xs opacity-70">Безлимит · 50км · 168ч</div><div class="text-xs font-bold mt-1">$19.99 / мес</div></template></Card>
          </div>
        </template>
      </Card>
      <Message v-if="mustVerifyEmail && f.user.value.email_verified_at === null" severity="warn" :closable="false" class="!rounded-2xl">
        Почта не подтверждена. <Link :href="route('verification.send')" method="post" as="button" class="underline font-medium">Отправить письмо</Link>
        <div v-if="status==='verification-link-sent'" class="text-green-700 mt-1">Письмо отправлено</div>
      </Message>
      <div class="flex items-center gap-3">
        <Button :loading="f.isSubmitting.value" type="submit" label="Сохранить" rounded class="!bg-black dark:!bg-white dark:!text-ink-900 !border-black dark:!border-white" />
      </div>
    </form>
    <AvatarPreview :src="a.avatarSrc.value" :name="f.user.value.name" :open="a.showPreview.value" @close="a.showPreview.value=false" />
  </section>
</template>
