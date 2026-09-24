/**
 * CI-гейт изоляции бандла по модулям.
 *
 * Проверяет ПОСЛЕ `vite build`, что entry тянет только ядро:
 * ни один включённый/выключенный раздел (ulove/upin/uflow/districts/business)
 * не должен попадать в статическое замыкание `resources/js/app.ts`.
 *
 * Фишка приложения — грузится только включённое. Один статический импорт
 * в общем компоненте — и чужой модуль едет всем на первом визите, а гнила
 * изоляция молча. Этот скрипт не даёт такому коду пройти CI.
 *
 * Что проверяется:
 *  1. В замыкании entry нет чанков тяжёлых либ разделов (maplibre, swiper).
 *  2. В замыкании нет чанков с именами кода разделов (сторы, api, хуки,
 *     компоненты) — кроме явного CORE_ALLOWLIST (тонкие CTA/константы,
 *     которые живут в ядре сознательно).
 *  3. В байтах замыкания нет API-маркеров разделов (`/api/pins/mine`,
 *     `/api/flow-posts`, `/api/districts`, `/api/business`, `/api/swipes`,
 *     ...). Имена endpoint'ов переживают минификацию.
 *  4. Sanity против слепоты гейта: замыкание Swipes ОБЯЗАНО содержать
 *     `/api/swipes`, замыкание Map — чанк maplibre. Иначе гейт ничего
 *     не видит и падает с "misconfigured".
 *
 * Запуск: `node scripts/check-bundle-isolation.mjs [--entry <manifest-key>]`
 * Exit code: 0 — чисто, 1 — нарушение (с понятным списком).
 *
 * @example
 * ```sh
 * pnpm exec vite build
 * node scripts/check-bundle-isolation.mjs
 * ```
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'public', 'build', 'manifest.json');
const ENTRY = 'resources/js/app.ts';

/**
 * Тонкие общие модули: живут в ядре сознательно (CTA-переходы, константы,
 * инбокс-уведомления). Их имена содержат подстроки разделов, поэтому
 * перечислены явно — всё остальное с такими именами в entry запрещено.
 */
const CORE_ALLOWLIST = new Set([
  'useDistrictsCta',
  'useSwipesCta',
  'useSwipeTabs',
  'useSwipeToClose',
  'useUloveOnly',
  'useUlovePrivacy',
  'useReportDialog',
  'ReportDialog',
  'HomeZoneField',
  'useCustomCategories',
  'useDistrictInvite',
  'usePinActivity',
  'pinActivity',
  'usePinExpiry',
  'pinCategories',
  'usePhotoZoom',
  'usePhotoViewerSwiper',
  'usePhotoLightbox',
  'PhotoLightbox',
  'flowDate',
]);

/** Подстроки имён чанков, которым не место в замыкании entry. */
const NAME_DENY = [
  /maplibre/i,
  /swiper/i,
  /custom-categories/i,
  /pins/i,
  /flow/i,
  /districts/i,
  /business/i,
  /dating/i,
  /swipes/i,
  /ulove/i,
];

/** API-маркеры разделов: строки endpoint'ов, переживающие минификацию. */
const CONTENT_DENY = [
  '/api/pins/mine',
  '/api/custom-categories',
  '/api/flow-posts',
  '/api/flow-polls',
  '/api/flow-tags',
  '/api/flow-comments',
  '/api/districts',
  '/api/business',
  '/api/swipes',
];

/**
 * Базовое имя чанка из ключа манифеста: `_usePinActivity-Ab12Cd.js` -> `usePinActivity`.
 *
 * @param key ключ манифеста
 * @returns имя без префикса, хэша и расширения
 */
function chunkBaseName(key) {
  const file = key.split('/').pop() ?? key;
  const noUnderscore = file.startsWith('_') ? file.slice(1) : file;
  const noExt = noUnderscore.replace(/\.[^.]+$/, '');
  const noHash = noExt.replace(/-[A-Za-z0-9_-]{6,}$/, '');
  return noHash;
}

/**
 * Разрешён ли чанк в ядре явно (тонкий общий модуль).
 *
 * @param key ключ манифеста
 * @returns true если имя в CORE_ALLOWLIST
 */
function isAllowlisted(key) {
  const base = chunkBaseName(key).toLowerCase();
  for (const allowed of CORE_ALLOWLIST) {
    if (base === allowed.toLowerCase() || base.startsWith(allowed.toLowerCase() + '.')) {
      return true;
    }
  }
  return false;
}

/**
 * Транзитивное статическое замыкание чанка по полю `imports` манифеста.
 *
 * @param manifest манифест сборки
 * @param root стартовый ключ (entry или страница)
 * @returns множество ключей замыкания
 */
function staticClosure(manifest, root) {
  const seen = new Set();
  const stack = [root];
  while (stack.length > 0) {
    const key = stack.pop();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const entry = manifest[key];
    if (!entry) {
      continue;
    }
    for (const dep of entry.imports ?? []) {
      if (!seen.has(dep)) {
        stack.push(dep);
      }
    }
  }
  return seen;
}

