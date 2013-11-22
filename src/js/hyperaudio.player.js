/* Player
 *
 */

var Player = (function(window, document, hyperaudio, Popcorn) {

	function Player(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			media: {
				mp4: '', // The URL of the mp4 video.
				webm:'' // The URL of the webm video.
			},
			mediaType: {
				mp4: 'video/mp4', // The mp4 mime type.
				webm:'video/webm' // The webm mime type.
			},

			guiNative: false, // TMP during dev. Either we have a gui or we are chomeless.

			gui: false, // True to add a gui
			cssClassPrefix: 'hyperaudio-player-', // Prefix of the class added to the GUI created.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.videoElem = null;
		this.sourceElem = null;
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
/*
				this.sourceElem = {
					mp4: document.createElement('source'),
					webm: document.createElement('source')
				};
*/
				// Add listeners to the video element
				this.videoElem.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						this.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the video
				this.target.innerHTML = '';
				// this.videoElem.appendChild(this.sourceElem.mp4);
				// this.videoElem.appendChild(this.sourceElem.webm);
				this.target.appendChild(this.videoElem);

				if(this.options.gui) {
					this.GUI = new hyperaudio.PlayerGUI({
						player: this,

						navigation: true,		// next/prev buttons
						fullscreen: true		// fullscreen button
					});
				}

				if(this.options.media.mp4) { // Assumes we have the webm
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},

		load: function(media) {
			var self = this;
			if(media) {
				this.options.media = media;
			}
			if(this.videoElem && typeof this.options.media === 'object') {
				this.killPopcorn();

				// Remove any old source elements
				this.sourceElem = {};
				while(this.videoElem.firstChild) {
					this.videoElem.removeChild(this.videoElem.firstChild);
				}

				// Setup to work with mp4 and webm property names. See options.
				hyperaudio.each(this.options.media, function(format, url) {
					var source = self.sourceElem[format] = document.createElement('source');
					source.setAttribute('type', self.options.mediaType[format]);
					source.setAttribute('src', url); // Could use 'this' but less easy to read.
					self.videoElem.appendChild(source);
				});

				this.videoElem.load();

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
			this.currentTime(time, true);
		},
		pause: function(time) {
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
