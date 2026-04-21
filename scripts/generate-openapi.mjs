#!/usr/bin/env bun
/**
 * Generate OpenAPI schema fragments from source code.
 *
 * Parses model files (@column, @validate decorators) and view files
 * (attributes, relationships) to produce component schemas. Parses route
 * files (@GET/@POST/etc, @authenticated, @permissions, @parameters, @required)
 * to produce operation skeletons.
 *
 * Output is written to docs/openapi/generated/ and merged during bundling.
 */

import { readdir, readFile, mkdir, writeFile } from 'fs/promises'
import { join, basename } from 'path'

const SRC = join(import.meta.dir, '..', 'src')
const OUT = join(import.meta.dir, '..', 'docs', 'openapi', 'generated')
const SCHEMAS_OUT = join(import.meta.dir, '..', 'docs', 'openapi', 'schemas')

// ── Sequelize type → OpenAPI type mapping ──────────────────────────

function mapColumnType (typeStr) {
  typeStr = typeStr.trim()

  if (typeStr === 'type.UUID') {
    return { type: 'string', format: 'uuid' }
  }
  if (typeStr === 'type.BOOLEAN') {
    return { type: 'boolean' }
  }
  if (typeStr === 'type.INTEGER') {
    return { type: 'integer' }
  }
  if (typeStr === 'type.DATE') {
    return { type: 'string', format: 'date-time' }
  }
  if (typeStr === 'type.TEXT') {
    return { type: 'string' }
  }
  if (typeStr === 'type.JSONB') {
    return { type: 'object' }
  }
  if (typeStr === 'type.UUIDV4') {
    return { type: 'string', format: 'uuid' }
  }

  // type.STRING or type.STRING(n)
  const stringMatch = typeStr.match(/^type\.STRING(?:\((\d+)\))?$/)
  if (stringMatch) {
    const schema = { type: 'string' }
    if (stringMatch[1]) {
      schema.maxLength = parseInt(stringMatch[1], 10)
    }
    return schema
  }

  // type.ENUM('a', 'b', 'c') — may span multiple lines
  const enumMatch = typeStr.match(/^type\.ENUM\(([\s\S]*)\)$/)
  if (enumMatch) {
    const values = [...enumMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    return { type: 'string', enum: values }
  }

  // type.ARRAY(type.X)
  const arrayMatch = typeStr.match(/^type\.ARRAY\((.+)\)$/)
  if (arrayMatch) {
    return { type: 'array', items: mapColumnType(arrayMatch[1]) }
  }

  // type.RANGE — skip
  if (typeStr.startsWith('type.RANGE')) {
    return null
  }

  // type.VIRTUAL — skip
  if (typeStr.startsWith('type.VIRTUAL')) {
    return null
  }

  return { type: 'string' }
}

// ── Model parser ───────────────────────────────────────────────────

function parseModel (source) {
  const fields = {}

  const lines = source.split('\n')
  let pendingValidate = null
  let pendingColumn = null
  let pendingDescription = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // /** description */ — single-line JSDoc
    const jsdocMatch = line.match(/^\/\*\*\s*(.+?)\s*\*\/$/)
    if (jsdocMatch) {
      pendingDescription = jsdocMatch[1]
      continue
    }

    // @validate({ ... })
    const validateMatch = line.match(/^@validate\(\{(.+)\}\)$/)
    if (validateMatch) {
      pendingValidate = validateMatch[1]
      continue
    }

    // @column(type.ENUM(\n  'a', 'b'\n)) — multi-line column
    if (line.startsWith('@column(') && !line.endsWith(')')) {
      let full = line
      for (let j = i + 1; j < lines.length; j++) {
        full += ' ' + lines[j].trim()
        if (full.split('(').length <= full.split(')').length) {
          i = j
          break
        }
      }
      // Parse the assembled single-line @column(...)
      const inner = full.slice(8, -1)
      let parenDepth = 0
      let splitIdx = -1
      for (let c = 0; c < inner.length; c++) {
        if (inner[c] === '(') { parenDepth++ }
        if (inner[c] === ')') { parenDepth-- }
        if (parenDepth === 0 && inner[c] === ',' && inner.slice(c + 1).trimStart().startsWith('{')) {
          splitIdx = c
          break
        }
      }
      if (splitIdx > 0) {
        pendingColumn = { typeStr: inner.slice(0, splitIdx).trim(), options: inner.slice(splitIdx + 1).trim() }
      } else {
        pendingColumn = { typeStr: inner.trim(), options: '{}' }
      }
      continue
    }

    // @column(type.X) or @column(type.X, { options }) — handle ENUM with commas in values
    if (line.startsWith('@column(') && line.endsWith(')')) {
      // Strip @column( and trailing )
      const inner = line.slice(8, -1)
      // Find the options object after the last }), if any
      // The type arg ends at the first `, {` that's not inside parens
      let parenDepth = 0
      let splitIdx = -1
      for (let c = 0; c < inner.length; c++) {
        if (inner[c] === '(') { parenDepth++ }
        if (inner[c] === ')') { parenDepth-- }
        if (parenDepth === 0 && inner[c] === ',' && inner[c + 1] === ' ' && inner[c + 2] === '{') {
          splitIdx = c
          break
        }
      }
      if (splitIdx > 0) {
        pendingColumn = { typeStr: inner.slice(0, splitIdx).trim(), options: inner.slice(splitIdx + 2).trim() }
      } else {
        pendingColumn = { typeStr: inner.trim(), options: '{}' }
      }
      continue
    }

    // static fieldName = defaultValue
    const fieldMatch = line.match(/^static\s+(\w+)\s*=/)
    if (fieldMatch && pendingColumn) {
      // Use column name override if present: @column(type.X, { name: 'actualName' })
      const nameOverride = pendingColumn.options.match(/name:\s*'(\w+)'/)
      const name = nameOverride ? nameOverride[1] : fieldMatch[1]
      const schema = mapColumnType(pendingColumn.typeStr)
      if (schema) {
        const field = { ...schema }

        // Apply validate constraints
        if (pendingValidate) {
          if (pendingValidate.includes('isEmail')) {
            field.format = 'email'
          }
          const lenMatch = pendingValidate.match(/len:\s*\[(\d+),\s*(\d+)\]/)
          if (lenMatch) {
            field.minLength = parseInt(lenMatch[1], 10)
            field.maxLength = parseInt(lenMatch[2], 10)
          }
          const isInMatch = pendingValidate.match(/isIn:\s*\[\[([^\]]+)\]\]/)
          if (isInMatch) {
            field.enum = [...isInMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
          }
        }

        // Check allowNull
        if (pendingColumn.options.includes('allowNull: true')) {
          field.nullable = true
        }

        // Apply JSDoc description
        if (pendingDescription) {
          field.description = pendingDescription
        }

        fields[name] = field
      }

      pendingValidate = null
      pendingColumn = null
      pendingDescription = null
      continue
    }

    // If we hit a non-decorator, non-field line, reset pending
    if (!line.startsWith('@') && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') && line !== '') {
      pendingValidate = null
      pendingDescription = null
      pendingColumn = null
    }
  }

  return fields
}

