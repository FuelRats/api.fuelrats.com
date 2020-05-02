/* eslint-disable no-console */
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import fs from 'fs'
import gitrev from 'git-rev-promises'
import autoExternal from 'rollup-plugin-auto-external'
import babel from 'rollup-plugin-babel'
import pkg from './package.json'

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

const config = {
  input: 'src/index.mjs',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].mjs',
    sourcemap: true,
  },
  external: ['nanoid/async'],
  preserveModules: true,
  plugins: [autoExternal(), json(), resolve(), babel({ externalHelpers: true })],
}

export default config

