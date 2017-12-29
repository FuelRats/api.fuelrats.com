const gulp = require('gulp')
const babel = require('gulp-babel')
const sourcemaps = require('gulp-sourcemaps')

gulp.task('default', () =>
  gulp.src('src/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      'env': {
        'development': {
          'sourceMaps': true
        },
        'production': {
          'sourceMaps': false
        }
      },
      'plugins': [
        ['transform-es2015-modules-commonjs', { 'loose': false }],
        'transform-decorators',
        'transform-do-expressions',
        'transform-export-extensions',
        'transform-function-bind',
        'transform-optional-catch-binding',
        'transform-optional-chaining',
        'transform-strict-mode'
      ],
      'sourceRoot': '/src'
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist'))
)