// ── View parser ────────────────────────────────────────────────────

function parseView (source) {
  const result = { type: null, attributes: [], relationships: {}, includes: [] }

  // Extract type
  const typeMatch = source.match(/static\s+get\s+type\s*\(\)\s*\{\s*return\s+'([^']+)'/)
  if (typeMatch) {
    result.type = typeMatch[1]
  }

  // Extract attributes — class syntax: `return class { static field; static field = Perm }`
  const classAttrMatch = source.match(/get\s+attributes\s*\(\)\s*\{\s*return\s+class\s*\{([\s\S]*?)\}/)
  if (classAttrMatch) {
    const body = classAttrMatch[1]
    for (const m of body.matchAll(/static\s+(\w+)/g)) {
      result.attributes.push(m[1])
    }
  } else {
    // Object syntax: `return { field: ReadPermission.x, ... }`
    const objAttrMatch = source.match(/get\s+attributes\s*\(\)\s*\{\s*return\s*\{([\s\S]*?)\}\s*\}/)
    if (objAttrMatch) {
      for (const m of objAttrMatch[1].matchAll(/(\w+)\s*:/g)) {
        result.attributes.push(m[1])
      }
    }
  }

  // Extract relationships: `return { rats: RatView, firstLimpet: RatView }`
  const relMatch = source.match(/get\s+relationships\s*\(\)\s*\{\s*return\s*\{([\s\S]*?)\}\s*\}/)
  if (relMatch) {
    for (const m of relMatch[1].matchAll(/(\w+)\s*:\s*(\w+)/g)) {
      result.relationships[m[1]] = m[2].replace(/View$/, '').toLowerCase()
    }
  }

  // Extract includes
  const incMatch = source.match(/get\s+includes\s*\(\)\s*\{\s*return\s*\[([\s\S]*?)\]/)
  if (incMatch) {
    for (const m of incMatch[1].matchAll(/'(\w+)'/g)) {
      result.includes.push(m[1])
    }
  }

  return result
}

// ── Write permission parser ────────────────────────────────────────

const writePermissionLabels = {
  'WritePermission.all': 'anyone',
  'WritePermission.group': 'owner or admin',
  'WritePermission.self': 'owner only',
  'WritePermission.sudo': 'admin only',
  'WritePermission.internal': 'system only',
}

function parseWritePermissions (source) {
  const match = source.match(/get\s+writePermissionsForFieldAccess\s*\(\)\s*\{\s*return\s*\{([\s\S]*?)\}\s*\}/)
  if (!match) { return {} }

  const perms = {}
  for (const m of match[1].matchAll(/(\w+):\s*(WritePermission\.\w+)/g)) {
    const label = writePermissionLabels[m[2]]
    if (label) {
      perms[m[1]] = label
    }
  }
  return perms
}

// ── Route parser ───────────────────────────────────────────────────

function parseRoutes (source) {
  const endpoints = []
  const lines = source.split('\n')

  // Extract resource type
  let resourceType = null
  const typeMatch = source.match(/get\s+type\s*\(\)\s*\{\s*return\s+'([^']+)'/)
  if (typeMatch) {
    resourceType = typeMatch[1]
  }

  let pendingDecorators = []
  let pendingJsdoc = { summary: null, description: null, queryparams: [] }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Parse JSDoc blocks
    if (line === '/**') {
      const jsdoc = { summary: null, description: null, queryparams: [] }
      let descLines = []
      for (let j = i + 1; j < lines.length; j++) {
        const jline = lines[j].trim().replace(/^\*\s?/, '').replace(/\*\/$/, '').trim()
        if (lines[j].trim() === '*/') { i = j; break }
        if (lines[j].trim().endsWith('*/')) {
          if (jline) { descLines.push(jline) }
          i = j; break
        }
        const summaryMatch = jline.match(/^@summary\s+(.+)$/)
        if (summaryMatch) { jsdoc.summary = summaryMatch[1]; continue }
        const descMatch = jline.match(/^@description\s+(.+)$/)
        if (descMatch) { descLines.push(descMatch[1]); continue }
        const qpMatch = jline.match(/^@queryparam\s+\{(\w+)\}\s+(\w+)\s+-\s+(.+)$/)
        if (qpMatch) { jsdoc.queryparams.push({ type: qpMatch[1], name: qpMatch[2], description: qpMatch[3] }); continue }
        if (!jline.startsWith('@') && jline) { descLines.push(jline) }
      }
      if (descLines.length > 0) { jsdoc.description = descLines.join(' ') }
      pendingJsdoc = jsdoc
      continue
    }
    // Single-line JSDoc: /** @summary Foo */
    const singleJsdoc = line.match(/^\/\*\*\s*@summary\s+(.+?)\s*\*\/$/)
    if (singleJsdoc) {
      pendingJsdoc = { summary: singleJsdoc[1], description: null, queryparams: [] }
      continue
    }

    // Collect decorators
    const httpMatch = line.match(/^@(GET|POST|PUT|PATCH|DELETE)\('([^']+)'\)$/)
    if (httpMatch) {
      pendingDecorators.push({ type: 'http', method: httpMatch[1].toLowerCase(), path: httpMatch[2] })
      continue
    }

    if (line === '@authenticated') {
      pendingDecorators.push({ type: 'authenticated' })
      continue
    }

    const permMatch = line.match(/^@permissions\('([^']+)'\)$/)
    if (permMatch) {
      pendingDecorators.push({ type: 'permissions', value: permMatch[1] })
      continue
    }

    const paramMatch = line.match(/^@parameters\('([^']+)'\)$/)
    if (paramMatch) {
      pendingDecorators.push({ type: 'parameters', value: paramMatch[1] })
      continue
    }

    const reqMatch = line.match(/^@required\((.+)\)$/)
    if (reqMatch) {
      const fields = [...reqMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
      pendingDecorators.push({ type: 'required', fields })
      continue
    }

    // Method declaration — consume decorators
    const methodMatch = line.match(/^async\s+(\w+)\s*\(/)
    if (methodMatch && pendingDecorators.length > 0) {
      const httpDec = pendingDecorators.find((d) => d.type === 'http')
      if (httpDec) {
        const endpoint = {
          method: httpDec.method,
          path: httpDec.path,
          methodName: methodMatch[1],
          authenticated: pendingDecorators.some((d) => d.type === 'authenticated'),
          permissions: pendingDecorators.filter((d) => d.type === 'permissions').map((d) => d.value),
          parameters: pendingDecorators.filter((d) => d.type === 'parameters').map((d) => d.value),
          required: pendingDecorators.filter((d) => d.type === 'required').flatMap((d) => d.fields),
          resourceType,
          summary: pendingJsdoc.summary,
          description: pendingJsdoc.description,
          queryparams: pendingJsdoc.queryparams,
        }
        endpoints.push(endpoint)
      }
      pendingDecorators = []
      pendingJsdoc = { summary: null, description: null, queryparams: [] }
      continue
    }

    // Non-decorator line resets
    if (!line.startsWith('@') && !line.startsWith('//') && line !== '') {
      pendingDecorators = []
    }
  }

  return endpoints
}

// ── YAML serialization (minimal, no dependency) ────────────────────

function toYaml (obj, indent = 0) {
  const pad = '  '.repeat(indent)
  let out = ''

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue
    }
    if (typeof value === 'string') {
      out += `${pad}${key}: ${value}\n`
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out += `${pad}${key}: ${value}\n`
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        out += `${pad}${key}: []\n`
      } else if (typeof value[0] === 'string' || typeof value[0] === 'number') {
        out += `${pad}${key}:\n`
        for (const item of value) {
          out += `${pad}  - ${item}\n`
        }
      } else {
        out += `${pad}${key}:\n`
        for (const item of value) {
          out += toYaml(item, indent + 1)
        }
      }
    } else if (typeof value === 'object') {
      out += `${pad}${key}:\n`
      out += toYaml(value, indent + 1)
    }
  }

  return out
}

