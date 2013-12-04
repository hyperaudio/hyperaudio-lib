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
			solutionClass: 'solution', // Class added to the solution that is active.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.videoElem = null;
		this.timeout = {};
		this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);

		this.youtube = false; // A flag to indicate if the YT player being used.

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

				this.wrapper = {
					html: document.createElement('div'),
					youtube: document.createElement('div')
				};
				hyperaudio.addClass(this.wrapper.html, this.options.cssClass + '-video-wrapper');
				hyperaudio.addClass(this.wrapper.youtube, this.options.cssClass + '-youtube-wrapper');

				this.solution = {
					html: document.createElement('video'),
					youtube: Popcorn.HTMLYouTubeVideoElement(this.wrapper.youtube)
				};

				// Default to a video element to start with
				this.videoElem = this.solution.html;
				this.youtube = false;
				this.updateSolution();

				this.solution.html.controls = this.options.guiNative; // TMP during dev. Either we have a gui or we are chomeless.

				// Add listeners to the video element
				this.solution.html.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						this.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the video
				this.empty(this.target);
				this.wrapper.html.appendChild(this.solution.html);
				// this.wrapper.youtube.appendChild(this.solution.youtube);
				this.target.appendChild(this.wrapper.html);
				this.target.appendChild(this.wrapper.youtube);

				if(this.options.gui) {
					this.GUI = new hyperaudio.PlayerGUI({
						player: this,

						navigation: true,		// next/prev buttons
						fullscreen: true		// fullscreen button
					});
				}

				if(this.options.media.youtube || this.options.media.mp4) { // Assumes we have the webm
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},

		mediaDiff: function(media) {
			var diff = false;
			if(media) {
				for(var format in this.options.media) {
					if(this.options.media[format] !== media[format]) {
						diff = true;
						break;
					}
				}
			} else {
				diff = true;
			}
			return diff;
		},

		updateSolution: function() {
			var wrapper = this.wrapper,
				cssClass = this.options.solutionClass;

			if(this.youtube) {
				hyperaudio.removeClass(wrapper.html, cssClass);
				hyperaudio.addClass(wrapper.youtube, cssClass);
			} else {
				hyperaudio.removeClass(wrapper.youtube, cssClass);
				hyperaudio.addClass(wrapper.html, cssClass);
			}
		},

		show: function() {
			this.updateSolution();
		},
		hide: function() {
			var wrapper = this.wrapper,
				cssClass = this.options.solutionClass;

			hyperaudio.removeClass(wrapper.html, cssClass);
			hyperaudio.removeClass(wrapper.youtube, cssClass);
		},

		load: function(media) {
			var self = this,
				newMedia = this.mediaDiff(media);

			if(media) {
				this.options.media = media;
			}

			if(this.target) {

				if(newMedia) {

					this.pause(); // Pause the player, otherwise switching solution may leave 1 playing while hidden.

					this.killPopcorn();

					console.log('media: %o', this.options.media);

					if(this.options.media.youtube) {
						// The YT element needs to be recreated while bugs in wrapper.
						this.empty(this.wrapper.youtube);
						this.solution.youtube = Popcorn.HTMLYouTubeVideoElement(this.wrapper.youtube);
						this.solution.youtube.src = this.options.media.youtube + '&html5=1';
						this.videoElem = this.solution.youtube;
						this.youtube = true;
						this.updateSolution();
					} else {

						this.empty(this.solution.html);

						// Setup to work with mp4 and webm property names. See options.
						hyperaudio.each(this.options.media, function(format, url) {
							// Only create known formats, so we can add other info to the media object.
							if(self.options.mediaType[format]) {
								var source = document.createElement('source');
								source.setAttribute('type', self.options.mediaType[format]);
								source.setAttribute('src', url); // Could use 'this' but less easy to read.
								self.solution.html.appendChild(source);
							}
						});

						this.solution.html.load();
						this.videoElem = this.solution.html;
						this.youtube = false;
						this.updateSolution();
					}

					this.initPopcorn();
				}
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
			if(this.youtube) {
				this.popcorn.play(time);
			} else {
				this.currentTime(time, true);
			}
		},
		pause: function(time) {
			if(this.youtube) {
				this.popcorn.pause(time);
			} else {
				this.videoElem.pause();
				this.currentTime(time);
			}
		},
		currentTime: function(time, play) {
			var self = this,
				media = this.videoElem;

			clearTimeout(this.timeout.currentTime);

			if(this.youtube) {
				this.popcorn.currentTime(time);
				return;
			}

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
