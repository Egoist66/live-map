import { createWriteStream, mkdirSync } from 'fs'
import { join } from 'path'
import { deflateSync } from 'zlib'

/**
 * Генерация launcher-иконок UPin (пин + сердечко ULove) для всех плотностей.
 * Чистый Node без зависимостей: суперсэмплинг + ручной PNG-энкодер.
 *
 * @returns {Promise<void>}
 * @example
 * node scripts/gen-android-icons.mjs
 */
async function main() {
    const densities = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    for (const [dir, size] of Object.entries(densities)) {
        const outDir = join('android', 'app', 'src', 'main', 'res', dir)
        mkdirSync(outDir, { recursive: true })
        writePng(join(outDir, 'ic_launcher.png'), render(size, 'square'))
        writePng(join(outDir, 'ic_launcher_round.png'), render(size, 'round'))
        writePng(join(outDir, 'ic_launcher_foreground.png'), render(size, 'foreground'))
    }
    writePng(join('android', 'app', 'src', 'main', 'res', 'drawable', 'splash.png'), flat(128, [15, 23, 42]))
    console.log('[icons] android launcher icons done')
}

/**
 * Растр иконки: градиент UPin, белый пин, фиолетовая точка, розовое сердце ULove.
 *
 * @param {number} size - размер в пикселях.
 * @param {'square' | 'round' | 'foreground'} kind - вариант.
 * @returns {Buffer} RGBA-пиксели.
 */
function render(size, kind) {
    const SS = 3
    const big = size * SS
    const out = Buffer.alloc(size * size * 4)
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let r = 0
            let g = 0
            let b = 0
            let a = 0
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const px = (x + (sx + 0.5) / SS) / size
                    const py = (y + (sy + 0.5) / SS) / size
                    const sample = shade(px, py, kind)
                    r += sample[0]
                    g += sample[1]
                    b += sample[2]
                    a += sample[3]
                }
            }
            const o = (y * size + x) * 4
            const n = SS * SS
            out[o] = Math.round(r / n)
            out[o + 1] = Math.round(g / n)
            out[o + 2] = Math.round(b / n)
            out[o + 3] = Math.round(a / n)
        }
    }
    return out
}

/**
 * Цвет одного субпикселя в координатах 0..1.
 *
 * @param {number} px - x 0..1.
 * @param {number} py - y 0..1.
 * @param {'square' | 'round' | 'foreground'} kind - вариант.
 * @returns {[number, number, number, number]} RGBA.
 */
function shade(px, py, kind) {
    const pin = inPin(px, py)
    const dot = inDot(px, py)
    const heart = inHeart(px, py)
    if (kind === 'foreground') {
        if (heart) {
            return [251, 113, 133, 255]
        }
        if (dot) {
            return [91, 91, 255, 255]
        }
        if (pin) {
            return [255, 255, 255, 255]
        }
        return [0, 0, 0, 0]
    }
    if (kind === 'round') {
        const dx = px - 0.5
        const dy = py - 0.5
        if (dx * dx + dy * dy > 0.25) {
            return [0, 0, 0, 0]
        }
    }
    if (heart) {
        return [251, 113, 133, 255]
    }
    if (dot === 2) {
        return [255, 255, 255, 255]
    }
    if (dot === 1) {
        return [91, 91, 255, 255]
    }
    if (pin) {
        return [255, 255, 255, 255]
    }
    return gradient(px, py)
}

/**
 * Диагональный градиент бренда: #6D6DFF -> #4F46E5.
 *
 * @param {number} px - x 0..1.
 * @param {number} py - y 0..1.
 * @returns {[number, number, number, number]} RGBA.
 */
function gradient(px, py) {
    const t = Math.min(1, Math.max(0, (px + py) / 2))
    const r = Math.round(109 + (79 - 109) * t)
    const g = Math.round(109 + (70 - 109) * t)
    const b = Math.round(255 + (229 - 255) * t)
    return [r, g, b, 255]
}

/**
 * Белый пин: круг + сужающийся корпус к острию.
 *
 * @param {number} px - x 0..1.
 * @param {number} py - y 0..1.
 * @returns {boolean} внутри пина.
 */