// ── Schema generation ──────────────────────────────────────────────

function generateSchema (modelFields, view) {
  const properties = {}

  for (const attr of view.attributes) {
    if (modelFields[attr]) {
      properties[attr] = { ...modelFields[attr] }
    } else if (attr === 'createdAt' || attr === 'updatedAt' || attr === 'deletedAt') {
      properties[attr] = { type: 'string', format: 'date-time' }
    } else {
      // View exposes an attribute not found in model (virtual field, JSONB sub-field, etc.)
      properties[attr] = { type: 'string' }
    }
  }

  const relationships = {}
  for (const [name, relType] of Object.entries(view.relationships)) {
    relationships[name] = {
      type: 'object',
      properties: {
        data: {
          description: `Related ${relType} resource(s)`,
        },
        links: {
          type: 'object',
        },
      },
    }
  }

  return { properties, relationships }
}

// ── Route skeleton generation ──────────────────────────────────────

function generateRouteSkeleton (endpoint) {
  const op = {
    tags: [endpoint.resourceType || 'default'],
    summary: endpoint.summary || `${endpoint.method.toUpperCase()} ${endpoint.path}`,
  }
  if (endpoint.description) {
    op.description = endpoint.description
  }

  if (endpoint.authenticated) {
    op.security = [{ bearerAuth: endpoint.permissions.length > 0 ? endpoint.permissions : [] }]
  }

  if (endpoint.parameters.length > 0 || endpoint.path.includes(':')) {
    op.parameters = []
    // Extract path params from route path
    const pathParams = [...endpoint.path.matchAll(/:(\w+)/g)].map((m) => m[1])
    for (const param of pathParams) {
      op.parameters.push({
        name: param,
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      })
    }
  }

  // Add query params from @queryparam JSDoc tags
  if (endpoint.queryparams.length > 0) {
    if (!op.parameters) { op.parameters = [] }
    for (const qp of endpoint.queryparams) {
      op.parameters.push({
        name: qp.name,
        in: 'query',
        required: false,
        description: qp.description,
        schema: { type: qp.type },
      })
    }
  }

  if (['post', 'put', 'patch'].includes(endpoint.method) && endpoint.resourceType) {
    op.requestBody = {
      required: true,
      content: {
        'application/vnd.api+json': {
          schema: {
            type: 'object',
            required: ['data'],
          },
        },
      },
    }
  }

  const responses = {}
  if (endpoint.method === 'post') {
    responses['201'] = { description: 'Created successfully' }
  } else if (endpoint.method === 'delete') {
    responses['204'] = { description: 'Deleted successfully' }
  } else {
    responses['200'] = { description: 'Success' }
  }
  if (endpoint.authenticated) {
    responses['401'] = { description: 'Unauthorized' }
  }
  if (endpoint.permissions.length > 0) {
    responses['403'] = { description: 'Forbidden' }
  }
  op.responses = responses

  return op
}

