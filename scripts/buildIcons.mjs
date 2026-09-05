import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ACCENT = [0xfb, 0xd4, 0x5b]
const INK = [0x00, 0x00, 0x00]

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let cursor = 0
  for (let y = 0; y < size; y++) {
    raw[cursor++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y)
      raw[cursor++] = r
      raw[cursor++] = g
      raw[cursor++] = b
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// an hourglass: two triangles meeting at the centre, matching the app's task overlay
function hourglass(size) {
  const border = Math.round(size * 0.09)
  const capHeight = Math.round(size * 0.06)
  const inset = Math.round(size * 0.22)
  const centre = size / 2

  return (x, y) => {
    if (x < border || y < border || x >= size - border || y >= size - border) return INK

    const top = border + capHeight * 2
    const bottom = size - border - capHeight * 2
    const withinGlass = x >= inset && x < size - inset
    if (withinGlass && y >= border + capHeight && y < top) return INK
    if (withinGlass && y >= bottom && y < size - border - capHeight) return INK

    if (y >= top && y < bottom) {
      const half = y < centre
        ? (centre - y) / (centre - top) * (centre - inset)
        : (y - centre) / (bottom - centre) * (centre - inset)
      if (Math.abs(x - centre) <= half) return INK
    }
    return ACCENT
  }
}

mkdirSync(join(process.cwd(), 'public', 'icons'), { recursive: true })
for (const size of [192, 512]) {
  const target = join(process.cwd(), 'public', 'icons', `icon-${size}.png`)
  writeFileSync(target, encodePng(size, hourglass(size)))
  console.log(`icon-${size}.png`)
}