/**
 * Склеить байты чанков замыкания для поиска API-маркеров.
 *
 * @param manifest манифест сборки
 * @param closure ключи замыкания
 * @returns {bytes, missing} текст и ненайденные файлы
 */
function readClosureBytes(manifest, closure) {
  const parts = [];
  const missing = [];
  for (const key of closure) {
    const file = manifest[key]?.file;
    if (!file) {
      continue;
    }
    const full = join(ROOT, 'public', 'build', file);
    if (!existsSync(full)) {
      missing.push(file);
      continue;
    }
    parts.push(readFileSync(full, 'utf8'));
  }
  return { bytes: parts.join('\n'), missing };
}

/**
 * Проверить замыкание entry на изоляцию.
 *
 * @param manifest манифест сборки
 * @returns список нарушений (пусто — чисто)
 */
function checkEntry(manifest) {
  const violations = [];
  const closure = staticClosure(manifest, ENTRY);

  for (const key of [...closure].sort()) {
    if (key === ENTRY) {
      continue;
    }
    if (isAllowlisted(key)) {
      continue;
    }
    const base = chunkBaseName(key);
    const hit = NAME_DENY.find((re) => re.test(base));
    if (hit) {
      violations.push(`chunk "${key}" в замыкании entry (совпадение ${hit})`);
    }
  }

  const { bytes, missing } = readClosureBytes(manifest, closure);
  for (const file of missing) {
    violations.push(`файл замыкания не найден на диске: ${file}`);
  }
  for (const marker of CONTENT_DENY) {
    if (bytes.includes(marker)) {
      violations.push(`маркер раздела "${marker}" в байтах замыкания entry`);
    }
  }

  const totalBytes = [...closure].reduce((sum, key) => {
    const file = manifest[key]?.file;
    if (!file) {
      return sum;
    }
    try {
      return sum + readFileSync(join(ROOT, 'public', 'build', file), 'utf8').length;
    } catch {
      return sum;
    }
  }, 0);
  return { violations, chunks: closure.size, bytes: totalBytes };
}

/**
 * Sanity: гейт обязан ВИДЕТЬ код разделов там, где он должен быть.
 * Иначе правила ослепли (переименование endpoint'а) и гейт вакуен.
 *
 * @param manifest манифест сборки
 * @returns список проблем слепоты
 */
function checkSanity(manifest) {
  const problems = [];

  const swipesKey = 'resources/js/Pages/Swipes.vue';
  if (manifest[swipesKey]) {
    const { bytes } = readClosureBytes(manifest, staticClosure(manifest, swipesKey));
    if (!bytes.includes('/api/swipes')) {
      problems.push('слепота гейта: в замыкании Swipes нет /api/swipes');
    }
  }

  const mapKey = 'resources/js/Pages/Map/Index.vue';
  if (manifest[mapKey]) {
    const closure = staticClosure(manifest, mapKey);
    const hasMaplibre = [...closure].some((key) => /maplibre/i.test(manifest[key]?.file ?? ''));
    if (!hasMaplibre) {
      problems.push('слепота гейта: в замыкании Map нет чанка maplibre');
    }
  }

  return problems;
}

/**
 * Проверить произвольный корень (для ручной диагностики утечки).
 *
 * @param manifest манифест сборки
 * @param root ключ корня
 */
function diagnose(manifest, root) {
  if (!manifest[root]) {
    console.log(`корень ${root} отсутствует в манифесте`);
    process.exit(2);
  }
  const closure = staticClosure(manifest, root);
  console.log(`замыкание ${root}: ${closure.size} чанков`);
  for (const key of [...closure].sort()) {
    if (isAllowlisted(key)) {
      continue;
    }
    const base = chunkBaseName(key);
    const hit = NAME_DENY.find((re) => re.test(base));
    console.log(`${hit ? 'LEAK' : 'ok  '} ${key}`);
  }
}

const args = process.argv.slice(2);
const entryIndex = args.indexOf('--entry');
if (!existsSync(MANIFEST)) {
  console.error(`манифест не найден: ${MANIFEST} (сначала vite build)`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

if (entryIndex >= 0 && args[entryIndex + 1]) {
  diagnose(manifest, args[entryIndex + 1]);
  process.exit(0);
}

const { violations, chunks, bytes } = checkEntry(manifest);
const sanity = checkSanity(manifest);
const all = [...violations, ...sanity];

console.log(`entry closure: ${chunks} чанков, ${(bytes / 1024).toFixed(0)} КБ`);
if (all.length === 0) {
  console.log('OK: в бандле первого визита нет кода разделов');
  process.exit(0);
}

console.error(`FAIL: изоляция бандла нарушена (${all.length}):`);
for (const v of all) {
  console.error(` - ${v}`);
}
process.exit(1);
