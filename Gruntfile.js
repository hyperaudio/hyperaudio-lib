module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		// https://github.com/felixge/node-dateformat
		dateFormat: 'dS mmmm yyyy HH:MM:ss',
		stdBanner: '/*! <%= pkg.name %> v<%= pkg.version %> ~ (c) 2012-<%= grunt.template.today("yyyy") %> <%= pkg.author %> <%= pkg.license %> ~ Built: <%= grunt.template.today(dateFormat) %> */\n',

		concat: {

			options: {
				banner: '<%= stdBanner %>',
				separator: '\n\n'
			},
			hyperaudio: {
				files: {
					'build/<%= pkg.name %>.js': [

						// The Popcorn lib and plugins
						'lib/popcorn.js',
						'lib/popcorn._MediaElementProto.js',
						'lib/popcorn.HTMLYouTubeVideoElement.js',
						'src/js/popcorn.transcript.js',

						// Top closure wrapper
						'src/js/wrapper/top.js',
						// The Hyperaudio Lib Core
						'src/js/hyperaudio.core.js',

						// Utilities used by the Hyperaudio Lib
						'src/js/utility.dragdrop.js',
						'src/js/utility.editblock.js',
						'src/js/utility.fadeFX.js',
						'src/js/utility.sidemenu.js',
						'src/js/utility.tap.js',
						'src/js/utility.titleFX.js',
						'src/js/utility.wordselect.js',
						'src/js/utility.xhr.js',
						'src/js/utility.api.js', // After xhr

						// Modules that form the Hyperaudio Lib
						'src/js/hyperaudio.music.js',
						'src/js/hyperaudio.player.js',
						'src/js/hyperaudio.player.gui.js',
						'src/js/hyperaudio.transcript.js',
						'src/js/hyperaudio.stage.js',
						'src/js/hyperaudio.projector.js', // Must be after Player module

						// Mapping objects onto the Hyperaudio Lib
						'src/js/mapping/hyperaudio.js',
						'src/js/mapping/utilities.js',
						// Bottom closure wrapper
						'src/js/wrapper/bot.js'
					]
				}
			}
		},

		uglify: {
			options: {
				// mangle: false,
				// compress: false,

				banner: '<%= stdBanner %>',
				beautify: {
					max_line_len: 0 // Generates the output on a single line
				}
			},
			hyperaudio: {
				files: {
					'dist/<%= pkg.name %>.min.js': ['build/<%= pkg.name %>.js']
				}
			}
		},

		jshint: {

			before: {
				files: {
					src: [
						'Gruntfile.js',
						// 'lib/*.js',
						'src/js/*.js'
					]
				}
			},
			after: {
				files: {
					src: [
						'build/<%= pkg.name %>.js'
					]
				}
			},

			// configure JSHint (Documented at http://www/jshint.com/docs/)
			options: {
				// Using the jshint defaults

				// For the jQuery code for extend.
				eqnull: true,

				// Prevent leaky vars
				// undef: true,  // Turn that on later since lots of errors!
				browser: true,

				globals: {
					hyperaudio: true
				}

/*
				// lots of other options...
				curly: true,
				eqeqeq: true,
				browser: true,
				globals: {
					jQuery: true
				}
*/
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.registerTask('default', ['jshint:before', 'concat', 'uglify', 'jshint:after']);

	grunt.registerTask('build', ['concat', 'uglify']);
	grunt.registerTask('test', ['jshint:before']);
};