// ── Main ───────────────────────────────────────────────────────────

async function main () {
  await mkdir(join(OUT, 'schemas'), { recursive: true })
  await mkdir(join(OUT, 'routes'), { recursive: true })

  // Parse all models
  const modelDir = join(SRC, 'db')
  const modelFiles = (await readdir(modelDir)).filter((f) =>
    f.endsWith('.mjs') && f !== 'Model.mjs' && f !== 'index.mjs',
  )

  const models = {}
  for (const file of modelFiles) {
    const source = await readFile(join(modelDir, file), 'utf8')
    const name = basename(file, '.mjs')
    models[name] = parseModel(source)
  }

  // Parse all views
  const viewDir = join(SRC, 'view')
  const viewFiles = (await readdir(viewDir)).filter((f) =>
    f.endsWith('View.mjs') && f !== 'View.mjs' && f !== 'DatabaseView.mjs',
  )

  const views = {}
  for (const file of viewFiles) {
    const source = await readFile(join(viewDir, file), 'utf8')
    const name = basename(file, 'View.mjs')
    views[name] = parseView(source)
  }

  // Parse write permissions from route files
  const routeDir = join(SRC, 'routes')
  const writePerms = {}
  const routePermFiles = {
    Rescue: 'Rescues.mjs',
    User: 'Users.mjs',
    Rat: 'Rats.mjs',
    Client: 'Clients.mjs',
    Decal: 'Decals.mjs',
    Group: 'Groups.mjs',
    Epic: 'Epics.mjs',
  }
  for (const [modelName, routeFile] of Object.entries(routePermFiles)) {
    try {
      const source = await readFile(join(routeDir, routeFile), 'utf8')
      writePerms[modelName] = parseWritePermissions(source)
    } catch {
      writePerms[modelName] = {}
    }
  }

  // Generate schemas by matching models to views
  // Maps: ModelName → { viewName, schemaName (PascalCase), fileName }
  const modelViewMap = {
    Rescue: { view: 'Rescue', schema: 'Rescue', file: 'rescues' },
    User: { view: 'User', schema: 'User', file: 'users' },
    Rat: { view: 'Rat', schema: 'Rat', file: 'rats' },
    Client: { view: 'Client', schema: 'Client', file: 'clients' },
    Decal: { view: 'Decal', schema: 'Decal', file: 'decals' },
    Group: { view: 'Group', schema: 'Group', file: 'groups' },
    Epic: { view: 'Epic', schema: 'Epic', file: 'epics' },
    Passkey: { view: 'Passkey', schema: 'Passkey', file: 'passkeys' },
    Token: { view: 'Token', schema: 'Session', file: 'sessions' },
    Avatar: { view: 'Avatar', schema: 'Avatar', file: 'avatars' },
    Authenticator: { view: 'Authenticator', schema: 'Authenticator', file: 'authenticators' },
    WebPushSubscription: { view: 'WebPushSubscription', schema: 'WebPushSubscription', file: 'web-push-subscriptions' },
  }

  for (const [modelName, { view: viewName, schema: schemaName, file: fileName }] of Object.entries(modelViewMap)) {
    const model = models[modelName]
    const view = views[viewName]
    if (!model || !view || !view.type) {
      console.log(`  skip ${modelName} (model: ${!!model}, view: ${!!view})`)
      continue
    }

    const { properties, relationships } = generateSchema(model, view)

    // Annotate field descriptions with write permissions
    const perms = writePerms[modelName] || {}
    for (const [field, label] of Object.entries(perms)) {
      if (properties[field]) {
        const existing = properties[field].description || ''
        properties[field].description = existing
          ? `${existing} (writable by: ${label})`
          : `Writable by: ${label}`
      }
    }

    // Build resource schema with proper relationship $refs
    let relYaml = ''
    if (Object.keys(relationships).length > 0) {
      relYaml += `        relationships:\n          type: object\n          properties:\n`
      for (const [relName, relType] of Object.entries(view.relationships)) {
        const isArray = relName === 'rats' || relName === 'epics' || relName === 'nominees'
          || relName === 'decals' || relName === 'groups' || relName === 'clients'
          || relName === 'nicknames'
        relYaml += `            ${relName}:\n              type: object\n              properties:\n`
        if (isArray) {
          relYaml += `                data:\n                  type: array\n                  items:\n                    allOf:\n                      - $ref: '../components/schemas.yaml#/ResourceIdentifier'\n                      - properties:\n                          type:\n                            enum: [${relType}]\n`
        } else {
          relYaml += `                data:\n                  nullable: true\n                  allOf:\n                    - $ref: '../components/schemas.yaml#/ResourceIdentifier'\n                    - properties:\n                        type:\n                          enum: [${relType}]\n`
        }
        relYaml += `                links:\n                  $ref: '../components/schemas.yaml#/Links'\n`
      }
    }

    // Build attributes YAML with descriptions
    let attrYaml = ''
    for (const [attr, schema] of Object.entries(properties)) {
      attrYaml += `            ${attr}:\n`
      attrYaml += `              type: ${schema.type}\n`
      if (schema.format) { attrYaml += `              format: ${schema.format}\n` }
      if (schema.enum) { attrYaml += `              enum: [${schema.enum.join(', ')}]\n` }
      if (schema.nullable) { attrYaml += `              nullable: true\n` }
      if (schema.minLength !== undefined) { attrYaml += `              minLength: ${schema.minLength}\n` }
      if (schema.maxLength !== undefined) { attrYaml += `              maxLength: ${schema.maxLength}\n` }
      if (schema.items) {
        attrYaml += `              items:\n                type: ${schema.items.type}\n`
        if (schema.items.format) { attrYaml += `                format: ${schema.items.format}\n` }
      }
      if (schema.description) {
        const needsQuote = schema.description.includes(':') || schema.description.includes("'")
        const desc = needsQuote ? `"${schema.description.replace(/"/g, '\\"')}"` : schema.description
        attrYaml += `              description: ${desc}\n`
      }
    }

    const yaml = `# Auto-generated from ${modelName} model + ${viewName}View
# Regenerate with: bun run openapi:generate

${schemaName}:
  allOf:
    - $ref: '../components/schemas.yaml#/ResourceIdentifier'
    - type: object
      properties:
        type:
          type: string
          enum: [${view.type}]
        attributes:
          type: object
          properties:
${attrYaml}${relYaml}
${schemaName}Document:
  allOf:
    - $ref: '../components/schemas.yaml#/SingleResourceDocument'
    - properties:
        data:
          $ref: '#/${schemaName}'

${schemaName}Collection:
  allOf:
    - $ref: '../components/schemas.yaml#/CollectionDocument'
    - properties:
        data:
          type: array
          items:
            $ref: '#/${schemaName}'
`
    await writeFile(join(SCHEMAS_OUT, `${fileName}.yaml`), yaml)
    console.log(`  schema: ${fileName} (${Object.keys(properties).length} attributes, ${Object.keys(relationships).length} relationships)`)

    // Also write to generated/ for reference
    const genYaml = `# Auto-generated from ${modelName} model + ${viewName}View\n# Do not edit — regenerate with: bun run openapi:generate\n\n${toYaml({ [`${view.type}Resource`]: { type: 'object', properties: { type: { type: 'string', enum: [view.type] }, id: { type: 'string', format: 'uuid' }, attributes: { type: 'object', properties }, relationships: Object.keys(relationships).length > 0 ? { type: 'object', properties: relationships } : undefined } } })}`
    await writeFile(join(OUT, 'schemas', `${view.type}.yaml`), genYaml)
  }

  // Parse all routes
  const routeFiles = (await readdir(routeDir)).filter((f) =>
    f.endsWith('.mjs') && f !== 'API.mjs' && f !== 'APIResource.mjs',
  )

  let routesSummary = '# Auto-generated route inventory — do not edit\n'
  routesSummary += '# Generated by scripts/generate-openapi.mjs\n\n'

  for (const file of routeFiles) {
    const source = await readFile(join(routeDir, file), 'utf8')
    const endpoints = parseRoutes(source)
    if (endpoints.length === 0) {
      continue
    }

    const name = basename(file, '.mjs').toLowerCase()

    // Group endpoints by path into path items
    const pathItems = {}
    for (const ep of endpoints) {
      const openapiPath = ep.path.replace(/:(\w+)/g, '{$1}')
      if (!pathItems[openapiPath]) {
        pathItems[openapiPath] = {}
      }
      pathItems[openapiPath][ep.method] = generateRouteSkeleton(ep)

      routesSummary += `${ep.method.toUpperCase().padEnd(7)} ${openapiPath.padEnd(50)} ${ep.authenticated ? 'auth' : '    '} ${ep.permissions.join(', ')}${ep.summary ? `  # ${ep.summary}` : ''}\n`
    }

    let yaml = `# Auto-generated from ${file}\n# Do not edit — regenerate with: bun run openapi:generate\n\n`
    for (const [path, methods] of Object.entries(pathItems)) {
      yaml += `'${path}':\n`
      for (const [method, op] of Object.entries(methods)) {
        yaml += `  ${method}:\n`
        yaml += toYaml(op, 2)
      }
      yaml += '\n'
    }

    await writeFile(join(OUT, 'routes', `${name}.yaml`), yaml)
    console.log(`  routes: ${name} (${endpoints.length} endpoints)`)
  }

  await writeFile(join(OUT, 'routes', '_summary.yaml'), routesSummary)

  // Coverage check: compare code endpoints vs documented paths in openapi.yaml
  const openapiSource = await readFile(join(import.meta.dir, '..', 'docs', 'openapi', 'openapi.yaml'), 'utf8')
  const documentedPaths = new Set()
  for (const m of openapiSource.matchAll(/^\s{2}(\/[^\s:]+):/gm)) {
    documentedPaths.add(m[1].replace(/\{(\w+)\}/g, ':$1'))
  }

  const allCodeEndpoints = []
  for (const file of routeFiles) {
    const source = await readFile(join(routeDir, file), 'utf8')
    for (const ep of parseRoutes(source)) {
      allCodeEndpoints.push(ep.path)
    }
  }
  const codePathsSet = new Set(allCodeEndpoints)

  const undocumented = [...codePathsSet].filter((p) => !documentedPaths.has(p))
  if (undocumented.length > 0) {
    console.log(`\n⚠ ${undocumented.length} endpoints in code but not in openapi.yaml:`)
    for (const p of undocumented) {
      console.log(`  ${p}`)
    }
  }

  console.log(`\n✓ ${documentedPaths.size} documented paths, ${codePathsSet.size} code endpoints, ${undocumented.length} undocumented`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
