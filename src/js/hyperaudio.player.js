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

			gui: false, // True to add a gui, or Object to pass GUI options.
			cssClass: 'hyperaudio-player', // Class added to the target for the GUI CSS. (passed to GUI and Projector)
			solutionClass: 'solution', // Class added to the solution that is active.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.videoElem = null;
		this.timeout = {};
		this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);

		// List of the media types, used to check for changes in media.
		this.mediaTypes = "youtube mp4 webm";

		this.youtube = false; // A flag to indicate if the YT player being used.

		// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
		this.ytFix = [];

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
						self.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the video
				this.empty(this.target);
				this.wrapper.html.appendChild(this.solution.html);
				// this.wrapper.youtube.appendChild(this.solution.youtube);
				this.target.appendChild(this.wrapper.html);
				this.target.appendChild(this.wrapper.youtube);

				if(this.options.gui) {

					var guiOptions = {
						player: this,

						navigation: false,		// next/prev buttons
						fullscreen: false,		// fullscreen button

						cssClass: this.options.cssClass // Pass in the option, so only have to define it in this class
					};

					if(typeof this.options.gui === 'object') {
						hyperaudio.extend(guiOptions, this.options.gui);
					}

					this.GUI = new hyperaudio.PlayerGUI(guiOptions);

					var handler = function(event) {
						var video = self.videoElem;
						self.GUI.setStatus({
							paused: video.paused,
							currentTime: video.currentTime,
							duration: video.duration
						});
					};

					this.addEventListener('progress', handler); // Important for YT player GUI to update on set/change
					this.addEventListener('timeupdate', handler);
					this.addEventListener('play', handler);
					this.addEventListener('pause', handler);
					this.addEventListener('ended', handler);
				}

				if(this.options.media.youtube || this.options.media.mp4) { // Assumes we have the webm
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},

		mediaDiff: function(media) {
			var self = this,
				diff = false;
			if(media) {
				hyperaudio.each(this.mediaTypes.split(/\s+/g), function() {
					if(self.options.media[this] !== media[this]) {
						diff = true;
						return false; // exit each
					}
				});
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

					// console.log('media: %o', this.options.media);

					if(this.options.media.youtube) {
						// The YT element needs to be recreated while bugs in wrapper.
						this.empty(this.wrapper.youtube);
						this.solution.youtube = Popcorn.HTMLYouTubeVideoElement(this.wrapper.youtube);
						this.solution.youtube.src = this.options.media.youtube + '&html5=1';
						this.videoElem = this.solution.youtube;
						this.youtube = true;
						this.updateSolution();

						// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
						this._ytFixListeners();
					} else {

						this.empty(this.solution.html);

						// Setup to work with mp4 and webm property names. See options.
						hyperaudio.each(this.options.media, function(format, url) {
							// Only create known formats, so we can add other info to the media object.
							if(self.options.mediaType[format] && url) {
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
		gui_play: function(time) {
			this._trigger(hyperaudio.event.userplay, {msg: 'User clicked play'});
			this.play(time);
		},
		gui_pause: function(time) {
			this._trigger(hyperaudio.event.userpause, {msg: 'User clicked pause'});
			this.pause(time);
		},
		gui_currentTime: function(time, play) {
			this._trigger(hyperaudio.event.usercurrenttime, {msg: 'User clicked the progress bar'});
			this.currentTime(time, play);
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
		},
		addEventListener: function(type, handler) {
			var self = this,
				handlers;

			if(this.solution && typeof type === 'string' && typeof handler === 'function') {
				handlers = {
					html: function(event) {
						if(!self.youtube) {
							handler.call(this, event);
						}
					},
					youtube: function(event) {
						if(self.youtube) {
							// Bugged YT wrapper context.
							// Reported https://bugzilla.mozilla.org/show_bug.cgi?id=946293
							// handler.call(this, event); // Bugged
							// this and event.target point at the document
							// event.detail.target points at the youtube target element
							handler.call(self.solution.youtube, event);
						}
					}
				};
				this.solution.html.addEventListener(type, handlers.html, false);
				this.solution.youtube.addEventListener(type, handlers.youtube, false);

				// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
				this.ytFix.push({
					type: type,
					handler: handlers.youtube
				});
			}

			return handlers;
		},
		removeEventListener: function(type, handlers) {
			if(this.solution && typeof type === 'string' && typeof handlers === 'object') {
				this.solution.html.removeEventListener(type, handlers.html, false);
				this.solution.youtube.removeEventListener(type, handlers.youtube, false);

				// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
				for(var i=0, l=this.ytFix.length; i<l; i++) {
					if(this.ytFix[i].type === type && this.ytFix[i].handler === handlers.youtube) {
						this.ytFix.splice(i, 1);
					}
				}
			}
		},
		_ytFixListeners: function() {
			// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
			for(var i=0, l=this.ytFix.length; i<l; i++) {
				this.solution.youtube.addEventListener(this.ytFix[i].type, this.ytFix[i].handler, false);
			}
		}
	};

	return Player;
}(window, document, hyperaudio, Popcorn));
