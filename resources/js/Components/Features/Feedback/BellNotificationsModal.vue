<script setup lang="ts">
import Dialog from "primevue/dialog";
import Avatar from "primevue/avatar";
import Button from "primevue/button";
import Badge from "primevue/badge";
import Tag from "primevue/tag";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import ProgressSpinner from "primevue/progressspinner";
import { watch, computed } from "vue";
import { router, usePage } from "@inertiajs/vue3";
import { useBellNotifications } from "@/composables/useBellNotifications";
import MessageTicks from "@/Components/Features/Feedback/MessageTicks.vue";
import { useChatListTicks } from "@/composables/useChatListTicks";
import { usePinActivity } from "@/composables/usePinActivity";
import { useAdminReports } from "@/composables/useAdminReports";
import { useAppUpdates } from "@/composables/useAppUpdates";
import { useAppUpdateModal } from "@/composables/useAppUpdateModal";
import { useSecurityImpersonations } from "@/composables/useSecurityImpersonations";
import { useBellUloveMode, countAppUnread, uloveHeaderBadge } from "@/composables/useBellUloveMode";
import { avatarSrcFor } from "@/composables/useAvatar";
import { useAppConfirm } from "@/composables/useAppConfirm";
import { useNotificationsReadAll } from "@/composables/useNotificationsReadAll";
import { useNotificationMedia } from "@/composables/useNotificationMedia";
import { describeInboxRow } from "@/services/notifications.api";

