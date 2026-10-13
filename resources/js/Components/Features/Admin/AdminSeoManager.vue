<script setup lang="ts">
import { useAdminTabs, type AdminSeoSection } from '@/composables/useAdminTabs'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import ColorPicker from 'primevue/colorpicker'

defineProps<{ mgr: any }>()

const origin = typeof window !== 'undefined' ? window.location.origin : ''

const { seoSection, setSeoSection } = useAdminTabs()

const sectionOptions: Array<{ label: string; value: AdminSeoSection; icon: string }> = [
  { label: 'Общее', value: 'general', icon: 'pi pi-globe' },
  { label: 'Страницы', value: 'pages', icon: 'pi pi-file' },
  { label: 'Счётчики', value: 'integrations', icon: 'pi pi-chart-line' },
  { label: 'Скрипты', value: 'scripts', icon: 'pi pi-code' },
  { label: 'Robots и Sitemap', value: 'crawl', icon: 'pi pi-sitemap' },
]

const inputClass = 'w-full mt-1 !bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-600 dark:!text-white dark:placeholder:!text-zinc-500'
const labelClass = 'text-xs font-bold text-stone-500 dark:text-zinc-400'

function counterClass(ok: boolean) {
  return ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
}
</script>

<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2">
        <span class="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white grid place-items-center shrink-0"><i class="pi pi-globe text-sm" /></span>
        <div class="flex-1 min-w-0">
          <div class="font-black dark:text-white">SEO-центр</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">Мета, страницы, счётчики Google/Яндекс и скрипты — без правки кода.</div>
        </div>
        <Tag v-if="mgr.savedAt.value" :value="`сохранено ${mgr.savedAt.value}`" severity="success" class="!text-[9px]" />
      </div>

      <Message v-if="mgr.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ mgr.error.value }}</Message>

      <div class="mt-3 flex gap-1.5 flex-wrap">
        <Button
          v-for="option in sectionOptions"
          :key="option.value"
          size="small"
          rounded
          :outlined="seoSection !== option.value"
          :severity="seoSection === option.value ? undefined : 'secondary'"
          :icon="option.icon"
          :label="option.label"
          @click="setSeoSection(option.value)"
        />
      </div>

      <div v-if="mgr.loading.value" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>

      <!-- ===== Общее ===== -->
      <div v-else-if="seoSection === 'general'" class="mt-4 space-y-3">
        <div class="rounded-2xl border border-stone-200 dark:border-zinc-700 p-3.5 bg-stone-50 dark:bg-zinc-800/60">
          <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Предпросмотр в Google</div>
          <div class="mt-2 text-[#1a0dab] dark:text-[#8ab4f8] text-lg leading-snug break-words">{{ mgr.global.value.default_title || 'Заголовок страницы' }}</div>
          <div class="text-[#006621] dark:text-[#bdc1c6] text-xs truncate">{{ origin }} › …</div>
          <div class="text-sm text-stone-600 dark:text-zinc-300 break-words">{{ mgr.global.value.default_description || 'Описание страницы для поисковой выдачи…' }}</div>
        </div>

        <div>
          <label :class="labelClass">Название сайта</label>
          <InputText v-model="mgr.global.value.site_name" placeholder="UPin" maxlength="120" :class="inputClass" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label :class="labelClass">Суффикс заголовков</label>
            <InputText v-model="mgr.global.value.title_suffix" placeholder=" — UPin" maxlength="60" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Автор</label>
            <InputText v-model="mgr.global.value.author" placeholder="UPin" maxlength="120" :class="inputClass" />
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between">
            <label :class="labelClass">Заголовок по умолчанию (title)</label>
            <span class="text-[11px] font-bold" :class="counterClass(mgr.titleOk.value)">{{ mgr.titleLength.value }} / 60</span>
          </div>
          <InputText v-model="mgr.global.value.default_title" placeholder="UPin — …" maxlength="200" :class="inputClass" />
          <div v-if="!mgr.titleOk.value" class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Идеал — 30–60 символов, минимум 10 и максимум 70.</div>
        </div>
        <div>
          <div class="flex items-center justify-between">
            <label :class="labelClass">Описание по умолчанию (description)</label>
            <span class="text-[11px] font-bold" :class="counterClass(mgr.descriptionOk.value)">{{ mgr.descriptionLength.value }} / 160</span>
          </div>
          <Textarea v-model="mgr.global.value.default_description" rows="3" autoResize placeholder="Коротко о проекте…" maxlength="500" :class="inputClass" />
          <div v-if="!mgr.descriptionOk.value" class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Идеал — 120–160 символов.</div>
        </div>
        <div>
          <label :class="labelClass">Ключевые слова (через запятую)</label>
          <Textarea v-model="mgr.keywordsText.value" rows="2" autoResize placeholder="карта района, соседи, …" :class="inputClass" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label :class="labelClass">Локаль OG</label>
            <InputText v-model="mgr.global.value.locale" placeholder="ru_RU" maxlength="20" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Тип OG</label>
            <InputText v-model="mgr.global.value.og_type" placeholder="website" maxlength="40" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Twitter-карточка</label>
            <Select v-model="mgr.global.value.twitter_card" :options="['summary', 'summary_large_image']" class="w-full mt-1" />
          </div>
          <div>
            <label :class="labelClass">Twitter-аккаунт</label>
            <InputText v-model="mgr.global.value.twitter_site" placeholder="@upin" maxlength="60" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Цвет темы</label>
            <div class="mt-1 flex items-center gap-2">
              <ColorPicker v-model="mgr.global.value.theme_color" />
              <InputText v-model="mgr.global.value.theme_color" placeholder="#0F172A" maxlength="20" class="flex-1" />
            </div>
          </div>
          <div>
            <label :class="labelClass">OG-картинка</label>
            <InputText v-model="mgr.global.value.og_image" placeholder="/og-cover.jpg" maxlength="500" :class="inputClass" />
          </div>
        </div>
        <div>
          <label :class="labelClass">Robots по умолчанию</label>
          <Select v-model="mgr.global.value.robots_default" :options="mgr.robotsPresets" editable class="w-full mt-1" placeholder="index, follow" />
        </div>
        <Button label="Сохранить общее" icon="pi pi-save" rounded :loading="mgr.saving.value === 'global'" @click="mgr.saveGlobal()" class="!bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-0 !font-bold" />
      </div>

      <!-- ===== Страницы ===== -->
      <div v-else-if="seoSection === 'pages'" class="mt-4 space-y-3">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="text-sm font-bold dark:text-white">Переопределения для {{ mgr.pages.value.length }} стр.</div>
          <Button label="Добавить страницу" icon="pi pi-plus" size="small" rounded @click="mgr.openCreatePage()" />
        </div>
        <div v-if="!mgr.pages.value.length" class="rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700 p-6 text-center text-sm text-stone-500 dark:text-zinc-400">
          Пока всё берётся из «Общего». Добавь страницу, чтобы задать ей свои title/description/robots.
        </div>
        <div v-for="row in mgr.pages.value" :key="row.path" class="rounded-2xl border border-stone-200 dark:border-zinc-700 px-3.5 py-3 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm dark:text-white truncate">{{ row.path }}</div>
            <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">{{ row.title || '—' }}</div>
          </div>
          <Tag :value="row.enabled ? 'вкл' : 'выкл'" :severity="row.enabled ? 'success' : 'secondary'" class="!text-[9px]" />
          <ToggleSwitch :modelValue="row.enabled" @update:modelValue="(v:boolean)=>mgr.togglePage(row.path, v)" />
          <Button icon="pi pi-pencil" rounded text size="small" aria-label="Редактировать" @click="mgr.openEditPage(row)" />
          <Button icon="pi pi-trash" rounded text severity="danger" size="small" aria-label="Удалить" :loading="mgr.saving.value === 'pages'" @click="mgr.removePage(row.path)" />
        </div>
        <div v-if="mgr.knownPaths.value.length" class="text-[11px] text-stone-400 dark:text-zinc-500">Известные пути: {{ mgr.knownPaths.value.join(', ') }}</div>
      </div>

      <!-- ===== Счётчики ===== -->
      <div v-else-if="seoSection === 'integrations'" class="mt-4 space-y-3">
        <Message severity="info" :closable="false" class="!rounded-2xl !text-xs">Достаточно вставить ID — теги Google/Yandex подключатся сами. Верификации попадут в meta-теги автоматически.</Message>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label :class="labelClass">Google Search Console (meta)</label>
            <InputText v-model="mgr.integrations.value.google_site_verification" placeholder="код верификации" maxlength="200" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Яндекс.Вебмастер (meta)</label>
            <InputText v-model="mgr.integrations.value.yandex_verification" placeholder="код верификации" maxlength="200" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Bing Webmaster (meta)</label>
            <InputText v-model="mgr.integrations.value.bing_verification" placeholder="код верификации" maxlength="200" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Google Analytics 4 (G-…)</label>
            <InputText v-model="mgr.integrations.value.google_analytics_id" placeholder="G-XXXXXXX" maxlength="40" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Google Tag Manager (GTM-…)</label>
            <InputText v-model="mgr.integrations.value.google_tag_manager_id" placeholder="GTM-XXXX" maxlength="40" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Яндекс.Метрика (ID счётчика)</label>
            <InputText v-model="mgr.integrations.value.yandex_metrica_id" placeholder="12345678" maxlength="20" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Facebook Pixel</label>
            <InputText v-model="mgr.integrations.value.facebook_pixel_id" placeholder="1234567890" maxlength="40" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">VK Pixel</label>
            <InputText v-model="mgr.integrations.value.vk_pixel_id" placeholder="VK-…" maxlength="40" :class="inputClass" />
          </div>
        </div>
        <Button label="Сохранить счётчики" icon="pi pi-save" rounded :loading="mgr.saving.value === 'integrations'" @click="mgr.saveIntegrations()" class="!bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-0 !font-bold" />
      </div>

      <!-- ===== Скрипты ===== -->
      <div v-else-if="seoSection === 'scripts'" class="mt-4 space-y-3">
        <label class="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-3.5 py-3 cursor-pointer">
          <span class="text-sm font-bold dark:text-white">Включить кастомные скрипты</span>
          <ToggleSwitch :modelValue="mgr.integrations.value.scripts_enabled" @update:modelValue="(v:boolean)=>mgr.integrations.value.scripts_enabled=v" />
        </label>
        <Message severity="warn" :closable="false" class="!rounded-2xl !text-xs">Вставляй любой код (чаты, пиксели, A/B-тесты). При включённых скриптах CSP автоматически ослабляется до unsafe-inline — как в WordPress, вся ответственность на администраторе.</Message>
        <div>
          <label :class="labelClass">&lt;head&gt; — перед &lt;/head&gt;</label>
          <Textarea v-model="mgr.integrations.value.head_scripts" rows="5" autoResize placeholder="&lt;script&gt;…&lt;/script&gt;" maxlength="20000" :class="`${inputClass} !font-mono !text-xs`" />
        </div>
        <div>
          <label :class="labelClass">&lt;body&gt; — сразу после открытия</label>
          <Textarea v-model="mgr.integrations.value.body_start_scripts" rows="4" autoResize placeholder="GTM noscript…" maxlength="20000" :class="`${inputClass} !font-mono !text-xs`" />
        </div>
        <div>
          <label :class="labelClass">&lt;/body&gt; — перед закрытием</label>
          <Textarea v-model="mgr.integrations.value.body_end_scripts" rows="4" autoResize placeholder="…виджеты…" maxlength="20000" :class="`${inputClass} !font-mono !text-xs`" />
        </div>
        <Button label="Сохранить скрипты" icon="pi pi-save" rounded :loading="mgr.saving.value === 'integrations'" @click="mgr.saveIntegrations()" class="!bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-0 !font-bold" />
      </div>

      <!-- ===== Robots и Sitemap ===== -->
      <div v-else-if="seoSection === 'crawl'" class="mt-4 space-y-3">
        <div class="flex gap-2 flex-wrap">
          <a href="/robots.txt" target="_blank" rel="noopener"><Button label="robots.txt" icon="pi pi-external-link" size="small" rounded outlined /></a>
          <a href="/sitemap.xml" target="_blank" rel="noopener"><Button label="sitemap.xml" icon="pi pi-external-link" size="small" rounded outlined /></a>
        </div>
        <div>
          <label :class="labelClass">Режим robots.txt</label>
          <Select v-model="mgr.robots.value.mode" :options="[{label:'Авто (рекомендуется)',value:'auto'},{label:'Свой текст',value:'custom'}]" optionLabel="label" optionValue="value" class="w-full mt-1" />
        </div>
        <div v-if="mgr.robots.value.mode === 'custom'">
          <label :class="labelClass">Свой robots.txt</label>
          <Textarea v-model="mgr.robots.value.custom_text" rows="6" autoResize :class="`${inputClass} !font-mono !text-xs`" placeholder="User-agent: *…" maxlength="5000" />
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label :class="labelClass">Доп. Disallow (по строке)</label>
            <Textarea v-model="mgr.extraDisallowText.value" rows="4" autoResize :class="`${inputClass} !font-mono !text-xs`" placeholder="/internal&#10;/tmp" />
          </div>
          <div>
            <label :class="labelClass">Доп. Allow (по строке)</label>
            <Textarea v-model="mgr.extraAllowText.value" rows="4" autoResize :class="`${inputClass} !font-mono !text-xs`" placeholder="/public" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label :class="labelClass">Crawl-delay (сек)</label>
            <InputText v-model.number="mgr.robots.value.crawl_delay" type="number" min="0" max="60" :class="inputClass" />
          </div>
          <label class="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-3.5 py-3 cursor-pointer self-end">
            <span class="text-sm font-bold dark:text-white">Ссылка на sitemap</span>
            <ToggleSwitch :modelValue="mgr.robots.value.sitemap_enabled" @update:modelValue="(v:boolean)=>mgr.robots.value.sitemap_enabled=v" />
          </label>
        </div>
        <Button label="Сохранить robots" icon="pi pi-save" rounded :loading="mgr.saving.value === 'robots'" @click="mgr.saveRobots()" class="!bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-0 !font-bold" />

        <div class="!mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700 space-y-3">
          <label class="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-3.5 py-3 cursor-pointer">
            <span class="text-sm font-bold dark:text-white">Sitemap включён</span>
            <ToggleSwitch :modelValue="mgr.sitemap.value.enabled" @update:modelValue="(v:boolean)=>mgr.sitemap.value=v" />
          </label>
          <div>
            <label :class="labelClass">Исключить пути (по строке)</label>
            <Textarea v-model="mgr.excludedPathsText.value" rows="3" autoResize :class="`${inputClass} !font-mono !text-xs`" placeholder="/login&#10;/register" />
          </div>
          <div>
            <label :class="labelClass">Доп. URL (по строке)</label>
            <Textarea v-model="mgr.extraUrlsText.value" rows="3" autoResize :class="`${inputClass} !font-mono !text-xs`" placeholder="/promo&#10;https://…" />
          </div>
          <Button label="Сохранить sitemap" icon="pi pi-save" rounded :loading="mgr.saving.value === 'sitemap'" @click="mgr.saveSitemap()" class="!bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-0 !font-bold" />
        </div>
      </div>
    </template>
  </Card>

  <Dialog :visible="mgr.showPageDialog.value" @update:visible="(v:boolean)=>{ if(!v) mgr.closePageDialog() }" modal :header="mgr.isNewPage.value ? 'Новая страница' : 'Редактировать страницу'" :style="{ width: '520px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none overflow-hidden' } }">
    <div v-if="mgr.editingPage.value" class="space-y-3">
      <div>
        <label :class="labelClass">Путь</label>
        <InputText v-model="mgr.editingPage.value.path" placeholder="/promo" maxlength="200" :class="`${inputClass} !font-mono`" />
      </div>
      <div>
        <label :class="labelClass">Title</label>
        <InputText v-model="mgr.editingPage.value.title" placeholder="Заголовок страницы" maxlength="200" :class="inputClass" />
      </div>
      <div>
        <label :class="labelClass">Description</label>
        <Textarea v-model="mgr.editingPage.value.description" rows="2" autoResize maxlength="500" :class="inputClass" />
      </div>
      <div>
        <label :class="labelClass">Keywords</label>
        <InputText v-model="mgr.editingPage.value.keywords" maxlength="500" :class="inputClass" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label :class="labelClass">OG title</label>
          <InputText v-model="mgr.editingPage.value.og_title" maxlength="200" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">OG картинка</label>
          <InputText v-model="mgr.editingPage.value.og_image" maxlength="500" :class="inputClass" />
        </div>
      </div>
      <div>
        <label :class="labelClass">OG description</label>
        <Textarea v-model="mgr.editingPage.value.og_description" rows="2" autoResize maxlength="500" :class="inputClass" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label :class="labelClass">Canonical</label>
          <InputText v-model="mgr.editingPage.value.canonical" maxlength="500" :class="`${inputClass} !font-mono !text-xs`" />
        </div>
        <div>
          <label :class="labelClass">Robots</label>
          <Select v-model="mgr.editingPage.value.robots" :options="mgr.robotsPresets" editable class="w-full mt-1" />
        </div>
      </div>
      <label class="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-3.5 py-3 cursor-pointer">
        <span class="text-sm font-bold dark:text-white">Переопределение включено</span>
        <ToggleSwitch :modelValue="mgr.editingPage.value.enabled" @update:modelValue="(v:boolean)=>mgr.editingPage.value.enabled=v" />
      </label>
    </div>
    <template #footer>
      <Button label="Отмена" text @click="mgr.closePageDialog()" />
      <Button label="Сохранить" icon="pi pi-save" :loading="mgr.saving.value === 'pages'" @click="mgr.savePageDialog()" />
    </template>
  </Dialog>
</template>
