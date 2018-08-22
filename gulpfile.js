const gulp = require('gulp');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const watch = require('gulp-watch');

gulp.task('styles', (done) => {
  gulp.src('sass/**/main.scss')
  .pipe(sass({
    outputStyle: 'compressed'
  }).on('error', sass.logError))
  .pipe(
    autoprefixer({
      browsers: ['last 2 versions']
    }))
    .pipe(gulp.dest('./css'));
    done();
});

gulp.task('watch:css', () => {
  gulp.watch('sass/**/*.scss', gulp.series('styles'));
})
