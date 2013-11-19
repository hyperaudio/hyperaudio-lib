/* Player - YouTube
 *
 */

// Bit of a (huge) hack for the time being to prove concept.

var Youtube = (function(window, document, hyperaudio, Popcorn) {

	function Youtube(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			media: {
				// youtube: 'http://www.youtube.com/watch?v=etaCHoeJXCI', // TMP - Youtube URL
				youtube: '', // The URL of the Youtube video.
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
		// this.sourceElem = null;
		// this.timeout = {};
		// this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);
		// this.gui = null;

		if(this.options.DEBUG) {
			this._debug();
		}

		// Probably want a media object, instead of a single SRC

		if(this.target) {
			this.create();
		}
	}

	Youtube.prototype = {
		create: function() {
			var self = this;

			if(this.target) {
				this.videoElem = Popcorn.HTMLYouTubeVideoElement(this.target);
				// this.popcorn = Popcorn(this.videoElem);
				this.initPopcorn();
				if(this.options.media.youtube) {
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addGUI: function() {
			// Nada
		},
		load: function(media) {
			var self = this;
			if(media && media.youtube) { // TMP hack (2nd clause)
				this.options.media = media;
			}
			if(this.popcorn) {
				// this.popcorn.media.src = this.options.media.youtube; //  + '&html5=1';
				this.videoElem.src = this.options.media.youtube; //  + '&html5=1';
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
			if(this.popcorn) {
				this.popcorn.play(time);
			}
		},
		pause: function(time) {
			if(this.popcorn) {
				this.popcorn.pause(time);
			}
		},
		currentTime: function(time, play) {
			if(this.popcorn) {
				this.popcorn.currentTime(time);
			}
		}
	};

	return Youtube;
}(window, document, hyperaudio, Popcorn));
