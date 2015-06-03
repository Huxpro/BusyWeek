/**
 * Created by 黄玄 on 15/06/02.
 * 
 * Gulpfile 用于新版 requireJS 方案打包
 */

var gulp = require('gulp');
var path = require('path');
var childProcess = require('child_process');
var exec = childProcess.exec;

// node serve
gulp.task('serve', function() {
    exec(['sudo node server.js'].join(' '), function(error, stdout, stderr) {
        console.log(stdout);
    });
});

// compile scss
gulp.task('sass', function() {
    exec(['sass src/css/sass/style.scss src/css/style.css'].join(' '), function(error, stdout, stderr) {
        console.log('finish build sass');
    });
});

// build
gulp.task('build', ['sass'], function() {
    var build = 'node r.js -o build.js';
    
    exec(build, function callback(error, stdout, stderr){
        //console.log(stdout);
        console.log('finish build');
    });
});

// default
gulp.task('default', ['serve']);