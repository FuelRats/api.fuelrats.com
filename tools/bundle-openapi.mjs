#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'

async function bundleOpenAPI() {
  try {
    const docsPath = path.resolve('docs/openapi')
    
    // Load main spec
    const mainSpec = yaml.load(await fs.readFile(path.join(docsPath, 'openapi.yaml'), 'utf8'))
    
    // Load component files
    const components = {
      schemas: yaml.load(await fs.readFile(path.join(docsPath, 'components/schemas.yaml'), 'utf8')),
      parameters: yaml.load(await fs.readFile(path.join(docsPath, 'components/parameters.yaml'), 'utf8')),
      responses: yaml.load(await fs.readFile(path.join(docsPath, 'components/responses.yaml'), 'utf8'))
    }
    
    // Dynamically load all schema files
    const schemasDir = path.join(docsPath, 'schemas')
    try {
      const schemaFiles = await fs.readdir(schemasDir)
      for (const file of schemaFiles) {
        if (file.endsWith('.yaml')) {
          try {
            const schemas = yaml.load(await fs.readFile(path.join(schemasDir, file), 'utf8'))
            Object.assign(components.schemas, schemas)
          } catch (err) {
            console.warn(`Warning: Could not read schema file ${file}: ${err.message}`)
          }
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not read schemas directory: ${err.message}`)
    }
    
    // Dynamically load all route files
    const routesDir = path.join(docsPath, 'routes')
    const routes = {}
    try {
      const routeFiles = await fs.readdir(routesDir)
      for (const file of routeFiles) {
        if (file.endsWith('.yaml')) {
          const routeName = path.basename(file, '.yaml')
          try {
            routes[routeName] = yaml.load(await fs.readFile(path.join(routesDir, file), 'utf8'))
          } catch (err) {
            console.warn(`Warning: Could not read route file ${file}: ${err.message}`)
          }
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not read routes directory: ${err.message}`)
    }
    
    // Build the bundled spec
    const bundledSpec = {
      ...mainSpec,
      components: {
        ...mainSpec.components,
        schemas: components.schemas,
        parameters: components.parameters,
        responses: components.responses
      },
      paths: {}
    }
    
    // Resolve all path references
    for (const [pathKey, pathValue] of Object.entries(mainSpec.paths)) {
      if (pathValue.$ref) {
        // Parse the $ref: './routes/users.yaml#/users'
        const [filePart, sectionPart] = pathValue.$ref.split('#/')
        const fileName = path.basename(filePart, '.yaml')
        const sectionName = sectionPart
        
        if (routes[fileName] && routes[fileName][sectionName]) {
          bundledSpec.paths[pathKey] = routes[fileName][sectionName]
        } else {
          console.warn(`Could not resolve reference: ${pathValue.$ref}`)
          bundledSpec.paths[pathKey] = pathValue // Keep original reference
        }
      } else {
        bundledSpec.paths[pathKey] = pathValue
      }
    }
    
    // Recursively resolve all $ref references to point to the bundled components
    function resolveRefs(obj) {
      if (typeof obj !== 'object' || obj === null) return obj
      
      if (Array.isArray(obj)) {
        return obj.map(resolveRefs)
      }
      
      const result = {}
      for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref' && typeof value === 'string') {
          // Convert external file references to internal component references
          if (value.startsWith('../components/')) {
            result[key] = value.replace('../components/', '#/components/').replace('.yaml#/', '/')
          } else if (value.startsWith('../schemas/')) {
            result[key] = value.replace('../schemas/', '#/components/schemas/').replace('.yaml#/', '')
          } else if (value.startsWith('./schemas.yaml#/')) {
            result[key] = value.replace('./schemas.yaml#/', '#/components/schemas/')
          } else {
            result[key] = value
          }
        } else {
          result[key] = resolveRefs(value)
        }
      }
      return result
    }
    
    const resolvedSpec = resolveRefs(bundledSpec)
    const bundledYaml = yaml.dump(resolvedSpec, { lineWidth: -1, noRefs: true })
    
    await fs.writeFile(path.join(docsPath, 'bundled.yaml'), bundledYaml)
    console.log('OpenAPI spec bundled successfully!')
    
  } catch (error) {
    console.error('Error bundling OpenAPI spec:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bundleOpenAPI()
}