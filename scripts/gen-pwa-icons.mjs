/**
 * Генератор PWA-иконок UPin без внешних зависимостей.
 *
 * Рисует фирменный пин (белый круг + клин, бренд-ядро) на градиенте
 * #6D6DFF → #4A3AFF — та же геометрия, что в `public/pwa-icon.svg`.
 * Пишет PNG (192/512/maskable/apple-touch) и настоящий `favicon.ico`
 * (PNG внутри ICO-контейнера) вместо прежнего пустого файла.
 *
 * Запуск: `node scripts/gen-pwa-icons.mjs`
 */
import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

const BRAND = [91, 91, 255]
const BG_TOP = [109, 109, 255]
const BG_BOTTOM = [74, 58, 255]
const WHITE = [255, 255, 255]

function crc32(buf) {
  const t = crc32.table || (crc32.table = (() => {
    const tt = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      tt[n] = c >>> 0
    }
    return tt
  })())
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([td, data])))
  return Buffer.concat([len, td, data, crc])
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * size * 4 + size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const comp = deflateSync(raw, { level: 9 })
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', comp),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

function inPinTriangle(px, py) {
  if (py < 292 || py > 404) return false
  const half = (86 * (404 - py)) / (404 - 292)
  return Math.abs(px - 256) <= half
}

/**
 * Растр иконки: фон-градиент, скругление, пин заданного масштаба.
 */
function paint(size, { rounded, pinScale, pinShiftY }) {
  const px = Buffer.alloc(size * size * 4)
  const radius = (112 / 512) * size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4
      if (rounded) {
        const cx = Math.min(Math.max(x + 0.5, radius), size - radius)
        const cy = Math.min(Math.max(y + 0.5, radius), size - radius)
        if (dist2(x + 0.5, y + 0.5, cx, cy) > radius * radius) {
          px[o + 3] = 0
          continue
        }
      }
      const t = y / Math.max(size - 1, 1)
      const bg = [0, 1, 2].map((i) => Math.round(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t))
      const dx = ((x + 0.5) / size) * 512
      const dy = ((y + 0.5) / size) * 512
      const qx = (dx - 256) / pinScale + 256
      const qy = (dy - 256 - pinShiftY) / pinScale + 256
      const inWhite = dist2(qx, qy, 256, 218) <= 116 * 116 || inPinTriangle(qx, qy)
      const inBrand = dist2(qx, qy, 256, 218) <= 52 * 52
      const inCore = dist2(qx, qy, 256, 218) <= 22 * 22
      let rgb = bg
      if (inWhite) rgb = WHITE
      if (inBrand) rgb = BRAND
      if (inCore) rgb = WHITE
      px[o] = rgb[0]
      px[o + 1] = rgb[1]
      px[o + 2] = rgb[2]
      px[o + 3] = 255
    }
  }
  return encodePng(size, px)
}

function writePng(size, opts, out) {
  const file = paint(size, opts)
  writeFileSync(out, file)
  console.log('wrote', out, file.length)
}

/**
 * Настоящий .ico: PNG-кадр внутри ICO-контейнера (понимают все браузеры).
 */
function writeIco(png, out) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 64
  entry[1] = 64
  entry[2] = 0
  entry[3] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  const file = Buffer.concat([header, entry, png])
  writeFileSync(out, file)
  console.log('wrote', out, file.length)
}

const full = { rounded: true, pinScale: 0.92, pinShiftY: 0 }
const maskable = { rounded: false, pinScale: 0.68, pinShiftY: 0 }
const touch = { rounded: false, pinScale: 0.86, pinShiftY: 0 }

writePng(192, full, 'public/pwa-192x192.png')
writePng(512, full, 'public/pwa-512x512.png')
writePng(512, maskable, 'public/maskable-512x512.png')
writePng(180, touch, 'public/apple-touch-icon.png')

const faviconPng = paint(64, { rounded: true, pinScale: 0.9, pinShiftY: 0 })
writeIco(faviconPng, 'public/favicon.ico')
