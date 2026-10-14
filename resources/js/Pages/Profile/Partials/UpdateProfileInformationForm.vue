<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import AvatarPreview from '@/Components/Features/Media/AvatarPreview.vue'
import { useProfileForm } from '@/composables/useProfileForm'
import { useBirthDateField } from '@/composables/useBirthDate'
import { useAvatarUpload } from '@/composables/useAvatarUpload'
import { useGender } from '@/composables/useGender'
import { computed } from 'vue'
import { RESIDENCE_COUNTRIES } from '@/composables/useResidence'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import { useAppModulesStore } from '@/stores/appModules'
import { useUloveOnly } from '@/composables/useUloveOnly'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Card from 'primevue/card'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Slider from 'primevue/slider'
import Message from 'primevue/message'
import UserAvatar from '@/Components/Ui/UserAvatar.vue'
defineProps<{ mustVerifyEmail: boolean; status?: string | null }>()
const f = useProfileForm()
const bd = useBirthDateField(f.birth_date as any)
const a = useAvatarUpload()
const g = useGender()
const { selectPt } = useDropdownMenuStyle()
const modules = useAppModulesStore()
const showMapFields = computed(() => modules.isEnabled('upin'))
/**
 * Чистый ULove-режим: «О себе» живёт только в анкете свайпов,
 * поле профиля прячем — два источника «о себе» конфликтовали
 * при сохранении. С экстра-модулями (карта, UFlow и далее) поле
 * снова в силе: bio идёт в «Общую информацию» приоритетом.
 */
