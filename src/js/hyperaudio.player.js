/* Player
 *
 */

var Player = (function(window, document, hyperaudio, Popcorn) {

	function Player(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated
			src: '', // The URL of the video.

			guiNative: false, // TMP during dev. Either we have a gui or we are chomeless.

			gui: false, // True to add a gui
			cssClassPrefix: 'hyperaudio-player-', // Prefix of the class added to the GUI created.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.videoElem = null;
		this.timeout = {};
		this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);
		this.gui = null;

		if(this.options.DEBUG) {
			this._debug();
		}

		// Probably want a media object, instead of a single SRC

		if(this.target) {
			this.create();
		}
	}

	Player.prototype = {
		create: function() {
			var self = this;

			if(this.target) {
				this.videoElem = document.createElement('video');
				this.videoElem.controls = this.options.guiNative; // TMP during dev. Either we have a gui or we are chomeless.

				// Add listeners to the video element
				this.videoElem.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						this.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the video
				this.target.innerHTML = '';
				this.target.appendChild(this.videoElem);

				if(this.options.gui) {
					this.addGUI();
					this.addGUIListeners();
				}
				if(this.options.src) {
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addGUI: function() {
			var self = this;
			if(this.target) {
				this.gui = {
					container: this.target, // To add a class to the player target
					gui: document.createElement('div'),
					controls: document.createElement('div'),
					play: document.createElement('a'),
					pause: document.createElement('a')
				};

				// Add a class to each element
				hyperaudio.each(this.gui, function(name) {
					hyperaudio.addClass(this, self.options.cssClassPrefix + name);
				});

				// Add listeners to controls
				this.gui.play.addEventListener('click', function(e) {
					e.preventDefault();
					self.play();
				}, false);
				this.gui.pause.addEventListener('click', function(e) {
					e.preventDefault();
					self.pause();
				}, false);
/*
				// Add listeners to the video element
				this.videoElem.addEventListener('ended', function(e) {
					self.gui.play.style.display = '';
					self.gui.pause.style.display = 'none';
				}, false);
*/
				// Hide the pause button
				this.gui.pause.style.display = 'none';

				// Build the GUI structure
				this.gui.gui.appendChild(this.gui.controls);
				this.gui.controls.appendChild(this.gui.play);
				this.gui.controls.appendChild(this.gui.pause);
				this.target.appendChild(this.gui.gui);
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addGUIListeners: function() {
			var self = this;
			if(this.gui) {
				// Add listeners to the video element
				this.videoElem.addEventListener('ended', function(e) {
					self.gui.play.style.display = '';
					self.gui.pause.style.display = 'none';
				}, false);

			} else {
				this._error('GUI not used: gui = ' + this.options.gui);
			}
		},
		load: function(src) {
			var self = this;
			if(src) {
				this.options.src = src;
			}
			if(this.videoElem) {
				this.killPopcorn();
				this.videoElem.src = this.options.src;
				this.initPopcorn();
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		initPopcorn: function() {
			this.killPopcorn();
			this.popcorn = Popcorn(this.videoElem);
		},
		killPopcorn: function() {
			if(this.popcorn) {
				this.popcorn.destroy();
				delete this.popcorn;
			}
		},
		play: function(time) {
			if(this.gui) {
				this.gui.play.style.display = 'none';
				this.gui.pause.style.display = '';
			}
			this.currentTime(time, true);
		},
		pause: function(time) {
			if(this.gui) {
				this.gui.play.style.display = '';
				this.gui.pause.style.display = 'none';
			}
			this.videoElem.pause();
			this.currentTime(time);
		},
		currentTime: function(time, play) {
			var self = this,
				media = this.videoElem;

			clearTimeout(this.timeout.currentTime);

			if(typeof time === 'number' && !isNaN(time)) {

				// Attempt to play it, since iOS has been ignoring commands
				if(play && this.commandsIgnored) {
					media.play();
				}

				try {
					// !media.seekable is for old HTML5 browsers, like Firefox 3.6.
					// Checking seekable.length is important for iOS6 to work with currentTime changes immediately after changing media
					if(!media.seekable || typeof media.seekable === "object" && media.seekable.length > 0) {
						media.currentTime = time;
						if(play) {
							media.play();
						}
					} else {
						throw 1;
					}
				} catch(err) {
					this.timeout.currentTime = setTimeout(function() {
						self.currentTime(time, play);
					}, 250);
				}
			} else {
				if(play) {
					media.play();
				}
			}
		}
	};

	return Player;
}(window, document, hyperaudio, Popcorn));
