// Corpus-2 stitching: copy, hash-dedupe, and build ONE labeled master contact sheet.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const SRC = 'C:\\Users\\Berry\\Desktop\\Ontology harness screenshots 2'
const COPY_DIR = fileURLToPath(new URL('../asset/corpus-2/', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../asset/contact-sheets-2/', import.meta.url))
mkdirSync(COPY_DIR, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })

const exts = ['.png', '.jpg', '.jpeg', '.jfif']
import { readdirSync } from 'node:fs'
let files = readdirSync(SRC, { withFileTypes: true })
  .filter(e => e.isFile() && exts.includes(path.extname(e.name).toLowerCase()))
  .map(e => e.name)

// hash dedupe
const byHash = new Map()
const unique = []
for (const f of files) {
  const buf = readFileSync(path.join(SRC, f))
  const h = createHash('sha256').update(buf).digest('hex').slice(0, 16)
  const meta = byHash.get(h)
  if (meta) { console.log('DUP skip', f, '==', meta.file); continue }
  byHash.set(h, { file: f })
  // copy into harness (flatten name collisions from " - Copy")
  let dest = f.replace(/[^\w.\-()+ ]/g, '').trim() || `img-${h}`
  if (existsSync(path.join(COPY_DIR, dest))) dest = `${h}-${dest}`
  writeFileSync(path.join(COPY_DIR, dest), buf)
  unique.push({ src: f, copy: dest, hash: h })
}

// build master sheet: 4 cols, labeled, numbered
const COLS = 4, TILE_W = 560, TILE_H = 380, LBL_H = 26
const rows = Math.ceil(unique.length / COLS)
// gather dims first
const tiles = []
for (let i = 0; i < unique.length; i++) {
  const u = unique[i]
  try {
    const m = await sharp(path.join(COPY_DIR, u.copy)).metadata()
    tiles.push({ ...u, w: m.width, h: m.height, hasAlpha: !!m.hasAlpha })
  } catch (e) { console.log('unreadable', u.src) }
}
const cols = COLS, tot = tiles.length
const canvasW = cols * TILE_W, canvasH = Math.ceil(tot / cols) * (TILE_H + LBL_H)
const composites = []
for (let i = 0; i < tot; i++) {
  const t = tiles[i]
  const x = (i % cols) * TILE_W, y = Math.floor(i / cols) * (TILE_H + LBL_H)
  const num = `C${String(i + 1).padStart(2, '0')}`
  // label bar
  const label = `<svg width="${TILE_W}" height="${LBL_H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#102a16"/><text x="8" y="18" font-family="Segoe UI, Arial" font-size="15" font-weight="700" fill="#4ade80">${num}</text><text x="56" y="18" font-family="Segoe UI, Arial" font-size="13" fill="#e7f7ec">${t.copy.replace(/(.png|.jfif|.jpg)$/i, '')}</text></svg>`
  composites.push({ input: Buffer.from(label), left: x, top: y })
  const buf = await sharp(path.join(COPY_DIR, t.copy)).resize(TILE_W, TILE_H, { fit: 'contain', background: { r: 250, g: 248, b: 240 } }).png().toBuffer()
  composites.push({ input: buf, left: x, top: y + LBL_H })
  composites.push({ input: Buffer.from(`<svg width="${TILE_W}" height="2" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="2" fill="#bbf7d0"/></svg>`), left: x, top: y + LBL_H + TILE_H - 2 })
  // thumbnails index
  t.num = num
}
await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 16, g: 26, b: 18, alpha: 1 } } })
  .composite(composites).png({ compressionLevel: 6 }).toFile(path.join(OUT_DIR, 'corpus2-master.png'))
writeFileSync(path.join(COPY_DIR, 'index.json'), JSON.stringify(tiles.map(t => ({ num: t.num, src: t.src, copy: t.copy, w: t.w, h: t.h })), null, 2))
console.log('master sheet:', path.join(OUT_DIR, 'corpus2-master.png'), `${canvasW}x${canvasH}`, `${tot} tiles`)
tiles.forEach(t => console.log(t.num, t.copy))