const uloveOnly = useUloveOnly()
</script>
<template>
  <section>
    <header>
      <div class="min-w-0">
        <h2 class="font-bold dark:text-white">Данные аккаунта</h2>
        <p class="text-sm text-zinc-500 mt-1">{{ showMapFields ? 'Аватар, Контакты и домашняя точка. Радиус зоны — в разделе «Приватность».' : 'Аватар, контакты и данные для анкеты.' }}</p>
      </div>
    </header>
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft mt-6" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
      <template #content>
        <div class="flex flex-col sm:flex-row items-start gap-5">
          <div class="relative shrink-0">
            <button @click="a.showPreview.value=true" :aria-label="f.user.value.name ? `Открыть фото профиля — ${f.user.value.name}` : 'Открыть фото профиля'" class="group relative w-20 h-20 rounded-3xl overflow-hidden border border-stone-200 dark:border-zinc-700 bg-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <UserAvatar :src="a.avatarSrc.value" :alt="f.user.value.name || 'Фото профиля'" shape="square" />
              <span class="absolute inset-0 bg-black/0 group-hover:bg-black/25 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-[10px] font-bold">🔍 превью</span>
            </button>
            <span v-if="a.avatarOk.value" class="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[11px] px-1.5 py-0.5 rounded-full">✓</span>
          </div>
          <div class="flex-1 min-w-0 w-full">
            <label class="text-sm font-semibold dark:text-white">Фото профиля</label>
            <p class="text-xs text-zinc-500">JPG/PNG/WebP до 10МБ · подвинь и приблизь как надо</p>
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
        <div><label class="text-sm font-medium dark:text-white">Email</label><InputText v-model="f.email.value" v-bind="f.emailAttrs" type="email" :disabled="!f.canChangeEmail.value" title="Смена почты доступна на тарифах Pro и Premium" class="w-full mt-1 !rounded-2xl" :invalid="!!f.errors.value.email" /><p v-if="!f.canChangeEmail.value" class="text-[11px] text-stone-400 mt-1">Смена почты — только на тарифах Pro и Premium</p><p v-else class="text-[11px] text-stone-400 mt-1">После смены придёт письмо — подтверди новую почту, иначе лайки и сообщения будут недоступны</p><Message v-if="f.errors.value.email" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.email }}</Message></div>
      </div>
      <div>
        <label class="text-sm font-medium dark:text-white">Пол</label>
        <Select
          v-model="f.gender.value"
          :options="g.options"
          optionLabel="label"
          optionValue="value"
          placeholder="Не указан"
          checkmark
          showClear
          scrollHeight="12rem"
          fluid
          class="w-full min-w-0 mt-1 !rounded-xl"
          :pt="selectPt"
        >
          <template #value="p">
            <span v-if="p.value" class="flex items-center gap-2 text-sm text-stone-900 dark:text-zinc-100 truncate">
              <i :class="(g.options.find((o) => o.value === p.value)?.icon ?? 'pi pi-user') + ' text-xs text-violet-600 dark:text-violet-400 shrink-0'"></i>
              <span class="truncate">{{ g.options.find((o) => o.value === p.value)?.label }}</span>
            </span>
            <span v-else class="text-sm text-stone-400 dark:text-zinc-500">Не указан</span>
          </template>
          <template #option="p">
            <span class="flex items-center gap-2 text-sm truncate">
              <i :class="p.option.icon + ' text-xs opacity-60 shrink-0'"></i>
              <span class="truncate">{{ p.option.label }}</span>
            </span>
          </template>
        </Select>
        <Message v-if="f.errors.value.gender" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.gender }}</Message>
      </div>
      <div class="grid sm:grid-cols-3 gap-4">
        <div>
          <label class="text-sm font-medium dark:text-white">Дата рождения</label>
          <DatePicker v-model="bd.birthDateInput.value" v-bind="bd.birthDatePickerProps.value" placeholder="12.07.1997" class="w-full mt-1" :invalid="!!f.errors.value.birth_date" />
          <small v-if="f.ageLabel.value" class="text-stone-500 dark:text-zinc-400">{{ f.ageLabel.value }}</small>
          <Message v-if="f.errors.value.birth_date" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.birth_date }}</Message>
        </div>
        <div>
          <label class="text-sm font-medium dark:text-white">Страна проживания</label>
          <Select v-model="f.country.value" :options="[...RESIDENCE_COUNTRIES]" optionLabel="name" optionValue="name" placeholder="Беларусь" checkmark editable fluid class="w-full mt-1 !rounded-xl" :pt="selectPt" @update:model-value="(v:string)=>{ const c=[...RESIDENCE_COUNTRIES].find(x=>x.name===v); f.setValues({ country: v, country_code: c ? c.code : (f.values as any).country_code } as any) }" />
          <p v-if="showMapFields" class="text-[11px] text-stone-400 mt-1">Пины — только в своей стране</p>
          <small v-if="f.countryWarning.value" class="text-amber-600 dark:text-amber-400">⚠️ {{ f.countryWarning.value }}</small>
          <Message v-if="f.errors.value.country" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.country }}</Message>
        </div>
        <div>
          <label class="text-sm font-medium dark:text-white">Город проживания</label>
          <InputText v-model="f.home_city.value" placeholder="Минск" class="w-full mt-1 !rounded-2xl" :invalid="!!f.errors.value.home_city" />
          <Message v-if="f.errors.value.home_city" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ f.errors.value.home_city }}</Message>
        </div>
      </div>
      <Card v-if="showMapFields" class="!bg-zinc-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl !shadow-none" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
        <template #content>
          <div class="flex items-center justify-between"><h4 class="text-sm font-bold dark:text-white">Домашняя точка</h4><Button @click="f.useMyLocation" label="Моя геопозиция" size="small" rounded class="!bg-black dark:!bg-white !border-black dark:!border-white !text-white dark:!text-black" /></div>
          <p class="text-[11px] text-stone-500 mt-1">Радиус зоны настраивается в разделе «Приватность».</p>
          <div class="grid sm:grid-cols-2 gap-3 mt-3">
            <div><label class="text-xs font-medium dark:text-white">Широта</label><InputText readonly v-model="f.home_lat.value" v-bind="f.homeLatAttrs" placeholder="55.75" class="w-full mt-1 !rounded-2xl" :invalid="!!f.errors.value.home_lat" /><Message v-if="f.errors.value.home_lat" severity="error" :closable="false" class="mt-1 !text-xs">{{ f.errors.value.home_lat }}</Message></div>
            <div><label class="text-xs font-medium dark:text-white">Долгота</label><InputText readonly v-model="f.home_lng.value" v-bind="f.homeLngAttrs" placeholder="37.61" class="w-full mt-1 !rounded-2xl" :invalid="!!f.errors.value.home_lng" /><Message v-if="f.errors.value.home_lng" severity="error" :closable="false" class="mt-1 !text-xs">{{ f.errors.value.home_lng }}</Message></div>
          </div>
        </template>
      </Card>
      <div v-if="!uloveOnly">
        <label class="text-sm font-semibold dark:text-white">О себе</label>
        <p class="text-xs text-zinc-500 mb-2">Расскажи о себе — видно всем в профиле в разделе «Общая информация».</p>
        <Textarea v-model="f.bio.value" rows="5" autoResize maxlength="10000" placeholder="Напиши пару строк о себе — интересы, чем занимаешься..." class="w-full mt-1 !rounded-3xl !bg-white dark:!bg-zinc-900" />
        <div class="flex justify-between mt-1">
          <Message v-if="f.errors.value.bio" severity="error" :closable="false" class="!py-1 !text-xs">{{ f.errors.value.bio }}</Message><span v-else></span>
          <small class="text-stone-400">{{ (f.bio.value || '').length }} / 10000</small>
        </div>
      </div>
      <label v-if="showMapFields" class="flex items-center gap-2 text-sm dark:text-white"><Checkbox v-model="f.is_anonymous_default.value" :binary="true" /> Создавать пины анонимно по умолчанию</label>
      <Message v-if="mustVerifyEmail && f.user.value.email_verified_at === null" severity="warn" :closable="false" class="!rounded-2xl">
        Почта не подтверждена. <Link :href="route('verification.send')" method="post" as="button" class="underline font-medium">Отправить письмо</Link>
        <div v-if="status==='verification-link-sent'" class="text-green-700 mt-1">Письмо отправлено</div>
      </Message>
      <div class="pt-1">
        <Button :loading="f.isSubmitting.value" type="submit" label="Сохранить изменения" icon="pi pi-check" class="w-full !bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white !font-bold !rounded-2xl !py-3.5 !text-[15px] shadow-lg shadow-violet-600/25 dark:shadow-violet-500/25 active:scale-[0.99]" />
      </div>
    </form>
    <AvatarPreview :src="a.avatarSrc.value" :name="f.user.value.name" :open="a.showPreview.value" @close="a.showPreview.value=false" />
    <Dialog :visible="a.crop.showCropper.value" @update:visible="(v:boolean)=>{ if(!v) a.cancelCrop() }" modal dismissableMask :draggable="false" header="Позиционируй фото" :style="{ width: '440px', maxWidth: 'calc(100vw - 1.5rem)' }" :pt="{ root: { class: '!rounded-3xl max-sm:!rounded-b-none avatar-crop' }, header: { class: '!py-3 !px-4 !rounded-t-3xl' }, content: { class: '!px-4 !pb-2 !overflow-y-auto !overscroll-contain' }, footer: { class: '!px-4 !py-3 !rounded-b-3xl' } }">
      <div
        :ref="(el:any)=>a.crop.setFrameEl(el)"
        class="relative w-[min(100%,44dvh)] mx-auto aspect-square overflow-hidden bg-stone-100 dark:bg-zinc-800 select-none touch-none"
        :class="[a.crop.dragging.value ? 'cursor-grabbing' : 'cursor-grab', a.crop.shape.value === 'circle' ? 'rounded-full' : 'rounded-3xl']"
        @pointerdown="a.crop.onPointerDown"
        @pointermove="a.crop.onPointerMove"
        @pointerup="a.crop.onPointerUp"
        @pointercancel="a.crop.onPointerUp"
      >
        <img v-if="a.crop.sourceUrl.value" :src="a.crop.sourceUrl.value" alt="" draggable="false" class="absolute max-w-none" :style="a.crop.frameStyle.value" />
        <div v-if="a.crop.shape.value === 'square'" class="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
          <div v-for="i in 9" :key="i" class="border border-white/30"></div>
        </div>
      </div>
      <p class="text-xs text-zinc-500 mt-2">Тяни фото чтобы подвинуть · ползунок — приблизить · нажми на кружок или квадрат чтобы примерить форму</p>
      <div class="flex items-center gap-1 mt-2">
        <Button icon="pi pi-minus" rounded text aria-label="Отдалить" @click="a.crop.zoomOut()" :disabled="a.crop.zoom.value <= a.crop.ZOOM_MIN" class="!w-10 !h-10 shrink-0" />
        <Slider v-model="a.crop.zoom.value" :min="a.crop.ZOOM_MIN" :max="a.crop.ZOOM_MAX" :step="0.01" class="flex-1" aria-label="Масштаб фото" />
        <Button icon="pi pi-plus" rounded text aria-label="Приблизить" @click="a.crop.zoomIn()" :disabled="a.crop.zoom.value >= a.crop.ZOOM_MAX" class="!w-10 !h-10 shrink-0" />
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
        <button type="button" @click="a.crop.setShape('circle')" :aria-pressed="a.crop.shape.value === 'circle'" :class="['flex items-center gap-2 rounded-2xl p-1 transition', a.crop.shape.value === 'circle' ? 'ring-2 ring-violet-500 bg-violet-500/5' : 'ring-1 ring-stone-200 dark:ring-zinc-700']">
          <span class="relative block w-14 h-14 rounded-full overflow-hidden bg-stone-100 dark:bg-zinc-800 shrink-0">
            <img v-if="a.crop.sourceUrl.value" :src="a.crop.sourceUrl.value" alt="" draggable="false" class="absolute max-w-none pointer-events-none" :style="a.crop.frameStyle.value" />
          </span>
          <span class="text-xs text-zinc-500 text-left">кружок<br />в шапке</span>
        </button>
        <button type="button" @click="a.crop.setShape('square')" :aria-pressed="a.crop.shape.value === 'square'" :class="['flex items-center gap-2 rounded-2xl p-1 transition', a.crop.shape.value === 'square' ? 'ring-2 ring-violet-500 bg-violet-500/5' : 'ring-1 ring-stone-200 dark:ring-zinc-700']">
          <span class="relative block w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 dark:bg-zinc-800 shrink-0">
            <img v-if="a.crop.sourceUrl.value" :src="a.crop.sourceUrl.value" alt="" draggable="false" class="absolute max-w-none pointer-events-none" :style="a.crop.frameStyle.value" />
          </span>
          <span class="text-xs text-zinc-500 text-left">квадрат<br />в превью</span>
        </button>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" severity="secondary" text @click="a.cancelCrop()" />
          <Button label="Готово" icon="pi pi-check" :loading="a.confirming.value" @click="a.confirmCrop()" class="!bg-ink-900 !border-ink-900 dark:!bg-white dark:!border-white dark:!text-ink-900" />
        </div>
      </template>
    </Dialog>
  </section>
</template>
<style scoped>
.avatar-crop :deep(.p-slider-handle) {
  width: 1.35rem;
  height: 1.35rem;
}
</style>
