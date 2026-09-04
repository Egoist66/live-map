import { writeFileSync } from 'fs'

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
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([td, data])))
  return Buffer.concat([len, td, data, crc])
}
async function png(size, bg, dot, out) {
  const raw = Buffer.alloc(size * size * 4 + size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2, dy = y - size / 2 - size * 0.06
      const r = Math.sqrt(dx * dx + dy * dy)
      const isDot = r < size * 0.22
      const o = y * (size * 4 + 1) + 1 + x * 4
      if (isDot) { raw[o] = dot[0]; raw[o+1] = dot[1]; raw[o+2] = dot[2]; raw[o+3] = 255 }
      else { raw[o] = bg[0]; raw[o+1] = bg[1]; raw[o+2] = bg[2]; raw[o+3] = 255 }
    }
  }
  const { deflateSync } = await import('zlib')
  const comp = deflateSync(raw, { level: 9 })
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const file = Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(out, file)
  console.log('wrote', out, file.length)
}
const BG = [91, 91, 255], DOT = [255, 255, 255]
await png(192, BG, DOT, 'public/pwa-192x192.png')
await png(512, BG, DOT, 'public/pwa-512x512.png')
await png(512, [15, 23, 42], DOT, 'public/maskable-512x512.png')
await png(180, BG, DOT, 'public/apple-touch-icon.png')
