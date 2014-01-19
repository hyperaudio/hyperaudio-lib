/* Music
 * For playing background music
 */

var Music = (function(window, document, hyperaudio, Popcorn) {

	function Music(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'MUSIC', // Not really an option... More like a manifest

			target: '#music-player', // The selector of element where the audio is generated

			media: {
				mp3: '', // The URL of the mp3 audio.
				mp4: '', // The URL of the mp4 audio.
				ogg: '' // The URL of the ogg audio.
			},

			// Types valid in an audio element
			mediaType: {
				mp3: 'audio/mpeg', // The mp3 mime type.
				mp4: 'audio/mp4', // The mp4 mime type.
				ogg: 'audio/ogg' // The ogg mime type.
			},

			async: true // When true, some operations are delayed by a timeout.
		}, options);

		this.effect = {
			start: 0,
			duration: 6,
			volume: 1,
			fadeInDuration: 2,
			fadeOutDuration: 2,
			media: {}
		};

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.audioElem = null;
		this.timeout = {};
		this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);

		// List of the media types, used to check for changes in media.
		this.mediaTypes = "mp3 mp4 ogg";

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.target) {
			this.create();
		}
	}

	Music.prototype = {
		create: function() {
			var self = this;

			if(this.target) {

				this.audioElem = document.createElement('audio');

				// this.audioElem.controls = true; // TMP during dev.

				// Add listeners to the audio element
				this.audioElem.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						self.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the audio
				this.empty(this.target);
				this.target.appendChild(this.audioElem);

				var manager = function(event) {
					// Passing the event context to manager
					self.manager(this, event);
				};

				this.audioElem.addEventListener('progress', manager);
				this.audioElem.addEventListener('timeupdate', manager);
				this.audioElem.addEventListener('play', manager);
				this.audioElem.addEventListener('pause', manager);
				this.audioElem.addEventListener('ended', manager);

				if(this.options.media.mp3 || this.options.media.mp4) { // Assumes we have the ogg
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

					this.empty(this.audioElem);

					// Setup to work with mp3, mp4 and ogg property names. See options.
					hyperaudio.each(this.options.media, function(format, url) {
						// Only create known formats, so we can add other info to the media object.
						if(self.options.mediaType[format] && url) {
							var source = document.createElement('source');
							source.setAttribute('type', self.options.mediaType[format]);
							source.setAttribute('src', url);
							self.audioElem.appendChild(source);
						}
					});

					this.audioElem.load();

					this.initPopcorn();
				}
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		initPopcorn: function() {
			this.killPopcorn();
			this.popcorn = Popcorn(this.audioElem);
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
			this.audioElem.pause();
			this.currentTime(time);
		},
		currentTime: function(time, play) {
			var self = this,
				media = this.audioElem;

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
		},
		manager: function(audioElem, event) {
			var self = this;

			this.paused = audioElem.paused;

			if(!this.paused) {

				var end = this.effect.start + this.effect.duration;

				// The fade in/out code is WIP

				// Fade In TimeZone
				var fadeIn = {
					start: this.effect.start,
					end: this.effect.start + this.effect.fadeInDuration
				};

				// Fade Out TimeZone
				var fadeOut = {
					start: end - this.effect.fadeOutDuration,
					end: end
				};

				if(audioElem.currentTime > end) {
					this.pause();
				}
			}
		},
		bgmFX: function(effect) {
			hyperaudio.extend(this.effect, effect);
			this.load(this.effect.media);
			this.audioElem.volume = this.effect.volume;
			this.play(this.effect.start);
		}
	};

	return Music;
}(window, document, hyperaudio, Popcorn));
