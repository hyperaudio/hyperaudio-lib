/* Player
 *
 */

var Player = (function(window, document, hyperaudio, Popcorn) {

	function Player(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			media: {
				youtube: '', // The URL of the Youtube video.
				mp4: '', // The URL of the mp4 video.
				webm:'' // The URL of the webm video.
			},

			// Types valid in a video element
			mediaType: {
				mp4: 'video/mp4', // The mp4 mime type.
				webm:'video/webm' // The webm mime type.
			},

			guiNative: false, // TMP during dev. Either we have a gui or we are chomeless.

			gui: false, // True to add a gui
			cssClass: 'hyperaudio-player', // Class added to the target for the GUI CSS. (should move to GUI)
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

		if(this.target) {
			this.create();
		}
	}

	Player.prototype = {
		create: function() {
			var self = this;

			if(this.target) {

				// The (effect of the) next line should probably be moved into the GUI.
				hyperaudio.addClass(this.target, this.options.cssClass);

				this.videoElem = document.createElement('video');
				this.videoElem.controls = this.options.guiNative; // TMP during dev. Either we have a gui or we are chomeless.

				// Add listeners to the video element
				this.videoElem.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						this.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the video
				// this.target.innerHTML = '';
				this.empty(this.target);
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
				while(this.videoElem.firstChild) {
					this.videoElem.removeChild(this.videoElem.firstChild);
				}

				// Setup to work with mp4 and webm property names. See options.
				hyperaudio.each(this.options.media, function(format, url) {
					// Only create known formats, so we can add other info to the media object.
					if(self.options.mediaType[format]) {
						var source = document.createElement('source');
						source.setAttribute('type', self.options.mediaType[format]);
						source.setAttribute('src', url); // Could use 'this' but less easy to read.
						self.videoElem.appendChild(source);
					}
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
		empty: function(el) {
			// Empties the element... Possibly better than el.innerHTML = '';
			while(el && el.firstChild) {
				el.removeChild(el.firstChild);
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
