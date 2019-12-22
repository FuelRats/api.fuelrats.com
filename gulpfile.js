const gulp = require('gulp')
const babel = require('gulp-babel')
const sourcemaps = require('gulp-sourcemaps')
const path = require('path')
const gitrev = require('git-rev-promises')
const fs = require('fs')

const sourceRoot = path.join(__dirname, 'src')

gulp.task('default', () => {
  return new Promise((resolve, reject) => {
    gulp.src('src/**/*.js')
      .pipe(sourcemaps.init())
      .pipe(babel({
        'presets': [
          ['@babel/preset-env', {
            'targets': {
              'node': '12.6'
            },
            'shippedProposals': true
          }]
        ],
        'env': {
          'development': {
            'sourceMaps': true
          },
          'production': {
            'sourceMaps': false
          }
        },
        'plugins': [
          ['@babel/plugin-transform-modules-commonjs', { 'loose': false }],
          ['@babel/plugin-proposal-decorators', { 'legacy': true }],
          ['@babel/plugin-proposal-class-properties', { 'loose': true }],
          '@babel/plugin-proposal-do-expressions',
          '@babel/plugin-proposal-function-bind',
          '@babel/plugin-proposal-optional-catch-binding',
          '@babel/plugin-proposal-optional-chaining',
          '@babel/plugin-transform-strict-mode',
          '@babel/plugin-proposal-throw-expressions',
          '@babel/plugin-proposal-numeric-separator',
          '@babel/plugin-proposal-nullish-coalescing-operator',
          '@babel/plugin-proposal-logical-assignment-operators',
          '@babel/plugin-proposal-function-sent',
          '@babel/plugin-proposal-export-default-from',
          '@babel/plugin-proposal-export-namespace-from'
        ]
      }))
      .pipe(sourcemaps.write('.', {
        includeContent: false,
        sourceRoot
      }))
      .pipe(gulp.dest('dist')).on('error', (error) => {
        reject(error)
      })

    Promise.all([
      gitrev.long(),
      gitrev.branch(),
      gitrev.tags(),
      gitrev.date()
    ]).then(([hash, branch, tags, date]) => {
      const json = JSON.stringify({
        hash,
        branch,
        tags,
        date
      })
      fs.writeFile('build.json', json, 'utf8', () => {
        resolve()
      })
    })
    resolve()
  })
})
