import { copyFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const buildDir = 'public/build'
const root = 'public'
const files = ['sw.js', 'manifest.webmanifest']

for (const f of files) {
  const src = join(buildDir, f)
  if (existsSync(src)) {
    copyFileSync(src, join(root, f))
    console.log(`[pwa] copied ${src} -> ${join(root, f)}`)
  }
}

if (existsSync(buildDir)) {
  for (const f of readdirSync(buildDir)) {
    if (f.startsWith('workbox-') && f.endsWith('.js')) {
      copyFileSync(join(buildDir, f), join(root, f))
      console.log(`[pwa] copied workbox runtime ${f}`)
    }
  }
}
