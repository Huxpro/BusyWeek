module.exports = function (grunt) {

    // 配置 Grunt Modules 的参数
    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        // 本地 Server 
        connect: {
            server_src: {
              options: {
                port: 9000,
                hostname:'*',
                base: 'src',
                
                keepalive: true
              }
            },
            server_dist: {
              options: {
                port: 9000,
                hostname:'*',
                base: 'dist',
                keepalive: true
              }
            }
        },

        // 重置 dist 目录
        clean:{
            build: {
                src: 'dist/*'
            },
        },

        // 复制文件到 dist 目录
        copy: {
            build:{
                files:[
                    {   
                        expand: true,
                        cwd: 'src/',
                        src:[
                            "**/*",
                            "!js/*",
                            "!css/*"
                        ],
                        dest:'dist/'
                    }
                ]
            }
        },

        // SASS
        sass: {
            build: {
                files: [
                    {
                        expand: true,
                        cwd: 'src/',
                        src: ['**/style.scss'],
                        dest: 'src/',
                        ext: '.css'
                    }
                ]
            }
        },

        // 合并文件
        concat : {
            // css : {
            //     files: {
            //         'dist/css/<%= pkg.name %>.css': ['src/css/style.css']
            //     }
            // },
            // js : {
            //     src: ['src/**/*.js'],
            //     dest: 'src/js/<%= pkg.name %>.js'
            // }
        },

        // 压缩混淆 JS ，输出到 dist 目录
        uglify : {
            options : {
                banner : '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build : {
                files: [
                    {
                        expand: true,
                        cwd: 'src/',
                        src: ['**/*.js'],
                        dest: 'dist/',
                        ext: '.js'
                    }
                ]
            }
        },

        // 压缩 CSS， 输出到 dist 目录
        cssmin: {
            options : {
                banner : '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            main: {
                files: [
                    {
                        expand: true,
                        cwd: 'src/',
                        src: [
                            '**/style.css',
                        ],
                        dest: 'dist/',
                        ext: '.css'
                    }
                ]
            },
        }

    });


    // 从 node_modules 目录加载模块文件
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-cssmin');



    // 注册任务
    grunt.registerTask('server',['connect:server_src']);
    grunt.registerTask('preview',['connect:server_dist']);
    grunt.registerTask('build',[ 'clean','copy','sass','uglify','cssmin']);

};