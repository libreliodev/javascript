/* jshint node: true */
module.exports = function (grunt) {
    "use strict";
    var dist_dir = 'dist',
    admin_dist_dir = dist_dir + '/admin',
    admin_assets_dist_dir = admin_dist_dir + '/assets',
    site_dist_dir = dist_dir + '/www',
    site_assets_dist_dir = site_dist_dir + '/assets',
    reader_dist_dir = dist_dir + '/reader',
    reader_assets_dist_dir = reader_dist_dir + '/assets';
    
    var src_dir = 'src',
    shared_assets = src_dir + '/assets',
    reader_assets_src_dir = src_dir + '/reader_assets',
    admin_assets_src_dir = src_dir + '/admin_assets';
  
    // Project configuration.
    grunt.initConfig({
        // Metadata
        pkg: grunt.file.readJSON('package.json'),
        banner: '/**\n' +
            '* Metis - <%=pkg.name %> v<%= pkg.version %>\n' +
            '* Author : <%= pkg.author.name %> \n' +
            '* Copyright <%= grunt.template.today("yyyy") %>\n' +
            '* Licensed under <%= pkg.licenses %>\n' +
            '*/\n',
        clean: {dist: ['dist']},
        less: {
            options: {
		banner: '<%= banner %>',
                metadata: 'src/*.{json,yml}',
// 		sourceMap: true,
//              sourceMapFilename: "dist/admin/assets/css/style.css.map",
//              sourceMapURL: 'style.css.map',
                paths: 'bower_components/bootstrap/less',
                imports: {
                    reference: ['mixins.less', 'variables.less']
                }
            },
            development: {
                files: [
                    {
                        src: [admin_assets_src_dir + '/less/style.less'],
                        dest: admin_assets_dist_dir + '/css/main.css'
                    },
                    {
                        expand: true,
                        cwd: admin_assets_src_dir + '/less/pages',
                        src: ['*.less'],
                        dest: admin_assets_dist_dir + '/css/pages/',
                        ext: '.css'
                    },
                    {
                        src: [reader_assets_src_dir + '/less/main.less'],
                        dest: reader_assets_dist_dir + '/css/main.css'
                    }
                ]
            },
            production: {
                options: {
                    compress: true
                },
                files: [
                    {
                        src: [admin_assets_src_dir + '/less/style.less'],
                        dest: admin_assets_dist_dir + '/css/main.min.css'
                    },
                    {
                        expand: true,
                        cwd: admin_assets_src_dir + '/less/pages',
                        src: ['*.less'],
                        dest: admin_assets_dist_dir + '/css/pages/',
                        ext: '.min.css'
                    },
                    {
                        src: [reader_assets_src_dir + '/less/main.less'],
                        dest: reader_assets_dist_dir + '/css/main.min.css'
                    }
                ]
            }
        },
        concat: {
            options: {
                banner: '<%= banner %>',
                stripBanners: false
            },
            main: {
                src: [admin_assets_src_dir + '/js/app/*.js', admin_assets_src_dir + '/js/initS3Auth.js'],
                dest: admin_assets_dist_dir + '/js/main.js'
            }
        },
        uglify: {
            options: {
                banner: '<%= banner %>'
            },
            main: {
                src: ['<%= concat.main.dest %>'],
                dest: admin_assets_dist_dir + '/js/main.min.js'
            },
            setupPage: {
                src: admin_assets_src_dir + '/js/pages/*.js',
                dest: admin_assets_dist_dir + '/js/pages/',
                expand: true,    // allow dynamic building
                flatten: true,   // remove all unnecessary nesting
                ext: '.min.js'   // replace .js to .min.js
            },
            readerJSDir: {
                src: reader_assets_src_dir + '/js/*.js',
                dest: reader_assets_dist_dir + '/js/',
                expand: true,    // allow dynamic building
                flatten: true,   // remove all unnecessary nesting
                ext: '.min.js'   // replace .js to .min.js
            }
        },
        jshint: {
            options: {
                jshintrc: admin_assets_src_dir + '/js/.jshintrc'
            },
            main: {
                src: [admin_assets_src_dir + '/js/*.js', admin_assets_src_dir + '/app/*.js', 
                      admin_assets_src_dir + '/pages/*.js']
            },
            reader: {
                src: [reader_assets_src_dir + '/js/*.js']
            }
        },
        assemble: {
            // Task-level options
            options: {
                flatten: true,
                postprocess: require('pretty'),
                assets: admin_assets_dist_dir,
                data: 'src/data/*.{json,yml}',
                partials: ['src/templates/partials/**/*.hbs'],
                helpers: 'src/helper/**/*.js',
                layoutdir: 'src/templates/layouts'
            },
            // Reader
            reader: {
                // Target-level options
                options: {
                    layout: 'reader_default.hbs',
                    assets: reader_assets_dist_dir
                },
                files: [
                    {expand: true, cwd: 'src/templates/reader', src: ['*.hbs'], dest: reader_dist_dir}
                ]
            },
            // site librelio.com
            site: {
                // Target-level options
                options: {
                    layout: 'site_default.hbs',
                    assets: site_assets_dist_dir
                },
                files: [
                    {expand: true, cwd: 'src/templates/site', src: ['*.hbs'], dest: site_dist_dir}
                ]
            },
            pages: {
                // Target-level options
                options: {
                    layout: 'default.hbs'
                },
                files: [
                    {expand: true, cwd: 'src/templates/pages', src: ['*.hbs'], dest: admin_dist_dir}
                ]
            },
            login: {
                options: {
                    layout: 'login.hbs'
                },
                files: [
                    {expand: true, cwd: 'src/templates/login', src: ['login.hbs'], dest: admin_dist_dir}
                ]
            },
            svg_editor: {
                files: [
                    {expand: true, cwd: 'src/templates/svgedit', src: ['svgedit.hbs'], dest: admin_dist_dir}
                ]
            },
            errors: {
                options: {
                    layout: 'errors.hbs'
                },
                files: [
                    {expand: true, cwd: 'src/templates/errors', src: ['*.hbs'], dest: admin_dist_dir}
                ]
            },
            countdown: {
                options: {
                    layout: 'countdown.hbs'
                },
                files: [
                    {expand: true, cwd: 'src/templates/countdown', src: ['*.hbs'], dest: admin_dist_dir}
                ]
            }
        },
        copy: {
            main: {
                files: [
                  /* copy shared assets to all apps */
                    {
                        expand: true,
                        cwd: shared_assets, src: ['lib/**','img/**','js/**'],
                        dest: admin_assets_dist_dir + '/'
                    },
                    {
                        expand: true,
                        cwd: shared_assets, src: ['lib/**','img/**','js/**'],
                        dest: site_assets_dist_dir + '/'
                    },
                    {
                        expand: true,
                        cwd: shared_assets, src: ['lib/**','img/**','js/**'],
                        dest: reader_assets_dist_dir + '/'
                    },
                    {
                        expand: true,
                        cwd: admin_assets_src_dir + '/css',
                        src: ['./**/*.*'],
                        dest: admin_assets_dist_dir + '/css'
                    },
                    {
                        expand: true,
                        cwd: admin_assets_src_dir + '/js',
                        src: ['./*.js', './pages/*.js'],
                        dest: admin_assets_dist_dir + '/js'
                    },
                    {
                        expand: true,
                        cwd: admin_assets_src_dir + '/lib',
                        src: ['./**/*', './*.*','./*/*.*','./*/css/*.*','./*/img/*.*','./*/js/**/*.*','./datatables/**/*.*',],
                        dest: admin_assets_dist_dir + '/lib'
                    },
                    {
                        expand: true,
                        cwd: admin_assets_src_dir + '/img',
                        src: ['./**/*.*'],
                        dest: admin_assets_dist_dir + '/img'
                    },
                    {
                        expand: true,
                        cwd: admin_assets_src_dir + '/submodule',
                        src: ['./*/*.*','./*/css/*.*','./*/build/css/bootstrap3/*.*','./*/js/*.*','./*/src/js/*.*','./*/build/js/*.*','./*/reader/**/*.*','./*/themes/**'],
                        filter: 'isFile',
                        dest: admin_assets_dist_dir + '/lib'
                    },
                    {
                        expand: true,
                        cwd: 'src/ember',
                        src: ['*.html'],
                        dest: admin_dist_dir
                    },
                    {
                        expand: true,
                        cwd: 'node_modules/assemble-less/node_modules/less/dist/',
                        src: ['less-1.6.3.min.js'],
                        dest: admin_assets_dist_dir + '/lib'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/jquery/',
                        src: ['./jquery*.js'],
                        dest: admin_assets_dist_dir + '/lib'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/d3',
                        src: ['d3.min.js'],
                        dest: admin_assets_dist_dir + '/lib'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/bootstrap/dist/',
                        src: ['./**/*.*'],
                        dest: admin_assets_dist_dir + '/lib/bootstrap'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/font-awesome/',
                        src: ['./css/*.*', './fonts/*.*'],
                        dest: admin_assets_dist_dir + '/lib/Font-Awesome'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/gmaps/',
                        src: ['./**/gmaps.js'],
                        dest: admin_assets_dist_dir + '/lib/gmaps'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/html5shiv/dist',
                        src: ['./html5shiv.js'],
                        dest: admin_assets_dist_dir + '/lib/html5shiv',
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/respond/dest',
                        src: ['./respond.min.js'],
                        dest: admin_assets_dist_dir + '/lib/respond'
                    },
		            {
                        expand: true,
                        cwd: admin_assets_src_dir + '/less',
                        src: ['./**/theme.less'],
                        dest: admin_assets_dist_dir + '/less'
                    },
		            {
		                expand: true,
		                cwd: 'node_modules/epiceditor/epiceditor',
		                src: ['./**/*.*'],
		                dest: admin_assets_dist_dir + '/lib/epiceditor'
		            },
                    {
                       expand: true,
                     cwd: 'node_modules/screenfull/dist/',
                     src: ['./**/*.*'],
                     dest: admin_assets_dist_dir + '/lib/screenfull/'
                    },
                    // formbuilder
                    { expand:true, cwd:'bower_components/jquery-ui/ui/minified',
                      src: [ "jquery.ui.core.min.js", "jquery.ui.widget.min.js",
                             "jquery.ui.mouse.min.js", 
                             "jquery.ui.draggable.min.js",
                             "jquery.ui.droppable.min.js", 
                             "jquery.ui.sortable.min.js" ],
                      dest: admin_assets_dist_dir + '/lib/' },
                    { src: 'bower_components/backbone-deep-model/distribution/deep-model.min.js',
                      dest: admin_assets_dist_dir + '/lib/backbone/deep-model.min.js' },
                    { src: 'bower_components/backbone/backbone.js',
                      dest: admin_assets_dist_dir + '/lib/backbone/backbone.js' },
                    { src: 'bower_components/rivets/dist/rivets.min.js',
                      dest: admin_assets_dist_dir + '/lib/rivets.min.js' },
                    { src: 'bower_components/jquery.scrollWindowTo/index.js',
                      dest: admin_assets_dist_dir + '/lib/jquery.scrollWindowTo.js' },
                    { src: 'bower_components/underscore/underscore-min.js',
                      dest: admin_assets_dist_dir + '/lib/underscore-min.js' },
                    { src: 'bower_components/underscore.mixin.deepExtend/index.js',
                      dest: admin_assets_dist_dir + '/lib/underscore.mixin.deepExtend.js' },
                    { expand: true, cwd: 'bower_components/formbuilder/dist/',
                      src: 'formbuilder-min.*', 
                      dest: admin_assets_dist_dir + '/lib/formbuilder/'
                    },
                    /* handsontable */
                    {
                        expand: true,
                        cwd: 'bower_components/handsontable/dist/',
                        src: [ './jquery.handsontable.full.css', 
                               './jquery.handsontable.full.js' ],
                        dest: admin_assets_dist_dir + '/lib/handsontable/'
                    },
                    /* pdfviewer dependencies */
                    {
                        expand: true,
                        cwd: 'bower_components/path/',
                        src: 'path*.js',
                        dest: admin_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/querystring/',
                        src: 'querystring*.js',
                        dest: admin_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/tweenjs/build',
                        src: 'tween.min.js',
                        dest: admin_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/tweenjs/examples/js/',
                        src: 'RequestAnimationFrame.js',
                        dest: admin_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/videojs/dist/',
                        src: 'video-js/**',
                        dest: admin_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/js-url/',
                        src: 'url.min.js',
                        dest: admin_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/flexslider/',
                        src: ['flexslider.css', 'jquery.flexslider-min.js',
                              'fonts/*'],
                        dest: admin_assets_dist_dir + '/lib/flexslider/'
                    },
                    /* sprintf */
                    {
                        expand: true,
                        cwd: 'bower_components/sprintf/dist/',
                        src: 'sprintf.min.js',
                        dest: admin_assets_dist_dir + '/lib/'
                        
                    },
                    /* copy site assets */
                    {
                        expand: true,
                        cwd: 'bower_components/html5shiv/dist',
                        src: ['./html5shiv.js'],
                        dest: site_assets_dist_dir + '/lib/html5shiv'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/respond/dest',
                        src: ['./respond.min.js'],
                        dest: site_assets_dist_dir + '/lib/respond'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/font-awesome/fonts/',
                        src: ['*'],
                        dest: site_assets_dist_dir + '/fonts'
                    },
                    {
                        expand: true,
                        cwd: 'src/site_assets/css',
                        src: ['*.css'],
                        dest: site_assets_dist_dir + '/css'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/jquery/',
                        src: ['./jquery*.js'],
                        dest: site_assets_dist_dir + '/lib'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/bootstrap/dist/',
                        src: ['./**/*.*'],
                        dest: site_assets_dist_dir + '/lib/bootstrap'
                    },
                    {
                        expand: true,
                        cwd: 'src/site_assets/lib',
                        src: ['./**/*'],
                        dest: site_assets_dist_dir + '/lib'
                    },
                    {
                        expand:  true,
                        cwd: 'src/site_assets/js',
                        src: ['*.js'],
                        dest: site_assets_dist_dir + '/js'
                    },
                    {
                        expand: true,
                        cwd: 'src/site_assets/img',
                        src: ['./**/*.*'],
                        dest: site_assets_dist_dir + '/img'
                    },
                  /* copy reader assets */
                    {
                        expand: true,
                        cwd: 'bower_components/html5shiv/dist',
                        src: ['./html5shiv.js'],
                        dest: reader_assets_dist_dir + '/lib/html5shiv'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/respond/dest',
                        src: ['./respond.min.js'],
                        dest: reader_assets_dist_dir + '/lib/respond'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/jquery/',
                        src: ['./jquery*.js'],
                        dest: reader_assets_dist_dir + '/lib'
                    },
                    {
                        expand: true,
                        cwd: 'src/reader_assets/lib',
                        src: ['./**/*'],
                        dest: reader_assets_dist_dir + '/lib'
                    },
                    {
                        expand: true,
                        cwd: 'src/reader_assets/img',
                        src: ['./**/*'],
                        dest: reader_assets_dist_dir + '/img'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/bootstrap/dist/',
                        src: ['./**/*.*'],
                        dest: reader_assets_dist_dir + '/lib/bootstrap'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/font-awesome/',
                        src: ['./css/*.*', './fonts/*.*'],
                        dest: reader_assets_dist_dir + '/lib/Font-Awesome'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/async/lib',
                        src: 'async.js',
                        dest: reader_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/path/',
                        src: 'path*.js',
                        dest: reader_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/querystring/',
                        src: 'querystring*.js',
                        dest: reader_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'src/templates/reader',
                        src: './application_.json',
                        dest: reader_dist_dir + '/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/tweenjs/build',
                        src: 'tween.min.js',
                        dest: reader_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/tweenjs/examples/js/',
                        src: 'RequestAnimationFrame.js',
                        dest: reader_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/videojs/dist/',
                        src: 'video-js/**',
                        dest: reader_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/js-url/',
                        src: 'url.min.js',
                        dest: reader_assets_dist_dir + '/lib/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/flexslider/',
                        src: ['flexslider.css', 'jquery.flexslider-min.js',
                              'fonts/*'],
                        dest: reader_assets_dist_dir + '/lib/flexslider/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/fingerprint/',
                        src: 'fingerprint.js',
                        dest: reader_assets_dist_dir + '/lib/'
                        
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/sprintf/dist/',
                        src: 'sprintf.min.js',
                        dest: reader_assets_dist_dir + '/lib/'
                        
                    },
                    {
                        expand: true,
                        cwd: reader_assets_src_dir + '/js',
                        src: ['*.js'],
                        dest: reader_assets_dist_dir + '/js/'
                    },
                  
                ]
            }
        },

        watch: {
            scripts: {
                files: ['**/*.js'],
                tasks: ['dist-js']
            },
            css: {
                files: ['**/*.css'],
                tasks: ['copy']
            },
            assemble: {
                files: ['**/*.hbs', '**/*.html'],
                tasks: ['assemble']
            },
            js: {
                files: 'js/*.js',
                tasks: [ 'uglify' ]
            }
        }

    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    //grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('assemble-less');


    //grunt.loadNpmTasks('grunt-recess');
    // remove grunt-recess modules. because not supported my code

    grunt.loadNpmTasks('assemble');

    // Test task.
    //grunt.registerTask('test', ['jshint', 'qunit']);

    // JS distribution task.
    grunt.registerTask('dist-js', ['concat', 'jshint', 'uglify']);


    grunt.registerTask('compile-lang', 'Compiles all languages into json format',
                       function()
      {
        var done = this.async(),
        path = require('path'),
        dest_to = {
          reader: reader_assets_dist_dir + '/lang',
          admin: admin_assets_dist_dir + '/lang'
        },
        qlen = 0, qdone = 0;
        grunt.file.recurse(src_dir + '/language/', 
                           function(abspath, rootdir, subdir, filename)
          {
            if(path.extname(filename) == '.po')
            {
              qlen++;
              var basename = path.basename(filename, '.po'),
              dest = dest_to[basename];
              if(!dest)
                return;
              var copy_paths, dest_path;
              if(typeof dest != 'string')
              {
                copy_paths = dest.slice(1);
                dest_path = dest[0];
              }
              else
               dest_path = dest;
              grunt.file.mkdir(dest_path);
              console.log('Converting ' + abspath);
              po2json(rootdir, subdir, filename, dest_path, function(err)
                {
                  if(err)
                  {
                    console.log("Couldn't convert po file " + abspath);
                    throw err;
                    process.exit(1);
                    return;
                  }
                  if(copy_paths)
                    for(var c = 0, l = copy_paths.length; c < l; ++c)
                    {
                      var s = path.join(copy_paths[i], subdir);
                      grunt.file.mkdir(path.dirname(s));
                      grunt.file.copy(dest_path, s);
                    }
                  if(++qdone == qlen)
                    done();
                });
            }
          });
        function po2json(rootdir, subdir, filename, dest, cb)
        {
          var spawn = require('child_process').spawn,
          fs = require('fs'),
          dest_fn = path.basename(filename, '.po') + '.json',
          src = path.join(rootdir, subdir, filename),
          cur_dest_path = path.join(rootdir, subdir, dest_fn),
          po2json_p = spawn('./build/lptools/po2json.py', [ src ]),
          stdout_data = '';
          
          po2json_p.stdout.on('data', function(data)
            {
              stdout_data += data;
            });
          po2json_p.on('close', function(code)
            {
              if(code == 0)
                fs.rename(cur_dest_path, path.join(dest, subdir + '.json'), cb);
              else
                cb(new Error(stdout_data));
            });
          po2json_p.on('error', cb);
        }
      });
    
    // Full distribution task.
    grunt.registerTask('dist', ['clean', 'copy', 'less', 'dist-js']);


    // Default task.
    //grunt.registerTask('default', ['test', 'dist']);

    grunt.registerTask('default', ['dist', 'assemble', 'compile-lang']);

};
