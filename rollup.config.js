/* eslint-disable no-console */
import { babel } from '@rollup/plugin-babel'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import fs from 'fs'
import gitrev from 'git-rev-promises'
import { createRequire } from 'module'
import autoExternal from 'rollup-plugin-auto-external'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

Promise.all([
  gitrev.long(),
  gitrev.branch(),
  gitrev.tags(),
  gitrev.date(),
]).then(([hash, branch, tags, date]) => {
  const buildJson = JSON.stringify({
    version: pkg.version,
    hash,
    branch,
    tags,
    date,
  })
  fs.writeFile('build.json', buildJson, 'utf8', () => {
    console.info('Build information saved')
  })
})



const defineEntry = (input, outputDir) => {
  return {
    input,
    output: {
      dir: outputDir,
      format: 'esm',
      entryFileNames: '[name].mjs',
      sourcemap: true,
    },
    external: ['nanod'],
    preserveModules: true,
    plugins: [autoExternal(), json(), resolve(), babel({ babelHelpers: 'bundled' })],
  }
}

const config = [
  defineEntry('src/index.mjs', 'dist'),
  defineEntry('src/workers/certificate.mjs', 'dist/workers'),
  defineEntry('src/workers/image.mjs', 'dist/workers'),
]


export default config

