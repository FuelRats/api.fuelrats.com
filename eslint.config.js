import js from '@eslint/js'
import globals from 'globals'
import babelParser from '@babel/eslint-parser'

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          plugins: [
            ['@babel/plugin-proposal-decorators', { version: '2023-11' }],
          ],
        },
      },
      globals: {
        ...globals.node,
        Bun: 'readonly',
        Worker: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_|^context$',
        varsIgnorePattern: '^_',
      }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'max-lines': ['error', { max: 2000 }],
      'no-invalid-this': 'off',
    },
  },
  {
    files: ['src/workers/**/*.mjs'],
    languageOptions: {
      globals: {
        self: 'readonly',
        postMessage: 'readonly',
      },
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.yarn/',
      'src/model/',
      'data/',
      'tools/',
    ],
  },
]
