#!/usr/bin/env node

var pkg = require('./package.json');
var fs = require('fs');
var hint = require('jshint').JSHINT;
var uglify = require('uglify-js');

var banner = '/*! ' + pkg.name + ' v' + pkg.version + ' ~ (c) 2012-' + (new Date().getFullYear()) + ' ' + pkg.author + ' */\n';

var files = [
		'src/wrapper/top.js',
		'node_modules/dragdrop/dragdrop.js',
		'node_modules/wordselect/wordselect.js',
		'src/hyperaudio.js',
		'src/utilities/utilities.js',
		'src/wrapper/bot.js'
	];

var args = process.argv.slice(2);

build();

function build () {
	var out = '';
	var value = '';

	// Concatenate files
	out = banner + files.map(function (filePath) {
				return fs.readFileSync(filePath, 'utf8');
			}).join('');

	// Update version
	out = out.replace(/\/\* VERSION \*\//g, pkg.version);

	// Write build file
	var buildFile = './build/' + pkg.name + '.js';
	fs.writeFileSync(buildFile, out);

	// JSHint
	if ( !hint(out) ) {
		var lines = out.split('\n');
		hint.errors.forEach(function (err) {
			console.log('\033[31m[' + err.code + ']\033[0m ' + err.line + ':' + err.character + '\t- ' + err.reason);
			console.log('\033[33m' + lines[err.line-1].replace(/\t/g, ' ') + '\033[0m\n');
		});

		process.exit();
	}

	// Write dist file
	var distFile = buildFile.replace('/build/', '/dist/').replace('.js', '.min.js');
	out = uglify.minify(out, { fromString: true });
	fs.writeFileSync(distFile, banner + out.code);
}
