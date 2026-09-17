<script setup lang="ts">
import { onMounted } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import Toast from 'primevue/toast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import DistrictCommunityHeader from '@/Components/Features/Districts/DistrictCommunityHeader.vue'
import DistrictCommunityTabs from '@/Components/Features/Districts/DistrictCommunityTabs.vue'
import DistrictMemberRow from '@/Components/Features/Districts/DistrictMemberRow.vue'
import DistrictPinRow from '@/Components/Features/Districts/DistrictPinRow.vue'
import DistrictInterestPicker from '@/Components/Features/Districts/DistrictInterestPicker.vue'
import DistrictInviteDialog from '@/Components/Features/Map/DistrictInviteDialog.vue'
import DistrictNewsCard from '@/Components/Features/Districts/DistrictNewsCard.vue'
import DistrictNewsComposer from '@/Components/Features/Districts/DistrictNewsComposer.vue'
import { useDistrictShowPage } from '@/composables/useDistrictShowPage'
import { useDistrictNews } from '@/composables/useDistrictNews'
import { computed } from 'vue'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import type { DistrictDetails } from '@/types/entities/District'

const props = defineProps<{
  districtId: number
  initialDistrict: DistrictDetails | null
}>()

const page = useDistrictShowPage(props.districtId, props.initialDistrict)
const news = useDistrictNews(props.districtId, page.isOwner)
const canCommentNews = computed(() => page.isOwner.value || page.isMember.value)
const newsHasMore = computed(() => news.hasMore.value)
const newsLoadingMore = computed(() => news.loadingMore.value)
const { sentinel: newsSentinel } = useInfiniteScroll({ hasMore: newsHasMore, loading: newsLoadingMore, onLoadMore: () => news.loadMore() })
const newsCanSubmit = computed(() => {
  const ready = news.body.value.trim().length >= 2 && !news.saving.value
  return ready
})

onMounted(async () => {
  await page.init()
  await news.load()
})
</script>

