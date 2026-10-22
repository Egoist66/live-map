/**
 * Генератор PWA-иконок ULove из фирменного логотипа `public/ulove-mark.svg`.
 *
 * Источник — квадратный знак-абрикос 512×512 с прозрачным фоном. ВСЕ иконки
 * приложения (манифест, favicon, apple-touch, badge пуши) генерируются из него,
 * поэтому при смене логотипа достаточно заменить файл-источник и перезапустить
 * скрипт. Имена выходных файлов не меняются сознательно: на них завязаны
 * manifest/vite.config.js, прекеш SW, blade-сплэш, push-sw и nginx-локация.
 *
 * Логотип кладётся на фирменный розовый `#FD267D`; maskable-версия ужимается
 * до safe-zone 80%, favicon-кадры получают скруглённые прозрачные углы.
 *
 * Выходы:
 *  - public/pwa-192x192.png       — any-иконка манифеста/шорткатов/сплэша
 *  - public/pwa-512x512.png       — any-иконка манифеста
 *  - public/maskable-512x512.png  — maskable: знак в safe-zone 80% на розовом
 *  - public/apple-touch-icon.png  — 180, полный квадрат (iOS сам скругляет)
 *  - public/favicon.ico           — настоящий мульти-.ico, PNG-кадры 48/32/16
 *  - public/pwa-icon.svg          — SVG-обёртка с PNG 192 внутри (favicon
 *                                   `image/svg+xml` + badge пушей)
 *
 * Запуск: `node scripts/gen-pwa-icons.mjs`
 */
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

/** Файл-источник нового логотипа (общеприложный, лежит в public). */
const SOURCE = 'public/ulove-mark.svg'
/** Фирменный розовый — фон иконок и сплэша. */
const BRAND_BG = '#FD267D'
/** Скругление favicon-кадров, доля стороны (как у прежнего пина 112/512). */
const FAVICON_RADIUS_RATIO = 112 / 512
/** Размер PNG, встраиваемого в pwa-icon.svg (favicon/badge — мелкий кейс). */
const SVG_EMBED_SIZE = 192

/**
 * Скруглить углы квадратного PNG прозрачностью (dest-in по маске).
 *
 * @param {number} size       Сторона квадрата, px.
 * @param {number} radiusRatio Радиус скругления как доля стороны (0..0.5).
 * @returns {Promise<Buffer>} PNG-буфер со скруглёнными углами.
 */
async function roundedPng(size, radiusRatio) {
  const radius = Math.round(size * radiusRatio)
  const needsRounding = radius > 0
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff" />` +
    `</svg>`,
  )
  const pipeline = sharp(SOURCE, { density: 900 })
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: BRAND_BG })
  return needsRounding
    ? pipeline.composite([{ input: mask, blend: 'dest-in' }]).png({ compressionLevel: 9 }).toBuffer()
    : pipeline.png({ compressionLevel: 9 }).toBuffer()
}

/**
 * Maskable-иконка: знак в safe-zone 80% на сплошном фирменном фоне.
 *
 * @param {number} size Сторона квадрата, px.
 * @returns {Promise<Buffer>} PNG-буфер без прозрачности.
 */
async function maskablePng(size) {
  const inner = Math.round(size * 0.8)
  const logo = await sharp(SOURCE, { density: 900 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten({ background: BRAND_BG })
    .png()
    .toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * Собрать мульти-.ico из PNG-кадров (PNG-энтрии валидны с Windows Vista).
 * Формат контейнера — как в прежнем генераторе.
 *
 * @param {Array<{size: number, png: Buffer}>} entries Кадры 48/32/16.
 * @returns {Buffer} Готовый .ico-файл.
 */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = 6 + 16 * entries.length
  const dir = []
  for (const entry of entries) {
    const record = Buffer.alloc(16)
    record[0] = entry.size >= 256 ? 0 : entry.size
    record[1] = entry.size >= 256 ? 0 : entry.size
    record[2] = 0
    record[3] = 0
    record.writeUInt16LE(1, 4)
    record.writeUInt16LE(32, 6)
    record.writeUInt32LE(entry.png.length, 8)
    record.writeUInt32LE(offset, 12)
    offset += entry.png.length
    dir.push(record)
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)])
}

/**
 * Сгенерировать все иконки приложения из логотипа-источника.
 * Один вызов — один прогон: полный-квадрат any, maskable, apple-touch,
 * favicon.ico и SVG-обёртка.
 */
async function generateIcons() {
  const sourceMeta = await sharp(SOURCE).metadata()
  if (!sourceMeta.width || !sourceMeta.height) throw new Error(`Не читается ${SOURCE}`)
  const isSquare = sourceMeta.width === sourceMeta.height
  if (!isSquare) console.warn(`Источник ${sourceMeta.width}×${sourceMeta.height} не квадратный — cover-кроп применён автоматически.`)

  writeFileSync('public/pwa-192x192.png', await roundedPng(192, 0))
  console.log('wrote public/pwa-192x192.png')

  writeFileSync('public/pwa-512x512.png', await roundedPng(512, 0))
  console.log('wrote public/pwa-512x512.png')

  writeFileSync('public/maskable-512x512.png', await maskablePng(512))
  console.log('wrote public/maskable-512x512.png')

  writeFileSync('public/apple-touch-icon.png', await roundedPng(180, 0))
  console.log('wrote public/apple-touch-icon.png')

  const frames = await Promise.all(
    [48, 32, 16].map(async (size) => ({ size, png: await roundedPng(size, FAVICON_RADIUS_RATIO) })),
  )
  writeFileSync('public/favicon.ico', buildIco(frames))
  console.log('wrote public/favicon.ico')

  const embedded = await roundedPng(SVG_EMBED_SIZE, 0)
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">' +
    `<image width="192" height="192" href="data:image/png;base64,${embedded.toString('base64')}" />` +
    '</svg>'
  writeFileSync('public/pwa-icon.svg', svg)
  console.log('wrote public/pwa-icon.svg')
}

generateIcons().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
