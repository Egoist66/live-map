<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Avatar from 'primevue/avatar'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useGlobalPeopleSearch } from '@/composables/useGlobalPeopleSearch'
import { useChatSearchList } from '@/composables/useChatSearchUser'
import { useEnterToSend } from '@/composables/useEnterToSend'

const search = useGlobalPeopleSearch()
const { isDesktop } = useEnterToSend()
const { isFriend, isPending, showAdd, addTitle } = useChatSearchList()
</script>
<template>
  <Dialog
    :visible="search.open.value"
    @update:visible="(v: boolean) => { if (!v) search.close() }"
    modal
    header="Поиск людей"
    :style="{ width: '480px', maxWidth: '96vw', maxHeight: '92dvh' }"
    :pt="{ content: { class: '!pt-2 !max-h-[80dvh] !overflow-y-auto' } }"
  >
    <div class="text-xs text-stone-500 dark:text-zinc-400 mb-3">
      Найди человека по имени
    </div>

    <div class="relative w-full">
      <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 text-sm pointer-events-none z-[1]" />
      <InputText
        :model-value="search.query.value"
        @update:model-value="search.setQuery(String($event ?? ''))"
        placeholder="Имя, например Петр..."
        :autofocus="isDesktop"
        enterkeyhint="search"
        fluid
        class="!rounded-full !pl-10 !pr-10 !py-2.5 !text-base lg:!text-sm !border-stone-200 dark:!border-zinc-700 focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/30"
      />
      <i
        v-if="search.searching.value"
        class="pi pi-spin pi-spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 text-sm pointer-events-none"
      />
    </div>

    <div
      v-if="search.results.value.length"
      class="mt-3 max-h-[60dvh] sm:max-h-[52vh] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border rounded-2xl bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-sm"
    >
      <div
        v-for="u in search.results.value"
        :key="u.id"
        @click="search.openProfile(u.id)"
        @keydown.enter="search.openProfile(u.id)"
        tabindex="0"
        role="link"
        class="flex items-center justify-between p-3 select-none cursor-pointer hover:bg-stone-50 dark:hover:bg-zinc-800/60 transition rounded-xl"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="relative shrink-0">
            <Avatar
              :image="avatarSrcFor(u)"
              shape="circle"
              size="normal"
              class="!w-9 !h-9 [&_img]:object-cover"
            />
            <OnlineDot
              :online="search.isOnline(u.id, u.last_seen_at)"
              size="w-3 h-3"
            />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium truncate dark:text-white">{{ u.name }}</div>
          </div>
        </div>

        <div class="flex gap-1.5 shrink-0 ml-2 items-center">
          <Button
            v-if="u.can_message !== false"
            @click.stop="search.startChat(u)"
            :loading="search.creating.value"
            rounded
            title="Написать сообщение"
            aria-label="Написать сообщение"
            icon="pi pi-send"
            class="!w-9 !h-9 !p-0"
          />
          <Button
            v-if="showAdd(u)"
            @click.stop="search.addFriend(u.id)"
            rounded
            severity="info"
            text
            :title="addTitle(u)"
            :aria-label="addTitle(u)"
            icon="pi pi-user-plus"
            class="!w-9 !h-9 !p-0"
          />
          <span
            v-else-if="isPending(u)"
            :title="addTitle(u)"
            class="w-9 h-9 grid place-items-center rounded-full bg-stone-100 text-stone-400 dark:bg-zinc-800 dark:text-zinc-500"
          >
            <i class="pi pi-clock text-sm" />
          </span>
          <span
            v-else-if="isFriend(u)"
            :title="addTitle(u)"
            class="w-9 h-9 grid place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          >
            <i class="pi pi-check text-sm" />
          </span>
          <Button
            @click.stop="search.askBlock(u.id, u.name)"
            rounded
            severity="danger"
            text
            title="Заблокировать"
            aria-label="Заблокировать"
            icon="pi pi-ban"
            class="!w-9 !h-9 !p-0"
          />
        </div>
      </div>
    </div>

    <div
      v-else-if="search.hasQuery.value && !search.searching.value"
      class="mt-4 text-center py-6 text-sm text-stone-500 dark:text-zinc-400"
    >
      Ничего не найдено
    </div>
    <div
      v-else
      class="mt-4 text-center py-6 text-xs text-stone-400 dark:text-zinc-500"
    >
      Введи имя для поиска
    </div>
  </Dialog>
</template>
