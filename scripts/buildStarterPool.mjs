import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE_DIR = join(process.cwd(), 'content', 'packs')
const OUTPUT = join(process.cwd(), 'public', 'pools', 'starter.sietch.json')

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`
}

async function checksum(file) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(file)))
  return `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

const order = JSON.parse(readFileSync(join(process.cwd(), 'content', 'manifest.json'), 'utf8')).packs.map(pack => pack.id)
const files = readdirSync(SOURCE_DIR).filter(name => name.endsWith('.json'))
const packs = files
  .map(name => ({ id: name.replace(/\.json$/, ''), ...JSON.parse(readFileSync(join(SOURCE_DIR, name), 'utf8')) }))
  .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))

const unsigned = {
  schema: 1,
  id: 'sietch-starter',
  title: 'Sietch starter',
  version: 1,
  cadence: 'daily',
  author: 'Sietch',
  license: 'CC-BY-4.0',
  updatedAt: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z',
  packs,
}

const pool = { ...unsigned, checksum: await checksum(unsigned) }
mkdirSync(join(process.cwd(), 'public', 'pools'), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(pool, null, 2) + '\n')

const words = packs.reduce((total, pack) =>
  total + pack.sentences.reduce((n, sentence) => n + sentence.en.split(/\s+/).filter(Boolean).length, 0), 0)
console.log(`starter.sietch.json — ${packs.length} packs, ${words} words, ${pool.checksum.slice(0, 20)}…`)
