<script setup lang="ts">
import Dialog from "primevue/dialog";
import Avatar from "primevue/avatar";
import Button from "primevue/button";
import Badge from "primevue/badge";
import { watch } from "vue";
import { useBellNotifications } from "@/composables/useBellNotifications";
import { usePinActivity } from "@/composables/usePinActivity";
import { useAdminReports } from "@/composables/useAdminReports";
import { avatarSrcFor } from "@/composables/useAvatar";

const bell = useBellNotifications();
const pinAct = usePinActivity();
const admRep = useAdminReports();
watch(
  () => bell.isOpen.value,
  (open) => {
    if (open) {
      pinAct.refresh();
      admRep.refresh();
    }
  }
);
function fmtTime(s: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
</script>
<template>
  <Dialog
    v-model:visible="bell.isOpen.value"
    modal
    :draggable="false"
    :closable="true"
    position="top"
    :style="{ width: '380px', maxWidth: 'calc(100vw - 1.5rem)', marginTop: '4.5rem', maxHeight: '80dvh' }"
    :pt="{
      root: {
        class: '!rounded-[24px] p-2 !border-stone-200 dark:!border-zinc-800 overflow-hidden',
      },
      header: { class: '!p-0 !border-0' },
      content: { class: '!p-0 !bg-white dark:!bg-zinc-900' },
    }"
  >
    <template #header>
      <div class="w-full flex items-center justify-between px-5 pt-5 pb-3">
        <div class="flex items-center gap-2.5">
          <span
            class="w-9 h-9 rounded-full bg-violet-600 grid place-items-center text-white shadow"
            ><i class="pi pi-bell text-sm"></i
          ></span>
          <div>
            <div class="text-[15px] font-black dark:text-white leading-none">
              Уведомления
            </div>
            <div class="text-xs text-stone-500 dark:text-zinc-400">последние события</div>
          </div>
        </div>
        <Badge
          v-if="bell.unreadCount.value + bell.pending.value.length + pinAct.unread.value + admRep.pendingCount.value"
          :value="(bell.unreadCount.value + bell.pending.value.length + pinAct.unread.value + admRep.pendingCount.value)>9?'9+':String(bell.unreadCount.value + bell.pending.value.length + pinAct.unread.value + admRep.pendingCount.value)"
          severity="danger"
        />
      </div>
    </template>
    <div class="px-3 pb-3">
      <div v-if="bell.loading.value" class="py-10 grid place-items-center">
        <span
          class="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"
        ></span>
      </div>
      <template v-else>
        <div v-if="!bell.hasData.value && !pinAct.activities.value.length && !admRep.reports.value.length" class="py-10 text-center">
          <div
            class="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-zinc-800 grid place-items-center mx-auto text-xl"
          >
            🔔
          </div>
          <div class="text-sm font-semibold dark:text-white mt-3">Пока тихо</div>
          <div class="text-xs text-stone-500 mt-1">Новых сообщений, заявок и реакций нет</div>
        </div>
        <template v-else>
          <div v-if="admRep.reports.value.length" class="mb-3">
            <div
              class="text-[11px] font-bold tracking-widest uppercase text-stone-400 px-2 py-1.5 flex items-center gap-1.5"
            >
              Жалобы
              <span
                v-if="admRep.pendingCount.value"
                class="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                >{{ admRep.pendingCount.value }}</span
              >
            </div>
            <div class="space-y-1">
              <button
                v-for="r in admRep.reports.value.slice(0, 5)"
                :key="r.id"
                @click="bell.close(); admRep.goReports()"
                class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800"
              >
                <span
                  class="w-10 h-10 rounded-full bg-red-600 text-white grid place-items-center shrink-0"
                  ><i class="pi pi-flag text-sm"></i
                ></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold dark:text-white truncate">
                    {{ r.reason_label || r.reason }} · {{ r.target_type }} #{{ r.target_id }}
                  </div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                    {{ r.target_title || r.description || `от ${r.reporter?.name || 'пользователя'}` }}
                  </div>
                </div>
                <i class="pi pi-chevron-right text-stone-300 text-xs shrink-0"></i>
              </button>
            </div>
            <button
              @click="bell.close(); admRep.goReports()"
              class="w-full mt-1 text-xs font-semibold text-violet-600 hover:text-violet-700 py-1.5"
            >
              Открыть жалобы →
            </button>
          </div>
          <div v-if="pinAct.activities.value.length" class="mb-3">
            <div
              class="text-[11px] font-bold tracking-widest uppercase text-stone-400 px-2 py-1.5 flex items-center gap-1.5"
            >
              Активность пинов
              <span
                v-if="pinAct.unread.value"
                class="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                >{{ pinAct.unread.value }}</span
              >
              <button
                v-if="pinAct.unread.value"
                @click="pinAct.markAllRead()"
                class="ml-auto text-[11px] font-semibold text-violet-600 hover:text-violet-700 normal-case tracking-normal"
              >
                Прочитать все
              </button>
            </div>
            <div class="space-y-1">
              <button
                v-for="a in pinAct.activities.value"
                :key="a.id"
                @click="pinAct.goPin(a)"
                :class="
                  !a.read_at
                    ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800'
                    : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                "
                class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition"
              >
                <span class="relative shrink-0"
                  ><Avatar
                    :image="avatarSrcFor(a.actor)"
                    shape="circle"
                    class="!w-10 !h-10 [&_img]:object-cover"
                    :pt="{ image: { class: 'object-cover' } }" /><span
                    class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-[10px]"
                    :class="a.kind === 'comment' ? 'bg-violet-600' : 'bg-rose-500'"
                    >{{ pinAct.describe(a).emoji }}</span
                  ></span
                >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-semibold dark:text-white truncate">{{
                      a.pin?.title || "Ваш пин"
                    }}</span
                    ><span
                      v-if="a.created_at"
                      class="text-[11px] text-stone-400 shrink-0"
                      >{{ fmtTime(a.created_at) }}</span
                    >
                  </div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                    {{ pinAct.describe(a).text }}
                  </div>
                </div>
                <span
                  v-if="!a.read_at"
                  class="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0"
                ></span>
                <i v-else class="pi pi-chevron-right text-stone-300 text-xs shrink-0"></i>
              </button>
            </div>
          </div>
          <div v-if="bell.pending.value.length" class="mb-3">
            <div
              class="text-[11px] font-bold tracking-widest uppercase text-stone-400 px-2 py-1.5 flex items-center gap-1.5"
            >
              Заявки
              <span
                class="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                >{{ bell.pending.value.length }}</span
              >
            </div>
            <div class="space-y-1">
              <button
                v-for="r in bell.pending.value"
                :key="r.id"
                @click="bell.goRequests()"
                class="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-amber-50 dark:hover:bg-zinc-800 text-left transition"
              >
                <Avatar
                  :image="avatarSrcFor(r.requester)"
                  shape="circle"
                  class="!w-10 !h-10 shrink-0 [&_img]:object-cover"
                  :pt="{ image: { class: 'object-cover' } }"
                />
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold dark:text-white truncate">
                    {{ r.requester?.name }}
                  </div>
                  <div class="text-xs text-amber-600 dark:text-amber-400 truncate">
                    хочет дружить
                  </div>
                </div>
                <span
                  class="w-7 h-7 rounded-full bg-amber-500 text-white grid place-items-center shrink-0"
                  ><i class="pi pi-user-plus text-xs"></i
                ></span>
              </button>
            </div>
            <button
              @click="bell.goRequests()"
              class="w-full mt-1 text-xs font-semibold text-violet-600 hover:text-violet-700 py-1.5"
            >
              Открыть заявки →
            </button>
          </div>
          <div v-if="bell.conversations.value.length" class="mb-1">
            <div
              class="text-[11px] font-bold tracking-widest uppercase text-stone-400 px-2 py-1.5"
            >
              Сообщения
            </div>
            <div class="space-y-1">
              <button
                v-for="c in bell.conversations.value"
                :key="c.id"
                @click="bell.goChat(c.id)"
                :class="
                  c.unread_count
                    ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-800'
                    : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                "
                class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition"
              >
                <span class="relative shrink-0"
                  ><Avatar
                    :image="avatarSrcFor(c.other)"
                    shape="circle"
                    class="!w-10 !h-10 [&_img]:object-cover"
                    :pt="{ image: { class: 'object-cover' } }" /><span
                    v-if="c.unread_count"
                    class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"
                  ></span
                ></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-semibold dark:text-white truncate">{{
                      c.other?.name || "Чат"
                    }}</span
                    ><span
                      v-if="c.last_message_at"
                      class="text-[11px] text-stone-400 shrink-0"
                      >{{ fmtTime(c.last_message_at) }}</span
                    >
                  </div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                    {{ c.last_message?.body || "Нет сообщений" }}
                  </div>
                </div>
                <span
                  v-if="c.unread_count"
                  class="bg-violet-600 text-white text-xs font-bold min-w-[22px] h-[22px] grid place-items-center px-1.5 rounded-full shrink-0"
                  >{{ c.unread_count > 9 ? "9+" : c.unread_count }}</span
                >
                <i v-else class="pi pi-chevron-right text-stone-300 text-xs shrink-0"></i>
              </button>
            </div>
          </div>
        </template>
      </template>
    </div>
  </Dialog>
</template>
