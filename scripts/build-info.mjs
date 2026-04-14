import { $ } from 'bun'
import { writeFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const [hash, branch, tags, date] = await Promise.all([
  $`git rev-parse HEAD`.text(),
  $`git rev-parse --abbrev-ref HEAD`.text(),
  $`git describe --tags --always`.text().catch(() => ''),
  $`git log -1 --format=%ci`.text(),
])

const buildJson = JSON.stringify({
  version: pkg.version,
  hash: hash.trim(),
  branch: branch.trim(),
  tags: tags.trim(),
  date: date.trim(),
})

writeFileSync('build.json', buildJson, 'utf8')
console.info('Build information saved')
