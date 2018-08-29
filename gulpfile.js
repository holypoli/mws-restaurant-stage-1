const gulp = require("gulp");
const sass = require("gulp-sass");
const autoprefixer = require("gulp-autoprefixer");
const concat = require("gulp-concat");
const minify = require("gulp-minify");
const uglify = require("gulp-uglify");
const watch = require("gulp-watch");
const babel = require("gulp-babel");
const responsive = require("gulp-responsive-images");

gulp.task("styles", done => {
  gulp
    .src("sass/**/main.scss")
    .pipe(
      sass({
        outputStyle: "compressed"
      }).on("error", sass.logError)
    )
    .pipe(
      autoprefixer({
        browsers: ["last 2 versions"]
      })
    )
    .pipe(gulp.dest("./css"));
  done();
});

gulp.task("watch:css", () => {
  gulp.watch("sass/**/*.scss", gulp.series("styles"));
});

gulp.task("images", () => {
  gulp
    .src("img/**/*")
    .pipe(
      responsive({
        "*.jpg": [
          {
            width: 200,
            suffix: "-200-small-1x",
            quality: 70
          },
          {
            width: 400,
            suffix: "-400-medium-1x",
            quality: 70
          },
          {
            width: 800,
            suffix: "-800-large-1x",
            quality: 70
          },
          {
            width: 400,
            suffix: "-400-small-2x",
            quality: 70
          },
          {
            width: 800,
            suffix: "-800-medium-2x",
            quality: 70
          },
          {
            width: 1600,
            suffix: "-1600-large-2x",
            quality: 70
          }
        ]
      })
    )
    .pipe(gulp.dest("responsive-img"));
});

gulp.task("javascript", () => {
  gulp
    .src(["js/idb.js", "js/dbhelper.js", "js/main.js", "js/restaurant_info.js"])
    .pipe(concat("script.js"))
    .pipe(
      babel({
        presets: ["@babel/env"]
      })
    )
    .pipe(minify())
    .pipe(gulp.dest("./js"));
});
