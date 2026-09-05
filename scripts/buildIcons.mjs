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

// a dune horizon: a near crest overlapping a far one, separated by a thin accent
// stroke because two flat colours alone would merge the two silhouettes
function duneHorizon(size) {
  // below favicon size the frame and the hairline stroke turn to mush, so the
  // small mark is one bold crest with no frame at all
  const detailed = size >= 64
  const border = detailed ? Math.round(size * 0.09) : 0
  const stroke = detailed ? Math.max(2, Math.round(size * 0.022)) : 0

  const hump = (t, centre, width, height) => height * Math.exp(-(((t - centre) / width) ** 2))
  const farCrest = x => (0.68 - hump(x / size, 0.32, 0.30, 0.14)) * size
  const nearCrest = x => (0.82 - hump(x / size, 0.70, 0.26, 0.13)) * size

  return (x, y) => {
    if (border && (x < border || y < border || x >= size - border || y >= size - border)) return INK

    const far = farCrest(x)
    if (!detailed) return y >= far ? INK : ACCENT

    const near = nearCrest(x)
    if (y >= near) return y < near + stroke && y >= far ? ACCENT : INK
    return y >= far ? INK : ACCENT
  }
}

mkdirSync(join(process.cwd(), 'public', 'icons'), { recursive: true })
for (const size of [32, 180, 192, 512]) {
  const target = join(process.cwd(), 'public', 'icons', `icon-${size}.png`)
  writeFileSync(target, encodePng(size, duneHorizon(size)))
  console.log(`icon-${size}.png`)
}
