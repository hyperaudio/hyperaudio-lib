module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		// https://github.com/felixge/node-dateformat
		dateFormat: 'dS mmmm yyyy HH:MM:ss',

		concat: {

			options: {
				banner: '/*! <%= pkg.name %> <%= grunt.template.today(dateFormat) %> */\n',
			},
			hyperaudio: {
				files: {
					'dist/<%= pkg.name %>.js': [
						'src/wrapper/top.js',
						'node_modules/dragdrop/dragdrop.js',
						'node_modules/wordselect/wordselect.js',
						'src/hyperaudio.js',
						'src/utilities/utilities.js',
						'src/wrapper/bot.js'
					]
				}
			}
		},

		uglify: {
			options: {
				// mangle: false,
				// compress: false,

				banner: '/*! <%= pkg.name %> <%= grunt.template.today(dateFormat) %> */\n',
				beautify: {
					max_line_len: 0 // Generates the output on a single line
				}
			},
			hyperaudio: {
				files: {
					'dist/<%= pkg.name %>.min.js': ['dist/<%= pkg.name %>.js']
				}
			}
		},

		jshint: {

			before: {
				files: {
					src: [
						'Gruntfile.js',
						'src/**/*.js'
					]
				}
			},
			after: {
				files: {
					src: [
						'dist/<%= pkg.name %>.js'
					]
				}
			},

			// configure JSHint (Documented at http://www/jshint.com/docs/)
			options: {
				// lots of other options...
				curly: true,
				eqeqeq: true,
				browser: true,
				globals: {
					jQuery: true
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.registerTask('default', ['jshint', 'concat', 'uglify']);

	grunt.registerTask('build', ['concat', 'uglify']);
	grunt.registerTask('test', ['jshint']);
};
