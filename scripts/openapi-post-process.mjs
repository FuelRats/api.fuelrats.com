#!/usr/bin/env bun
/**
 * Post-process the bundled OpenAPI spec:
 * - Adds operationId to every operation based on method + path
 */

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const BUNDLED = join(import.meta.dir, '..', 'docs', 'openapi', 'bundled.yaml')

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete']

/**
 * Generate an operationId from method + path
 * e.g. GET /users/{id}/passkeys → getUsers_id_passkeys
 *      POST /rescues/{id}/alert → postRescues_id_alert
 */
function generateOperationId (method, path) {
  const segments = path.replace(/^\//, '').split('/').map((seg) => {
    if (seg.startsWith('{') && seg.endsWith('}')) {
      return seg.slice(1, -1)
    }
    // camelCase: first segment lowercase, rest capitalized
    return seg.replace(/[^a-zA-Z0-9]/g, '')
  })

  const name = segments.map((s, i) => {
    if (i === 0) { return s }
    return s.charAt(0).toUpperCase() + s.slice(1)
  }).join('')

  return `${method}${name.charAt(0).toUpperCase()}${name.slice(1)}`
}

async function main () {
  let yaml = await readFile(BUNDLED, 'utf8')
  const lines = yaml.split('\n')
  const output = []
  let currentPath = null
  let added = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect path: "  /some/path:" at 2-space indent
    const pathMatch = line.match(/^  (\/[^:]+):$/)
    if (pathMatch) {
      currentPath = pathMatch[1]
    }

    // Detect method: "    get:" at 4-space indent
    const methodMatch = line.match(/^    (get|post|put|patch|delete):$/)
    if (methodMatch && currentPath) {
      const method = methodMatch[1]
      output.push(line)

      // Check if next lines already have operationId
      let hasOperationId = false
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].match(/^\s+operationId:/)) {
          hasOperationId = true
          break
        }
        // Stop checking at next key at same or lower indent
        if (lines[j].match(/^    \w/) || lines[j].match(/^  \//)) {
          break
        }
      }

      if (!hasOperationId) {
        const opId = generateOperationId(method, currentPath)
        output.push(`      operationId: ${opId}`)
        added++
      }
      continue
    }

    output.push(line)
  }

  await writeFile(BUNDLED, output.join('\n'))
  console.log(`  operationIds: added ${added} to bundled.yaml`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
