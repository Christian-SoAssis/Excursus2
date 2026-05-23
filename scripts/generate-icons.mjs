/**
 * Gera os ícones PNG/ICO a partir do favicon.svg.
 * Execute com: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir  = dirname(fileURLToPath(import.meta.url))
const root   = join(__dir, '..')
const svgBuf = readFileSync(join(root, 'public', 'favicon.svg'))
const out    = join(root, 'public')
mkdirSync(out, { recursive: true })

const sizes = [
  { name: 'favicon-16.png',          size: 16  },
  { name: 'favicon-32.png',          size: 32  },
  { name: 'favicon-48.png',          size: 48  },
  { name: 'apple-touch-icon.png',    size: 180 },
  { name: 'icon-192.png',            size: 192 },
  { name: 'icon-512.png',            size: 512 },
]

for (const { name, size } of sizes) {
  await sharp(svgBuf)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(out, name))
  console.log(`✓ ${name} (${size}×${size})`)
}

console.log('\nÍcones gerados em public/')
