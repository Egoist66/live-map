<script setup lang="ts">
defineProps<{ sheet: any; isOwnMessage: (m: any) => boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'openChat', id: number): void; (e: 'startChat', u: any): void; (e: 'edit', m: any): void; (e: 'deleteMessage', id: number): void; (e: 'deleteChat', id?: number): void; (e: 'block', id: number, name?: string): void; (e: 'unblock', id: number): void; (e: 'removeFriend', f: any): void; (e: 'accept', id: number): void; (e: 'decline', id: number): void; (e: 'add', id: number): void }>()
</script>
<template>
  <div v-if="sheet" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')"></div>
    <div class="relative w-full sm:max-w-[360px] bg-white dark:bg-zinc-900 rounded-t-[24px] sm:rounded-2xl shadow-2xl border p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] max-h-[80dvh] overflow-auto">
      <div class="w-10 h-1 rounded-full bg-stone-200 mx-auto my-2.5 shrink-0"></div>
      <div class="px-2 pb-2 space-y-1">
        <template v-if="sheet.type === 'message'">
          <button v-if="isOwnMessage(sheet.data)" @click="emit('edit', sheet.data)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-stone-50 text-[15px] font-medium text-left">Редактировать</button>
          <button v-if="isOwnMessage(sheet.data)" @click="emit('deleteMessage', sheet.data?.id)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 text-[15px] font-medium text-left text-red-600">Удалить сообщение</button>
          <button class="w-full px-4 py-3.5 rounded-2xl bg-stone-100 text-[15px] font-medium justify-center mt-1" @click="emit('close')">Отмена</button>
        </template>
        <template v-else-if="sheet.type === 'chat'">
          <div class="px-4 py-3 border-b mb-1"><div class="text-[15px] font-bold truncate">{{ sheet.data?.other?.name }}</div></div>
          <button @click="emit('openChat', sheet.data?.id)" class="w-full px-4 py-3.5 rounded-2xl hover:bg-violet-50 text-[15px] font-medium text-left text-violet-700">Открыть чат</button>
          <button @click="emit('deleteChat', sheet.data?.id)" class="w-full px-4 py-3.5 rounded-2xl text-[15px] font-medium text-left text-red-600">Удалить чат</button>
          <button v-if="sheet.data?.other?.id" @click="emit('block', sheet.data.other.id, sheet.data.other.name)" class="w-full px-4 py-3.5 rounded-2xl text-[15px] font-medium text-left text-red-600">Заблокировать</button>
          <button @click="emit('close')" class="w-full px-4 py-3.5 rounded-2xl bg-stone-100 text-[15px] font-medium justify-center mt-1">Отмена</button>
        </template>
        <template v-else-if="sheet.type === 'friend'">
          <div class="px-4 py-2 border-b mb-1"><div class="text-[15px] font-bold">{{ sheet.data?.other?.name }}</div></div>
          <button @click="emit('startChat', sheet.data?.other)" class="w-full px-4 py-3.5 rounded-2xl text-[15px] font-medium text-left text-violet-700">Написать</button>
          <button @click="emit('removeFriend', sheet.data)" class="w-full px-4 py-3.5 rounded-2xl text-[15px] font-medium text-left text-red-600">Удалить из друзей</button>
          <button v-if="sheet.data?.other?.id" @click="emit('block', sheet.data.other.id, sheet.data.other.name)" class="w-full px-4 py-3.5 rounded-2xl text-[15px] font-medium text-left text-red-600">Заблокировать</button>
          <button @click="emit('close')" class="w-full px-4 py-3.5 rounded-2xl bg-stone-100 text-[15px] font-medium justify-center mt-1">Отмена</button>
        </template>
        <template v-else-if="sheet.type === 'request'">
          <div class="px-4 py-2 border-b mb-1"><div class="text-[15px] font-bold">{{ sheet.data?.requester?.name }}</div><div class="text-xs text-stone-500">хочет дружить</div></div>
          <button @click="emit('accept', sheet.data?.id)" class="w-full px-4 py-3.5 rounded-2xl bg-green-600 text-white text-[15px] font-medium text-left">Принять</button>
          <button @click="emit('decline', sheet.data?.id)" class="w-full px-4 py-3.5 rounded-2xl text-[15px] font-medium text-left text-red-600">Отклонить</button>
          <button @click="emit('close')" class="w-full px-4 py-3.5 rounded-2xl bg-stone-100 text-[15px] font-medium justify-center mt-1">Отмена</button>
        </template>
        <template v-else-if="sheet.type === 'search'">
          <div class="px-4 py-2 border-b mb-1"><div class="text-[15px] font-bold">{{ sheet.data?.name }}</div><div v-if="sheet.data?.is_friend" class="text-xs text-green-600">Уже в друзьях</div><div v-else-if="sheet.data?.is_pending" class="text-xs text-stone-500">Заявка отправлена</div></div>
          <button v-if="sheet.data?.can_message !== false" @click="emit('startChat', sheet.data)" class="w-full px-4 py-3.5 rounded-2xl text-[15px] font-medium text-left text-violet-700">Написать</button>
          <button v-if="!sheet.data?.is_friend && !sheet.data?.is_pending" @click="emit('add', sheet.data?.id)" class="w-full px-4 py-3.5 rounded-2xl text-[15px] font-medium text-left">В друзья</button>
          <button @click="emit('block', sheet.data?.id, sheet.data?.name)" class="w-full px-4 py-3.5 rounded-2xl text-[15px] font-medium text-left text-red-600">Заблокировать</button>
          <button @click="emit('close')" class="w-full px-4 py-3.5 rounded-2xl bg-stone-100 text-[15px] font-medium justify-center mt-1">Отмена</button>
        </template>
      </div>
    </div>
  </div>
</template>