const bell = useBellNotifications();
const bellTicks = useChatListTicks(() => Number((usePage().props.auth as any)?.user?.id ?? 0));
const readAllState = useNotificationsReadAll();
const media = useNotificationMedia();
const pinAct = usePinActivity();
const admRep = useAdminReports();
const updates = useAppUpdates();
const newsGuide = useAppUpdateModal();
const proc = useSecurityImpersonations();
const bellMode = useBellUloveMode();
const uloveOnly = bellMode.uloveOnly;
/** App-уведомления (от разработчиков) для ULove-режима: только type app.*. */
const appNotifications = computed(() => bellMode.onlyApp(pinAct.otherNotifications.value));
const appUnread = computed(() => countAppUnread(appNotifications.value));
/** Бейдж шапки в ULove-режиме: ULove + сообщения + безопасность + app + новости. */
const uloveBadge = computed(() =>
  uloveHeaderBadge({
    loveUnread: pinAct.loveUnread.value,
    chatUnread: bell.unreadCount.value,
    securityUnread: proc.unread.value,
    appUnread: appUnread.value,
    newsUnread: updates.unreadCount.value,
  }),
);
/** Есть ли что показать в ULove-режиме (события без пинов/друзей). */
const uloveHasData = computed(
  () =>
    pinAct.loveActivities.value.length > 0 ||
    appNotifications.value.length > 0 ||
    proc.items.value.length > 0 ||
    bell.conversations.value.length > 0,
);
const { confirmDelete } = useAppConfirm();
async function askClearActivities() {
  const ok = await confirmDelete(
    "Все уведомления будут удалены из базы навсегда. Это нельзя отменить.",
    "Очистить уведомления?"
  ).catch(() => false);
  if (!ok) return;
  await pinAct.clearAll();
}
watch(
  () => bell.isOpen.value,
  async (open) => {
    if (!open) {
      return;
    }
    bell.tab.value = "events";
    // Только подтягиваем свежие данные. Прочитанным ничего не помечаем:
    // иначе строка пропадает из непрочитанных раньше, чем пользователь её увидел.
    await Promise.allSettled([
      pinAct.refresh(),
      admRep.refresh(),
      updates.loadUnread(),
      updates.loadHistory(),
      proc.load(),
    ]);
  }
);
function goProcedures() {
  bell.close();
  router.visit("/settings/procedures");
}
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
function fmtDay(s: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}
function openNews(item: any) {
  bell.close();
  updates.preview(item);
}
</script>
<template>
  <Dialog
    v-model:visible="bell.isOpen.value"
    modal
    :draggable="false"
    :closable="true"
    position="top"
    :breakpoints="{ '640px': '100vw' }"
    :style="{ width: '560px', maxWidth: 'calc(100vw - 1.5rem)', marginTop: '4.5rem', maxHeight: '85dvh' }"
    :pt="{
      root: {
        class: '!rounded-[24px] sm:!rounded-[24px] !rounded-b-none sm:!rounded-b-[24px] p-2 !border-stone-200 dark:!border-zinc-800 overflow-hidden notif-modal',
      },
      header: { class: '!p-0 !border-0' },
      content: { class: '!p-0 !bg-white dark:!bg-zinc-900' },
    }"
  >
    <template #header>
      <div class="w-full flex items-center justify-between gap-2 px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            class="w-9 h-9 rounded-full bg-violet-600 grid place-items-center text-white shadow shrink-0"
            ><i class="pi pi-bell text-sm"></i
          ></span>
          <div class="min-w-0">
            <div class="text-[15px] font-black dark:text-white leading-none">
              Уведомления
            </div>
            <div class="text-xs text-stone-500 dark:text-zinc-400">последние события</div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <Button
            v-if="readAllState.hasUnread.value"
            @click="readAllState.readAll()"
            :loading="readAllState.reading.value"
            icon="pi pi-check"
            text
            rounded
            severity="success"
            aria-label="Прочитать все уведомления"
            v-tooltip.bottom="'Прочитать все'"
            class="!w-9 !h-9"
          />
          <Button
            v-if="pinAct.activities.value.length"
            @click="askClearActivities()"
            :loading="pinAct.clearing.value"
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            aria-label="Очистить уведомления"
            v-tooltip.bottom="'Очистить уведомления'"
            class="!w-9 !h-9"
          />
          <Badge
            v-if="uloveOnly ? uloveBadge : (bell.unreadCount.value + bell.pending.value.length + pinAct.unread.value + admRep.pendingCount.value + updates.unreadCount.value + proc.unread.value)"
            :value="(uloveOnly ? uloveBadge : (bell.unreadCount.value + bell.pending.value.length + pinAct.unread.value + admRep.pendingCount.value + updates.unreadCount.value + proc.unread.value))>9?'9+':String(uloveOnly ? uloveBadge : (bell.unreadCount.value + bell.pending.value.length + pinAct.unread.value + admRep.pendingCount.value + updates.unreadCount.value + proc.unread.value))"
            severity="danger"
          />
        </div>
      </div>
    </template>
    <div class="px-2 sm:px-3 pb-3 pb-safe">
      <Tabs v-model:value="bell.tab.value" class="notif-tabs">
        <TabList class="!bg-transparent overflow-x-auto" :pt="{ activeBar: { class: '!bg-violet-600' } }">
          <Tab value="events" class="!text-[13px] !font-bold whitespace-nowrap">
            <span class="flex items-center gap-1.5">События
              <Badge v-if="uloveOnly ? (pinAct.loveUnread.value + bell.unreadCount.value + proc.unread.value + appUnread) : (pinAct.eventUnread.value + bell.pending.value.length + bell.unreadCount.value + proc.unread.value)" :value="((uloveOnly ? (pinAct.loveUnread.value + bell.unreadCount.value + proc.unread.value + appUnread) : (pinAct.eventUnread.value + bell.pending.value.length + bell.unreadCount.value + proc.unread.value))) > 9 ? '9+' : String(uloveOnly ? (pinAct.loveUnread.value + bell.unreadCount.value + proc.unread.value + appUnread) : (pinAct.eventUnread.value + bell.pending.value.length + bell.unreadCount.value + proc.unread.value))" severity="danger" class="!text-[10px] !min-w-[20px] !h-5" />
            </span>
          </Tab>
          <Tab v-if="!uloveOnly" value="pins" class="!text-[13px] !font-bold whitespace-nowrap">
            <span class="flex items-center gap-1.5">Пины
              <Badge v-if="pinAct.pinUnread.value" :value="pinAct.pinUnread.value > 9 ? '9+' : String(pinAct.pinUnread.value)" severity="danger" class="!text-[10px] !min-w-[20px] !h-5" />
            </span>
          </Tab>
          <Tab v-if="!bell.isAdmin.value" value="news" class="!text-[13px] !font-bold whitespace-nowrap">
            <span class="flex items-center gap-1.5">Новости<Badge v-if="updates.unreadCount.value" :value="updates.unreadCount.value > 9 ? '9+' : String(updates.unreadCount.value)" severity="info" class="!text-[10px] !min-w-[20px] !h-5" /></span>
          </Tab>
        </TabList>
        <TabPanels class="!p-0 !bg-transparent">
          <TabPanel value="events">
            <div class="notif-scroll">
              <div v-if="bell.loading.value" class="py-10 grid place-items-center">
                <ProgressSpinner style="width:26px;height:26px" :strokeWidth="6" />
              </div>
              <template v-else>
                <div v-if="uloveOnly ? !uloveHasData : (!bell.hasData.value && !pinAct.eventActivities.value.length && !pinAct.otherNotifications.value.length && !admRep.reports.value.length && !proc.items.value.length)" class="py-10 text-center px-4">
                  <div
                    class="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-zinc-800 grid place-items-center mx-auto text-xl"
                  >
                    {{ uloveOnly ? '💞' : '🔔' }}
                  </div>
                  <div class="text-sm font-semibold dark:text-white mt-3">Пока тихо</div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1">{{ uloveOnly ? 'Новых мэтчей, сообщений и новостей нет' : 'Новых сообщений, заявок, лайков и постов нет' }}</div>
                </div>
                <template v-else>
                  <div v-if="!uloveOnly && admRep.reports.value.length" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
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
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800 min-h-[56px]"
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
                        <i class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                    <Button
                      @click="bell.close(); admRep.goReports()"
                      label="Открыть жалобы →"
                      link
                      size="small"
                      class="w-full !text-xs"
                    />
                  </div>
                  <div v-if="proc.items.value.length" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
                    >
                      <span class="text-red-500">❗</span> Безопасность
                      <span
                        v-if="proc.unread.value"
                        class="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                        >{{ proc.unread.value }}</span
                      >
                      <Button
                        v-if="proc.unread.value"
                        @click="proc.markRead()"
                        label="Прочитано"
                        link
                        size="small"
                        class="ml-auto !text-[11px]"
                      />
                    </div>
                    <div class="space-y-1">
                      <button
                        v-for="l in proc.items.value.slice(0, 5)"
                        :key="l.id"
                        @click="goProcedures()"
                        :class="
                          !l.seen_at
                            ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800'
                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                        "
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
                      >
                        <span
                          class="w-10 h-10 rounded-full bg-red-600 text-white grid place-items-center shrink-0"
                          ><i class="pi pi-eye text-sm"></i
                        ></span>
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-semibold dark:text-white truncate">
                            Служебный вход
                          </div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                            {{ (l.reason || '').slice(0, 80) }}{{ l.started_at ? ` · ${fmtTime(l.started_at)}` : '' }}
                          </div>
                        </div>
                        <span
                          v-if="!l.seen_at"
                          class="text-red-500 text-base shrink-0"
                          >❗</span
                        >
                        <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                    <Button
                      @click="goProcedures()"
                      label="Открыть процедуры →"
                      link
                      size="small"
                      class="w-full !text-xs"
                    />
                  </div>
                  <div v-if="pinAct.loveActivities.value.length" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
                    >
                      Знакомства
                      <span
                        v-if="pinAct.loveUnread.value"
                        class="bg-pink-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                        >{{ pinAct.loveUnread.value }}</span
                      >
                    </div>
                    <div class="space-y-1">
                      <button
                        v-for="a in pinAct.loveActivities.value"
                        :key="a.id"
                        @click="bell.close(); pinAct.goPin(a)"
                        :class="
                          !a.read_at
                            ? 'bg-pink-50 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-800'
                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                        "
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
                      >
                        <span class="relative shrink-0"
                          ><Avatar
                            :image="avatarSrcFor(a.actor)"
                            shape="circle"
                            class="!w-10 !h-10 [&_img]:object-cover"
                            :pt="{ image: { class: 'object-cover' } }" /><span
                            class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-[10px] bg-pink-500"
                            >{{ pinAct.describe(a).emoji }}</span
                          ></span
                        >
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-sm font-semibold dark:text-white truncate">{{
                              a.kind === 'match' ? "Новый мэтч!" : "ULove"
                            }}</span
                            ><span
                              v-if="a.created_at"
                              class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0"
                              >{{ fmtTime(a.created_at) }}</span
                            >
                          </div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                            {{ pinAct.describe(a).text }}
                          </div>
                        </div>
                        <span
                          v-if="!a.read_at"
                          class="w-2.5 h-2.5 bg-pink-500 rounded-full shrink-0"
                        ></span>
                        <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                  </div>
                  <div v-if="!uloveOnly && pinAct.flowActivities.value.length" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
                    >
                      UFlow
                      <span
                        v-if="pinAct.flowUnread.value"
                        class="bg-sky-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                        >{{ pinAct.flowUnread.value }}</span
                      >
                    </div>
                    <div class="space-y-1">
                      <button
                        v-for="a in pinAct.flowActivities.value"
                        :key="a.id"
                        @click="bell.close(); pinAct.goPin(a)"
                        :class="
                          !a.read_at
                            ? 'bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-800'
                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                        "
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
                      >
                        <span class="relative shrink-0"
                          ><Avatar
                            :image="avatarSrcFor(a.actor)"
                            shape="circle"
                            class="!w-10 !h-10 [&_img]:object-cover"
                            :pt="{ image: { class: 'object-cover' } }" /><span
                            class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-[10px] bg-sky-500"
                            >{{ pinAct.describe(a).emoji }}</span
                          ></span
                        >
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-sm font-semibold dark:text-white truncate">UFlow</span
                            ><span
                              v-if="a.created_at"
                              class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0"
                              >{{ fmtTime(a.created_at) }}</span
                            >
                          </div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                            {{ pinAct.describe(a).text }}
                          </div>
                        </div>
                        <img
                          v-if="media.entityImage(a)"
                          :src="media.entityImage(a) || ''"
                          alt="Миниатюра поста"
                          loading="lazy"
                          class="w-11 h-11 rounded-xl object-cover shrink-0 border border-stone-200 dark:border-zinc-700"
                        />
                        <span
                          v-if="!a.read_at"
                          class="w-2.5 h-2.5 bg-sky-500 rounded-full shrink-0"
                        ></span>
                        <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                  </div>
                  <div v-if="!uloveOnly && pinAct.photoActivities.value.length" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
                    >
                      Фото
                      <span
                        v-if="pinAct.photoUnread.value"
                        class="bg-sky-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                        >{{ pinAct.photoUnread.value }}</span
                      >
                    </div>
                    <div class="space-y-1">
                      <button
                        v-for="a in pinAct.photoActivities.value"
                        :key="a.id"
                        @click="bell.close(); pinAct.goPin(a)"
                        :class="
                          !a.read_at
                            ? 'bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-800'
                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                        "
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
                      >
                        <span class="relative shrink-0"
                          ><Avatar
                            :image="avatarSrcFor(a.actor)"
                            shape="circle"
                            class="!w-10 !h-10 [&_img]:object-cover"
                            :pt="{ image: { class: 'object-cover' } }" /><span
                            class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-[10px] bg-sky-500"
                            >{{ pinAct.describe(a).emoji }}</span
                          ></span
                        >
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-sm font-semibold dark:text-white truncate">Фото</span
                            ><span
                              v-if="a.created_at"
                              class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0"
                              >{{ fmtTime(a.created_at) }}</span
                            >
                          </div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                            {{ pinAct.describe(a).text }}
                          </div>
                        </div>
                        <img
                          v-if="media.entityImage(a)"
                          :src="media.entityImage(a) || ''"
                          alt="Миниатюра фото"
                          loading="lazy"
                          class="w-11 h-11 rounded-xl object-cover shrink-0 border border-stone-200 dark:border-zinc-700"
                        />
                        <span
                          v-if="!a.read_at"
                          class="w-2.5 h-2.5 bg-sky-500 rounded-full shrink-0"
                        ></span>
                        <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                  </div>
                  <div v-if="!uloveOnly && pinAct.subActivities.value.length" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
                    >
                      Подписки
                    </div>
                    <div class="space-y-1">
                      <button
                        v-for="a in pinAct.subActivities.value"
                        :key="a.id"
                        @click="bell.close(); pinAct.goPin(a)"
                        :class="
                          !a.read_at
                            ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-800'
                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                        "
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
                      >
                        <span class="relative shrink-0"
                          ><Avatar
                            :image="avatarSrcFor(a.actor)"
                            shape="circle"
                            class="!w-10 !h-10 [&_img]:object-cover"
                            :pt="{ image: { class: 'object-cover' } }" /><span
                            class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-[10px] bg-violet-600"
                            >{{ pinAct.describe(a).emoji }}</span
                          ></span
                        >
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-sm font-semibold dark:text-white truncate">Подписка</span
                            ><span
                              v-if="a.created_at"
                              class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0"
                              >{{ fmtTime(a.created_at) }}</span
                            >
                          </div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                            {{ pinAct.describe(a).text }}
                          </div>
                        </div>
                        <img
                          v-if="media.entityImage(a)"
                          :src="media.entityImage(a) || ''"
                          alt="Миниатюра"
                          loading="lazy"
                          class="w-11 h-11 rounded-xl object-cover shrink-0 border border-stone-200 dark:border-zinc-700"
                        />
                        <span
                          v-if="!a.read_at"
                          class="w-2.5 h-2.5 bg-violet-500 rounded-full shrink-0"
                        ></span>
                        <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                  </div>
                  <div v-if="!uloveOnly && pinAct.districtActivities.value.length" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
                    >
                      Районы
                      <span
                        v-if="pinAct.districtUnread.value"
                        class="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                        >{{ pinAct.districtUnread.value }}</span
                      >
                    </div>
                    <div class="space-y-1">
                      <button
                        v-for="a in pinAct.districtActivities.value"
                        :key="a.id"
                        @click="bell.close(); pinAct.goPin(a)"
                        :class="
                          !a.read_at
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800'
                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                        "
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
                      >
                        <span class="relative shrink-0"
                          ><Avatar
                            :image="avatarSrcFor(a.actor)"
                            shape="circle"
                            class="!w-10 !h-10 [&_img]:object-cover"
                            :pt="{ image: { class: 'object-cover' } }" /><span
                            class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-[10px] bg-emerald-500"
                            >{{ pinAct.describe(a).emoji }}</span
                          ></span
                        >
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-sm font-semibold dark:text-white truncate">Район</span
                            ><span
                              v-if="a.created_at"
                              class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0"
                              >{{ fmtTime(a.created_at) }}</span
                            >
                          </div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                            {{ pinAct.describe(a).text }}
                          </div>
                        </div>
                        <span
                          v-if="!a.read_at"
                          class="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0"
                        ></span>
                        <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                  </div>
                  <div v-if="!uloveOnly && pinAct.genericEventActivities.value.length" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
                    >
                      События
                      <span
                        v-if="pinAct.genericEventUnread.value"
                        class="bg-violet-600 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                        >{{ pinAct.genericEventUnread.value }}</span
                      >
                    </div>
                    <div class="space-y-1">
                      <button
                        v-for="a in pinAct.genericEventActivities.value"
                        :key="a.id"
                        @click="bell.close(); pinAct.goPin(a)"
                        :class="
                          !a.read_at
                            ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-800'
                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                        "
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
                      >
                        <span class="relative shrink-0"
                          ><Avatar
                            :image="avatarSrcFor(a.actor)"
                            shape="circle"
                            class="!w-10 !h-10 [&_img]:object-cover"
                            :pt="{ image: { class: 'object-cover' } }" /><span
                            class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-[10px] bg-violet-600"
                            >{{ pinAct.describe(a).emoji }}</span
                          ></span
                        >
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-sm font-semibold dark:text-white truncate">Событие</span
                            ><span
                              v-if="a.created_at"
                              class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0"
                              >{{ fmtTime(a.created_at) }}</span
                            >
                          </div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                            {{ pinAct.describe(a).text }}
                          </div>
                        </div>
                        <span
                          v-if="!a.read_at"
                          class="w-2.5 h-2.5 bg-violet-500 rounded-full shrink-0"
                        ></span>
                        <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                  </div>
                  <div v-if="(uloveOnly ? appNotifications.length : pinAct.otherNotifications.value.length)" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
                    >
                      {{ uloveOnly ? 'Приложение' : 'Уведомления' }}
                      <span
                        v-if="uloveOnly ? appUnread : pinAct.otherUnread.value"
                        class="bg-violet-600 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                        >{{ uloveOnly ? appUnread : pinAct.otherUnread.value }}</span
                      >
                    </div>
                    <div class="space-y-1">
                      <button
                        v-for="n in (uloveOnly ? appNotifications : pinAct.otherNotifications.value)"
                        :key="n.id"
                        @click="bell.close(); pinAct.goNotification(n)"
                        :class="
                          !n.read_at
                            ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-800'
                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                        "
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
                      >
                        <span class="relative shrink-0"
                          ><Avatar
                            :image="describeInboxRow(n).avatar || undefined"
                            icon="pi pi-bell"
                            shape="circle"
                            class="!w-10 !h-10 [&_img]:object-cover !bg-violet-100 dark:!bg-violet-500/20 !text-violet-600 dark:!text-violet-300"
                            :pt="{ image: { class: 'object-cover' } }"
                          />
                          <span
                            class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-[10px]"
                            :class="n.type === 'sos.chat_closed' ? 'bg-red-600' : 'bg-violet-600'"
                            >{{ describeInboxRow(n).emoji }}</span
                          ></span
                        >
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-sm font-semibold dark:text-white truncate">{{
                              describeInboxRow(n).title
                            }}</span
                            ><span
                              v-if="n.created_at"
                              class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0"
                              >{{ fmtTime(n.created_at) }}</span
                            >
                          </div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                            {{ describeInboxRow(n).body }}
                          </div>
                          <div v-if="n.type === 'district.invited' && !n.read_at" class="flex items-center gap-2 mt-2" @click.stop>
                            <Button label="Принять" icon="pi pi-check" size="small" severity="success" rounded @click.stop="pinAct.acceptDistrictInvite(n)" />
                            <Button label="Отклонить" icon="pi pi-times" size="small" severity="secondary" outlined rounded @click.stop="pinAct.declineDistrictInvite(n)" />
                          </div>
                        </div>
                        <span
                          v-if="!n.read_at"
                          class="w-2.5 h-2.5 rounded-full shrink-0"
                          :class="n.type === 'sos.chat_closed' ? 'bg-red-600' : 'bg-violet-500'"
                        ></span>
                        <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                  </div>
                  <div v-if="!uloveOnly && bell.pending.value.length" class="mb-3">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5 flex items-center gap-1.5"
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
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-amber-50 dark:hover:bg-zinc-800 text-left transition min-h-[56px]"
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
                    <Button
                      @click="bell.goRequests()"
                      label="Открыть заявки →"
                      link
                      size="small"
                      class="w-full !text-xs"
                    />
                  </div>
                  <div v-if="bell.conversations.value.length" class="mb-1">
                    <div
                      class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 px-2 py-1.5"
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
                        class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
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
                              class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0"
                              >{{ fmtTime(c.last_message_at) }}</span
                            >
                          </div>
                          <div class="text-xs text-stone-500 dark:text-zinc-400 truncate flex items-center gap-1">
                            <MessageTicks v-if="bellTicks.isOwnLast(c)" :status="bellTicks.lastMessageStatus(c) ?? 'sent'" />
                            <span class="truncate">{{ c.last_message?.body || "Нет сообщений" }}</span>
                          </div>
                        </div>
                        <span
                          v-if="c.unread_count"
                          class="bg-violet-600 text-white text-xs font-bold min-w-[22px] h-[22px] grid place-items-center px-1.5 rounded-full shrink-0"
                          >{{ c.unread_count > 9 ? "9+" : c.unread_count }}</span
                        >
                        <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                      </button>
                    </div>
                  </div>
                </template>
              </template>
            </div>
          </TabPanel>
          <TabPanel v-if="!uloveOnly" value="pins">
            <div class="notif-scroll">
              <div class="px-2 py-1.5 flex items-center gap-1.5">
                <span class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">Активность пинов</span>
                <span
                  v-if="pinAct.pinUnread.value"
                  class="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                  >{{ pinAct.pinUnread.value }}</span
                >
                <Button
                  v-if="pinAct.pinUnread.value"
                  @click="pinAct.markAllRead()"
                  label="Прочитать все"
                  link
                  size="small"
                  class="ml-auto !text-[11px]"
                />
              </div>
              <div v-if="!pinAct.pinActivities.value.length" class="py-10 text-center px-4">
                <div class="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-zinc-800 grid place-items-center mx-auto text-xl">📍</div>
                <div class="text-sm font-semibold dark:text-white mt-3">Реакций на пины нет</div>
                <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Лайки фото, ULove и UFlow — во вкладке «События»</div>
              </div>
              <div v-else class="space-y-1">
                <div
                  v-for="a in pinAct.pinActivities.value"
                  :key="a.id"
                  @click="bell.close(); pinAct.goPin(a)"
                  :class="
                    !a.read_at
                      ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800'
                      : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'
                  "
                  class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px] cursor-pointer"
                >
                  <span class="relative shrink-0"
                    ><Avatar
                      :image="avatarSrcFor(a.actor)"
                      shape="circle"
                      class="!w-10 !h-10 [&_img]:object-cover"
                      :pt="{ image: { class: 'object-cover' } }" /><span
                      class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-[10px]"
                      :class="a.kind === 'comment' ? 'bg-violet-600' : a.kind === 'mention' ? 'bg-amber-500' : a.kind === 'sub_pin' ? 'bg-emerald-500' : a.kind === 'scheduled_published' ? 'bg-emerald-500' : a.kind === 'invite' ? 'bg-amber-500' : a.kind === 'invite_accepted' ? 'bg-emerald-500' : 'bg-rose-500'"
                      >{{ pinAct.describe(a).emoji }}</span
                    ></span
                  >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-semibold dark:text-white truncate">{{
                        a.pin?.title || (a.kind === 'sub_pin' ? "Новый пин" : a.kind === 'mention' ? "Вас упомянули" : a.kind === 'invite' ? "Приглашение в пин" : a.kind === 'invite_accepted' ? "Приглашение принято" : "Ваш пин")
                      }}</span
                      ><span
                        v-if="a.created_at"
                        class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0"
                        >{{ fmtTime(a.created_at) }}</span
                      >
                    </div>
                    <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">
                      {{ pinAct.describe(a).text }}
                    </div>
                    <div v-if="a.kind === 'invite' && !a.read_at" class="flex items-center gap-2 mt-2">
                      <Button label="Принять" icon="pi pi-check" size="small" severity="success" rounded @click.stop="pinAct.acceptInvite(a)" />
                      <Button label="Отклонить" icon="pi pi-times" size="small" severity="secondary" outlined rounded @click.stop="pinAct.declineInvite(a)" />
                    </div>
                  </div>
                  <span
                    v-if="!a.read_at && a.kind !== 'invite'"
                    class="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0"
                  ></span>
                  <i v-else-if="a.kind !== 'invite'" class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                </div>
              </div>
            </div>
          </TabPanel>
          <TabPanel v-if="!bell.isAdmin.value" value="news">
            <div class="notif-scroll">
              <div v-if="updates.loading.value" class="py-10 grid place-items-center">
                <ProgressSpinner style="width:26px;height:26px" :strokeWidth="6" />
              </div>
              <div v-else-if="!updates.history.value.length" class="py-10 text-center px-4">
                <div class="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-zinc-800 grid place-items-center mx-auto text-xl">✨</div>
                <div class="text-sm font-semibold dark:text-white mt-3">Новостей пока нет</div>
                <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Здесь появятся заметки о новых функциях</div>
              </div>
              <div v-else>
                <div class="px-2 py-1.5 flex items-center gap-1.5">
                  <span class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">Что нового</span>
                  <Tag v-if="updates.unreadCount.value" :value="`новых: ${updates.unreadCount.value}`" severity="info" class="!text-[10px]" />
                  <Button v-if="updates.unreadCount.value" @click="updates.dismissAll()" label="Прочитать все" link size="small" class="ml-auto !text-[11px]" />
                </div>
                <div class="space-y-1">
                  <button
                    v-for="n in updates.sortedHistory.value"
                    :key="n.id"
                    @click="openNews(n)"
                    :class="!n.is_read ? 'bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-800' : 'hover:bg-stone-50 dark:hover:bg-zinc-800 border border-transparent'"
                    class="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition min-h-[56px]"
                  >
                    <span class="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white grid place-items-center shrink-0"><i class="pi pi-sparkles text-sm"></i></span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span class="text-sm font-semibold dark:text-white truncate">{{ n.title }}</span>
                        <span v-if="n.published_at" class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0">{{ fmtDay(n.published_at) }}</span>
                      </div>
                      <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">{{ (n.body || '').slice(0, 80) }}</div>
                      <div v-if="newsGuide.isModulesGuide(n)" class="text-xs font-bold text-violet-600 dark:text-violet-300 truncate mt-0.5">📲 Настройки → Приложение → Разделы</div>
                    </div>
                    <span v-if="!n.is_read" class="w-2.5 h-2.5 bg-sky-500 rounded-full shrink-0"></span>
                    <i v-else class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0"></i>
                  </button>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </Dialog>
</template>
<style scoped>
.notif-scroll {
  max-height: min(62dvh, 520px);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding-bottom: var(--sab);
}
.notif-tabs :deep([data-pc-name="tablist"]) {
  overflow-x: auto;
  scrollbar-width: none;
}
.notif-tabs :deep([data-pc-name="tablist"])::-webkit-scrollbar {
  display: none;
}
@media (max-width: 640px) {
  .notif-modal {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    max-height: 92dvh !important;
  }
  .notif-scroll {
    max-height: 72dvh;
  }
}
.pb-safe {
  padding-bottom: var(--sab);
}
</style>