function inPin(px, py) {
    const cx = 0.5
    const cy = 0.43
    const r = 0.185
    const dx = px - cx
    const dy = py - cy
    if (dx * dx + dy * dy <= r * r && py <= 0.56) {
        return true
    }
    const apexX = 0.5
    const apexY = 0.78
    const baseY = 0.5
    const halfBase = 0.148
    if (py < baseY || py > apexY) {
        return false
    }
    const t = (py - baseY) / (apexY - baseY)
    const half = halfBase * (1 - t)
    return Math.abs(px - apexX) <= half
}

/**
 * Точка в пине: фиолетовое кольцо (1) + белый центр (2).
 *
 * @param {number} px - x 0..1.
 * @param {number} py - y 0..1.
 * @returns {0 | 1 | 2} зона точки.
 */
function inDot(px, py) {
    const dx = px - 0.5
    const dy = py - 0.43
    const d2 = dx * dx + dy * dy
    if (d2 <= 0.032 * 0.032) {
        return 2
    }
    if (d2 <= 0.078 * 0.078) {
        return 1
    }
    return 0
}

/**
 * Сердечко ULove: два круга + треугольник вниз.
 *
 * @param {number} px - x 0..1.
 * @param {number} py - y 0..1.
 * @returns {boolean} внутри сердца.
 */
function inHeart(px, py) {
    const cy = 0.615
    const r = 0.037
    const lx = 0.613
    const rx = 0.687
    const inLeft = (px - lx) * (px - lx) + (py - cy) * (py - cy) <= r * r
    const inRight = (px - rx) * (px - rx) + (py - cy) * (py - cy) <= r * r
    if (inLeft || inRight) {
        return true
    }
    const topY = 0.625
    const apexY = 0.725
    if (py < topY || py > apexY) {
        return false
    }
    const t = (py - topY) / (apexY - topY)
    const half = (rx - lx) / 2 + r * (1 - t)
    const mid = (lx + rx) / 2
    return Math.abs(px - mid) <= half
}

/**
 * Заливка одним цветом (сплэш-фон).
 *
 * @param {number} size - размер в пикселях.
 * @param {[number, number, number]} rgb - цвет.
 * @returns {Buffer} RGBA-пиксели.
 */
function flat(size, rgb) {
    const out = Buffer.alloc(size * size * 4)
    for (let i = 0; i < size * size; i++) {
        out[i * 4] = rgb[0]
        out[i * 4 + 1] = rgb[1]
        out[i * 4 + 2] = rgb[2]
        out[i * 4 + 3] = 255
    }
    return out
}

/**
 * CRC32 для PNG-чанков.
 *
 * @param {Buffer} buf - данные.
 * @returns {number} контрольная сумма.
 */
function crc32(buf) {
    const table = crc32.table || (crc32.table = buildCrcTable())
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) {
        c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    }
    return (c ^ 0xffffffff) >>> 0
}

/**
 * Таблица CRC32.
 *
 * @returns {Uint32Array} таблица.
 */
function buildCrcTable() {
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        }
        table[n] = c >>> 0
    }
    return table
}

/**
 * PNG-чанк.
 *
 * @param {string} type - тип чанка.
 * @param {Buffer} data - данные.
 * @returns {Buffer} чанк.
 */
function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([td, data])))
    return Buffer.concat([len, td, data, crc])
}

/**
 * Запись RGBA-буфера в PNG-файл.
 *
 * @param {string} path - путь файла.
 * @param {Buffer} rgba - пиксели size*size*4.
 * @returns {void}
 */
function writePng(path, rgba) {
    const size = Math.sqrt(rgba.length / 4)
    const raw = Buffer.alloc(size * (size * 4 + 1))
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
    const file = Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', ihdr),
        chunk('IDAT', comp),
        chunk('IEND', Buffer.alloc(0)),
    ])
    const stream = createWriteStream(path)
    stream.write(file)
    stream.end()
    console.log('[icons] wrote', path)
}

await main()
