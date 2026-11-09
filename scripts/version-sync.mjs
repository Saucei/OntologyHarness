// Version sync (S3-F) — pins Cargo.toml + tauri.conf.json + package.json to one version.
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const version = pkg.version
if (!/^\d+\.\d+\.\d+$/.test(version)) { console.error('bad version', version); process.exit(1) }

const cargoPath = new URL('../src-tauri/Cargo.toml', import.meta.url)
const cargo = readFileSync(cargoPath, 'utf8')
writeFileSync(cargoPath, cargo.replace(/version = ".*"/, `version = "${version}"`))

const tauriPath = new URL('../src-tauri/tauri.conf.json', import.meta.url)
const tauri = JSON.parse(readFileSync(tauriPath, 'utf8'))
tauri.version = version
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2))

console.log(`synced version ${version} → Cargo.toml + tauri.conf.json`)
