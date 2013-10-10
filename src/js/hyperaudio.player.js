/* Player
 *
 */

var Player = (function($, document, Popcorn) {

	function Player(options) {

		this.options = $.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated
			src: '', // The URL of the video.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.videoElem = null;

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
				this.videoElem.controls = true;
				// Will want to create some event listeners on the video... For errors and timeupdate in the least.
				this.target.innerHTML = '';
				this.target.appendChild(this.videoElem);
				if(this.options.src) {
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
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
			// Maybe should use the popcorn commands here
			this.videoElem.currentTime = time;
			this.videoElem.play();
		},
		currentTime: function(time) {
			// Maybe should use the popcorn commands here
			this.videoElem.currentTime = time;
		}
	};

	return Player;
}(jQuery, document, Popcorn));
