<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import Toast from 'primevue/toast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Skeleton from 'primevue/skeleton'
import { useDistrictListPage } from '@/composables/useDistrictListPage'
import DistrictJoinRequestDialog from '@/Components/Features/Districts/DistrictJoinRequestDialog.vue'
import { districtInterestLabel } from '@/utils/districtGeo'

const props = defineProps<{
  canCreate: boolean
  limitText: string
}>()

const list = useDistrictListPage(props.canCreate, props.limitText)

/**
 * Первая буква названия для аватара сообщества.
 *
 * @param name название района
 */
function letterOf(name: string): string {
  const clean = String(name ?? '').trim()
  return clean ? clean.slice(0, 1).toUpperCase() : '?'
}
</script>

<template>
  <Head title="Районы" />
  <Toast />
    <div class="bg-surface dark:bg-[#090E1A]">
      <div class="mx-auto max-w-[1000px] px-3 py-3 sm:px-6 sm:py-6">
        <div class="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div class="grid min-w-0 gap-3">
            <div class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div class="min-w-0 flex-1">
                  <h1 class="text-xl font-black tracking-tight text-ink-900 sm:text-2xl dark:text-white">Сообщества районов</h1>
                  <p class="mt-0.5 text-[13px] text-stone-500 dark:text-zinc-400">{{ list.limitText }} · заливки видят все, пины внутри — только жители</p>
                </div>
                <Button v-if="list.canCreate" label="Создать" icon="pi pi-plus" rounded class="!border-0 !bg-blue-600 !text-sm !font-bold !text-white hover:!bg-blue-500" @click="list.goCreate()" />
              </div>
              <IconField class="mt-3">
                <InputIcon class="pi pi-search" />
                <InputText :model-value="list.query.value" placeholder="Найти сообщество…" class="w-full !rounded-2xl" @update:model-value="(v:string|undefined)=>list.setQuery(v ?? '')" />
              </IconField>
            </div>

            <div v-if="list.mine.value.length || list.loadingMine.value" class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div class="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Мои сообщества</div>
              <div v-if="list.loadingMine.value" class="grid gap-2">
                <Skeleton height="64px" class="!rounded-2xl" />
                <Skeleton height="64px" class="!rounded-2xl" />
              </div>
              <div v-else class="grid gap-1.5">
                <div
                  v-for="district in list.mine.value"
                  :key="district.id"
                  role="button"
                  tabindex="0"
                  class="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/50 p-2.5 text-left transition hover:border-blue-300 active:scale-[0.99] dark:border-blue-500/20 dark:bg-blue-500/10"
                  @click="list.openDistrict(district.id)"
                  @keydown.enter="list.openDistrict(district.id)"
                >
                  <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-lg font-black text-white">{{ letterOf(district.name) }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[13px] font-bold text-ink-900 dark:text-white">{{ district.name }}</span>
                    <span class="block truncate text-[11px] text-stone-500 dark:text-zinc-400">{{ districtInterestLabel(district.interest) }} · {{ district.members_count }} уч.</span>
                  </span>
                  <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 dark:text-zinc-600" />
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div class="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Витрина · {{ list.filteredAll.value.length }}</div>
              <div v-if="list.loadingAll.value" class="grid gap-2">
                <Skeleton height="64px" class="!rounded-2xl" />
                <Skeleton height="64px" class="!rounded-2xl" />
                <Skeleton height="64px" class="!rounded-2xl" />
              </div>
              <div v-else-if="list.filteredAll.value.length" class="grid gap-1.5">
                <div
                  v-for="district in list.filteredAll.value"
                  :key="district.id"
                  role="button"
                  tabindex="0"
                  class="flex items-center gap-2.5 rounded-2xl border border-stone-200/70 bg-white p-2.5 text-left transition hover:border-blue-300 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-500/40"
                  @click="list.openDistrict(district.id)"
                  @keydown.enter="list.openDistrict(district.id)"
                >
                  <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 text-lg font-black text-stone-600 dark:bg-white/10 dark:text-zinc-200">{{ letterOf(district.name) }}</span>
                  <span class="min-w-0 flex-1 cursor-pointer">
                    <span class="block truncate text-[13px] font-bold text-ink-900 dark:text-white">{{ district.name }}</span>
                    <span class="block truncate text-[11px] text-stone-500 dark:text-zinc-400">{{ districtInterestLabel(district.interest) }} · {{ district.members_count }} уч.</span>
                  </span>
                  <Button
                    v-if="district.role === 'guest'"
                    label="Вступить"
                    size="small"
                    rounded
                    :loading="list.joiningId.value === district.id"
                    class="!border-0 !bg-blue-600 !text-xs !font-bold !text-white hover:!bg-blue-500"
                    @click.stop="list.joinDistrict(district.id, district.name)"
                  />
                  <Button
                    v-else-if="district.role === 'invited'"
                    label="Принять"
                    size="small"
                    rounded
                    :loading="list.joiningId.value === district.id"
                    class="!border-0 !bg-emerald-500 !text-xs !font-bold !text-white"
                    @click.stop="list.acceptDistrictInvite(district.id)"
                  />
                  <Button
                    v-else-if="district.role === 'pending'"
                    label="Отменить заявку"
                    size="small"
                    rounded
                    outlined
                    severity="secondary"
                    :loading="list.joiningId.value === district.id"
                    class="!text-xs !font-bold"
                    @click.stop="list.cancelJoinRequest(district.id)"
                  />
                  <i v-else class="pi pi-chevron-right shrink-0 text-xs text-stone-300 dark:text-zinc-600" />
                </div>
              </div>
              <div v-else-if="list.isNothingFound.value" class="rounded-2xl border border-dashed border-stone-300 p-4 text-center text-xs text-stone-400 dark:border-zinc-700 dark:text-zinc-500">
                Ничего не нашли — попробуйте другой запрос
              </div>
              <div v-else class="rounded-2xl border border-dashed border-stone-300 p-4 text-center text-xs text-stone-400 dark:border-zinc-700 dark:text-zinc-500">
                Пока пусто — станьте первым, кто создаст сообщество
              </div>
            </div>
          </div>

          <aside class="grid gap-3">
            <div class="rounded-3xl border border-stone-200/70 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div class="flex items-center gap-2.5">
                <span class="grid h-10 w-10 place-items-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"><i class="pi pi-palette" /></span>
                <div class="text-sm font-black text-ink-900 dark:text-white">Свой район</div>
              </div>
              <p class="mt-2 text-[13px] leading-relaxed text-stone-500 dark:text-zinc-400">Нарисуйте заливку чертежом на карте — назовёте и откроете здесь, как группу.</p>
              <Button v-if="list.canCreate" label="Нарисовать район" icon="pi pi-arrow-right" icon-pos="right" rounded size="small" class="mt-3 w-full !border-0 !bg-blue-600 !text-white hover:!bg-blue-500" @click="list.goCreate()" />
              <div v-else class="mt-3 rounded-2xl bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{{ list.limitText }}</div>
            </div>
            <div class="rounded-3xl border border-stone-200/70 bg-white p-4 text-[13px] leading-relaxed text-stone-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              Открыть район можно и с карты: нажмите на заливку — попадёте на страницу сообщества.
              <Link href="/map" class="font-bold text-blue-600 hover:underline dark:text-blue-400">К карте</Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
    <DistrictJoinRequestDialog
      :open="list.joinRequest.dialogOpen.value"
      :district-name="list.joinRequest.districtName.value"
      :message="list.joinRequest.message.value"
      :sending="list.joinRequest.sending.value"
      :is-business="list.joinRequest.isBusiness.value"
      @update:open="(v: boolean) => (list.joinRequest.dialogOpen.value = v)"
      @update:message="(v: string) => (list.joinRequest.message.value = v)"
      @submit="list.joinRequest.confirm()"
    />
</template>