<template>
  <Head :title="page.district.value?.name ?? 'Район'" />
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A]">
      <div class="mx-auto max-w-[1000px] px-3 py-3 sm:px-6 sm:py-6">
        <div class="mb-3 flex items-center gap-2 text-[13px] font-semibold text-stone-500 dark:text-zinc-400">
          <Link href="/districts" class="hover:text-blue-600 hover:underline dark:hover:text-blue-400">Районы</Link>
          <i class="pi pi-chevron-right text-[10px]" />
          <span class="truncate text-ink-900 dark:text-zinc-200">{{ page.district.value?.name ?? '…' }}</span>
        </div>

        <div v-if="page.loading.value && !page.district.value" class="grid gap-3">
          <div class="h-44 animate-pulse rounded-3xl bg-white dark:bg-zinc-900" />
          <div class="h-24 animate-pulse rounded-3xl bg-white dark:bg-zinc-900" />
        </div>

        <div v-else-if="page.district.value" class="grid gap-3">
          <DistrictCommunityHeader
            :name="page.district.value.name"
            :avatar-letter="page.avatarLetter.value"
            :type-line="page.typeLine.value"
            :members-count="page.district.value.members_count"
            :pins-count="page.district.value.pins_count"
            :role-label="page.roleLabel.value"
            :role-tone="page.roleTone.value"
            :cover-url="page.coverUrl.value"
            :can-edit-cover="page.isOwner.value"
            :uploading-cover="page.cover.uploading.value"
            @edit-cover="page.cover.openPicker()"
            @remove-cover="page.cover.remove()"
          >
            <template #actions>
              <Button v-if="page.isGuest.value" label="Вступить" icon="pi pi-user-plus" rounded class="w-full !border-0 !bg-blue-600 !text-sm !font-bold !text-white hover:!bg-blue-500 sm:w-auto sm:flex-1" @click="page.join()" />
              <Button v-if="page.isPending.value" label="Заявка отправлена" icon="pi pi-clock" rounded disabled class="w-full !text-sm !font-bold sm:w-auto sm:flex-1" />
              <div v-if="page.isInvited.value" class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-1">
                <Button label="Принять" icon="pi pi-check" rounded class="!border-0 !bg-emerald-500 !text-sm !font-bold !text-white" @click="page.acceptInvite()" />
                <Button label="Отклонить" rounded outlined severity="secondary" class="!text-sm !font-bold" @click="page.declineInvite()" />
              </div>
              <Button v-if="page.canChat.value" label="Сообщение" icon="pi pi-comments" rounded class="w-full !border-0 !bg-ink-900 !text-sm !font-bold !text-white sm:w-auto dark:!bg-white dark:!text-ink-900" @click="page.openChat()" />
              <Button v-if="page.isMember.value || page.isPending.value" label="Выйти" rounded outlined severity="secondary" class="w-full !text-sm !font-bold sm:w-auto" @click="page.leave()" />
              <div class="flex w-full gap-2 sm:w-auto">
                <Button icon="pi pi-share-alt" rounded outlined severity="secondary" title="Поделиться" aria-label="Поделиться" class="!h-10 !w-10 !p-0 shrink-0" @click="page.share()" />
                <Button v-if="page.isOwner.value" icon="pi pi-user-plus" rounded outlined severity="secondary" title="Пригласить" aria-label="Пригласить" class="!h-10 !w-10 !p-0 shrink-0" @click="page.openInvite()" />
                <Button v-if="page.isOwner.value && !page.editing.value" icon="pi pi-pencil" rounded outlined severity="secondary" title="Редактировать" aria-label="Редактировать" class="!h-10 !w-10 !p-0 shrink-0" @click="page.startEdit()" />
                <Button v-if="page.isOwner.value" icon="pi pi-trash" rounded outlined severity="danger" title="Удалить" aria-label="Удалить" class="!h-10 !w-10 !p-0 shrink-0" @click="page.removeDistrict()" />
              </div>
            </template>
          </DistrictCommunityHeader>

          <div v-if="page.editing.value" class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div class="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Редактирование</div>
            <InputText v-model="page.editName.value" maxlength="80" placeholder="Название сообщества" class="mt-2 w-full !rounded-2xl" />
            <Textarea v-model="page.editDescription.value" maxlength="500" rows="3" auto-resize placeholder="Чем тут занимаются" class="mt-2 w-full !rounded-2xl !text-sm" />
            <DistrictInterestPicker :selected="page.editInterest.value" class="mt-2" @select="(v:string)=>page.editInterest.value=v" />
            <div class="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
              <Button label="Отмена" rounded outlined severity="secondary" class="flex-1" @click="page.cancelEdit()" />
              <Button label="Сохранить" icon="pi pi-check" rounded :loading="page.saving.value" class="flex-[1.4] !border-0 !bg-blue-600 !text-white hover:!bg-blue-500" @click="page.saveEdit()" />
            </div>
          </div>

          <DistrictCommunityTabs
            :active="page.activeTab.value"
            :members-count="page.residents.value.length"
            :requests-count="page.requestsCount.value"
            :show-requests="page.isOwner.value"
            @select="page.setTab($event)"
          />

          <div class="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div class="min-w-0">
              <div v-if="page.activeTab.value === 'feed'" class="grid gap-3">
                <DistrictNewsComposer
                  v-if="page.isOwner.value"
                  :title="news.title.value"
                  :body="news.body.value"
                  :body-left="news.bodyLeft.value"
                  :image-preview="news.imagePreview.value"
                  :saving="news.saving.value"
                  :editing="news.editingId.value !== null"
                  :can-submit="newsCanSubmit"
                  @update:title="(v: string | undefined) => news.title.value = v ?? ''"
                  @update:body="(v: string | undefined) => { const text = v ?? ''; news.body.value = text; news.bodyLeft.value = 2000 - text.length }"
                  @pick-image="(f: File | null) => news.pickImage(f)"
                  @clear-image="news.pickImage(null)"
                  @submit="news.submit()"
                  @cancel="news.resetComposer()"
                />
                <div v-if="news.loading.value" class="grid gap-3">
                  <div class="h-36 animate-pulse rounded-3xl bg-white dark:bg-zinc-900" />
                </div>
                <div v-else-if="news.posts.value.length" class="grid gap-3">
                  <DistrictNewsCard
                    v-for="post in news.posts.value"
                    :key="post.id"
                    :post="post"
                    :district-id="props.districtId"
                    :can-comment="canCommentNews"
                    :like-busy="!!news.likeBusy.value[post.id]"
                    @like="news.toggleLike"
                    @edit="news.startEdit"
                    @delete="news.remove"
                    @comments-delta="(postId: number, delta: number) => news.applyCommentsDelta(postId, delta)"
                  />
                </div>
                <div v-else class="rounded-2xl border border-dashed border-stone-300 p-3 text-center text-xs text-stone-400 dark:border-zinc-700 dark:text-zinc-500">
                  Новостей пока нет — {{ page.isOwner.value ? 'расскажите жителям, что происходит' : 'загляните позже' }}
                </div>
                <div class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div class="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">О сообществе</div>
                  <p v-if="page.district.value.description" class="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-900 dark:text-zinc-100">
                    {{ page.district.value.description }}
                  </p>
                  <p v-else class="mt-2 text-[13px] text-stone-400 dark:text-zinc-500">Без описания — спросите у жителей, что тут происходит.</p>
                </div>
                <div class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div class="mb-2 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Пины сообщества</div>
                  <div v-if="page.district.value.pins_locked" class="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center dark:border-zinc-700 dark:bg-white/[0.04]">
                    <i class="pi pi-lock text-xl text-stone-400 dark:text-zinc-500" />
                    <div class="mt-1 text-[13px] font-bold text-ink-900 dark:text-white">Записи скрыты</div>
                    <div class="mt-0.5 text-[11px] text-stone-500 dark:text-zinc-400">Внутри {{ page.district.value.pins_count }} · видят только жители</div>
                    <Button v-if="page.isGuest.value" label="Вступить" icon="pi pi-send" rounded size="small" class="mt-3 !border-0 !bg-blue-600 !text-white" @click="page.join()" />
                  </div>
                  <div v-else-if="(page.district.value.pins ?? []).length" class="grid gap-1.5">
                    <DistrictPinRow
                      v-for="pin in page.district.value.pins"
                      :key="pin.id"
                      :title="pin.title"
                      :category="pin.category"
                      :comments-count="pin.comments_count ?? 0"
                      :date-label="page.pinDate(pin)"
                      @open="page.openPin(pin)"
                    />
                  </div>
                  <div v-else class="rounded-2xl border border-dashed border-stone-300 p-3 text-center text-xs text-stone-400 dark:border-zinc-700 dark:text-zinc-500">
                    Пока тихо — станьте первым, кто поставит пин внутри
                  </div>
                </div>
              </div>

              <div v-if="page.activeTab.value === 'members'" class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div v-if="page.membersLoading.value" class="text-xs text-stone-400">Загружаем участников…</div>
                <div v-else-if="page.residents.value.length" class="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
                  <DistrictMemberRow
                    v-for="resident in page.residents.value"
                    :key="resident.id"
                    :user-id="resident.id"
                    :name="resident.name"
                    :avatar-url="resident.avatar_url"
                    :badge="resident.is_owner ? 'owner' : null"
                    :action="page.isOwner.value && !resident.is_owner ? 'kick' : 'none'"
                    @kick="page.kickMember"
                  />
                </div>
                <div v-else class="rounded-2xl border border-dashed border-stone-300 p-3 text-center text-xs text-stone-400 dark:border-zinc-700 dark:text-zinc-500">
                  Пока только владелец
                </div>
              </div>

              <div v-if="page.activeTab.value === 'info'" class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div class="divide-y divide-stone-100 text-sm dark:divide-zinc-800">
                  <div class="flex justify-between gap-3 py-3">
                    <span class="flex items-center gap-2 text-stone-500 dark:text-zinc-400"><i class="pi pi-tag" />Направление</span>
                    <span class="text-right font-semibold text-ink-900 dark:text-white">{{ page.interestLabel.value }}</span>
                  </div>
                  <div class="flex justify-between gap-3 py-3">
                    <span class="flex items-center gap-2 text-stone-500 dark:text-zinc-400"><i class="pi pi-users" />Участников</span>
                    <span class="font-semibold text-ink-900 dark:text-white">{{ page.district.value.members_count }}</span>
                  </div>
                  <div class="flex justify-between gap-3 py-3">
                    <span class="flex items-center gap-2 text-stone-500 dark:text-zinc-400"><i class="pi pi-map-marker" />Пинов</span>
                    <span class="font-semibold text-ink-900 dark:text-white">{{ page.district.value.pins_count }}</span>
                  </div>
                  <div v-if="page.district.value.owner" class="flex justify-between gap-3 py-3">
                    <span class="flex items-center gap-2 text-stone-500 dark:text-zinc-400"><i class="pi pi-crown" />Владелец</span>
                    <Link :href="`/users/${page.district.value.owner.id}`" class="truncate font-semibold text-blue-600 hover:underline dark:text-blue-400">
                      {{ page.district.value.owner.name }}
                    </Link>
                  </div>
                </div>
                <Button label="Открыть на карте" icon="pi pi-map" rounded outlined class="mt-3 w-full" @click="page.backToMap()" />
              </div>

              <div v-if="page.activeTab.value === 'requests' && page.isOwner.value" class="grid gap-3">
                <div class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div class="mb-2 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Приглашены · ждут ответа</div>
                  <div v-if="page.invited.value.length" class="grid gap-2">
                    <DistrictMemberRow
                      v-for="person in page.invited.value"
                      :key="person.id"
                      :user-id="person.id"
                      :name="person.name"
                      :avatar-url="person.avatar_url"
                      badge="invited"
                      action="cancel"
                      @cancel="page.cancelInvite"
                    />
                  </div>
                  <div v-else class="text-xs text-stone-400 dark:text-zinc-500">Исходящих приглашений нет</div>
                </div>
                <div class="rounded-3xl border border-stone-200/70 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div class="mb-2 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Заявки</div>
                  <div v-if="page.pending.value.length" class="grid gap-2">
                    <DistrictMemberRow
                      v-for="person in page.pending.value"
                      :key="person.id"
                      :user-id="person.id"
                      :name="person.name"
                      :avatar-url="person.avatar_url"
                      badge="pending"
                      action="approve"
                      @approve="page.approveMember"
                      @reject="page.rejectMember"
                    />
                  </div>
                  <div v-else class="rounded-2xl border border-dashed border-stone-300 p-3 text-center text-xs text-stone-400 dark:border-zinc-700 dark:text-zinc-500">
                    Заявок нет — все жители на месте
                  </div>
                </div>
              </div>
            </div>

            <aside class="grid min-w-0 gap-3">
              <div class="rounded-3xl border border-stone-200/70 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div class="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Контакты</div>
                <Link v-if="page.district.value.owner" :href="`/users/${page.district.value.owner.id}`" class="mt-2 block truncate text-sm font-bold text-blue-600 hover:underline dark:text-blue-400">
                  {{ page.district.value.owner.name }}
                </Link>
                <div class="text-[11px] text-stone-500 dark:text-zinc-400">администратор сообщества</div>
                <Button v-if="!page.isOwner.value" label="Написать" icon="pi pi-send" rounded size="small" :loading="page.writingOwner.value" class="mt-3 w-full !border-0 !bg-ink-900 !text-white dark:!bg-white dark:!text-ink-900" @click="page.writeToOwner()" />
              </div>
              <div class="rounded-3xl border border-stone-200/70 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div class="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">На карте</div>
                <p class="mt-2 text-[13px] leading-relaxed text-stone-500 dark:text-zinc-400">Заливка видна всем. Пины внутри — только жителям.</p>
                <Button label="Показать район" icon="pi pi-map-marker" rounded outlined size="small" class="mt-3 w-full" @click="page.backToMap()" />
              </div>
              <Message v-if="page.isPending.value" severity="info" :closable="false" class="!rounded-2xl !text-xs">Заявка на рассмотрении — владелец решит, пускать ли вас.</Message>
            </aside>
          </div>
        </div>

        <div v-else class="rounded-3xl border border-stone-200/70 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div class="text-lg font-black text-ink-900 dark:text-white">Район не найден</div>
          <p class="mt-1 text-sm text-stone-500 dark:text-zinc-400">Возможно, его удалили.</p>
          <Link href="/districts"><Button label="К списку районов" rounded class="mt-4 !border-0 !bg-blue-600 !text-white" /></Link>
        </div>
      </div>
    </div>
    <DistrictInviteDialog
      :open="page.invite.open.value"
      :district-name="page.invite.districtName.value"
      :query="page.invite.query.value"
      :results="page.invite.results.value"
      :searching="page.invite.searching.value"
      :inviting-id="page.invite.invitingId.value"
      :error="page.invite.error.value"
      @update:open="page.invite.setOpen"
      @update:query="page.invite.search"
      @invite="page.sendInvite"
    />
    <input
      :ref="page.cover.setFileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="page.cover.onFile"
    />
  </AuthenticatedLayout>
</template>
