const gulp = require('gulp')
const babel = require('gulp-babel')
const sourcemaps = require('gulp-sourcemaps')
const path = require('path')

const sourceRoot = path.join(__dirname, 'src')

gulp.task('default', () =>
  gulp.src('src/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      'presets': [
        ['@babel/preset-env', {
          'targets': {
            'node': '10.6'
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
      sourceRoot: sourceRoot
    }))
    .pipe(gulp.dest('dist'))
)
