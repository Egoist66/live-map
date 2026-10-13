<script setup lang="ts">
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import type { AdminTabId } from '@/composables/useAdminTabs'
import type { AdminNavGroup } from '@/composables/useAdminLayout'

/**
 * Пропсы тёмного бокового меню админки (как `#adminmenu` в WordPress).
 */
interface AdminSidebarProps {
  /** Группы меню из `useAdminLayout().navGroups`. */
  groups: AdminNavGroup[]
  /** Активный таб для WP-подсветки. */
  activeId: AdminTabId
  /** Свёрнутый режим: только иконки (десктоп). */
  collapsed?: boolean
  /** Показывать кнопку «Свернуть меню» внизу (только десктоп). */
  showCollapse?: boolean
}

withDefaults(defineProps<AdminSidebarProps>(), {
  collapsed: false,
  showCollapse: false,
})

const emit = defineEmits<{
  /** Клик по пункту меню. */
  (event: 'select', id: AdminTabId): void
  /** Клик «Свернуть меню» (десктоп). */
  (event: 'toggle'): void
}>()
</script>

<template>
  <aside
    class="wp-adminmenu flex min-h-0 flex-1 flex-col bg-[#1d2327] text-[#eee]"
    :class="collapsed ? 'w-[76px]' : 'w-full'"
    aria-label="Меню админки"
  >
    <nav class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2" aria-label="Разделы админки">
      <template v-for="group in groups" :key="group.title">
        <p
          v-if="!collapsed"
          class="wp-menu-separator mb-1 mt-3 px-4 text-[11px] font-bold uppercase tracking-widest text-[#a7aaad] first:mt-1"
        >
          {{ group.title }}
        </p>
        <div v-else class="mx-3 my-2 border-t border-white/10" role="separator" aria-hidden="true" />
        <ul class="space-y-0.5" :class="collapsed ? 'px-2' : 'px-2'">
          <li v-for="item in group.items" :key="item.id">
            <button
              type="button"
              :title="collapsed ? item.label : undefined"
              :aria-current="item.id === activeId ? 'page' : undefined"
              class="wp-menu-item group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#72aee6] active:scale-[0.99]"
              :class="[
                item.id === activeId
                  ? 'bg-[#2c3338] font-bold text-white'
                  : 'font-medium text-[#eee] hover:bg-[#2c3338] hover:text-white',
                collapsed ? 'justify-center px-0' : '',
              ]"
              @click="emit('select', item.id)"
            >
              <span
                class="absolute inset-y-1 left-0 w-1 rounded-full bg-[#72aee6] transition-opacity"
                :class="item.id === activeId ? 'opacity-100' : 'opacity-0'"
                aria-hidden="true"
              />
              <i class="pi text-base leading-none shrink-0" :class="item.icon" aria-hidden="true" />
              <span v-if="!collapsed" class="min-w-0 flex-1">
                <span class="block truncate leading-tight">{{ item.label }}</span>
                <span class="mt-0.5 block truncate text-[11px] font-normal leading-tight text-[#a7aaad]">
                  {{ item.hint }}
                </span>
              </span>
              <Badge
                v-if="item.badge"
                :value="item.badge"
                :severity="item.badgeSeverity ?? 'danger'"
                class="!mr-0 !min-w-5 !text-[10px] shrink-0"
              />
            </button>
          </li>
        </ul>
      </template>
    </nav>

    <div v-if="showCollapse" class="shrink-0 border-t border-white/10 p-2">
      <Button
        :icon="collapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'"
        :label="collapsed ? '' : 'Свернуть меню'"
        text
        size="small"
        :aria-label="collapsed ? 'Развернуть меню' : 'Свернуть меню'"
        :aria-expanded="!collapsed"
        class="!w-full !justify-start !text-[#a7aaad] hover:!bg-[#2c3338] hover:!text-white !text-[13px]"
        :class="collapsed ? '!justify-center' : ''"
        @click="emit('toggle')"
      />
    </div>
  </aside>
</template>

<style scoped>
.wp-adminmenu {
  color-scheme: dark;
}

.wp-adminmenu::-webkit-scrollbar,
.wp-adminmenu nav::-webkit-scrollbar {
  width: 8px;
}

.wp-adminmenu nav::-webkit-scrollbar-thumb {
  background: rgb(255 255 255 / 0.16);
  border-radius: 8px;
}
</style>
