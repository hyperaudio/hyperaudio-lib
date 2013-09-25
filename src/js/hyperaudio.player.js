/* Player
 *
 */

var Player = (function($, Popcorn) {

	function Player(options) {

		this.options = $.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated
			src: '', // The URL of the video.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		if(this.options.DEBUG) {
			this._debug();
		}

		// Probably want a media object, instead of a single SRC

		if(this.options.target) {
			this.create();
		}
	}

	Player.prototype = {
		create: function(target) {
			var self = this,
				$target;
			if(target) {
				this.options.target = target;
			}
			$target = $(this.options.target);
			if($target.length) {
				this.video = document.createElement('video');
				this.video.controls = true;
				// Will want to create some event listeners on the video... For errors and timeupdate in the least.
				$(this.options.target).empty().append(this.video);
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
			if(this.video) {
				this.killPopcorn();
				// this.initPopcorn();
				this.video.src = this.options.src;
				this.initPopcorn();
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		initPopcorn: function() {
			this.killPopcorn();
			// this.popcorn = Popcorn(this.options.target); // Wrong target!
			this.popcorn = Popcorn(this.video); // Wrong target!
		},
		killPopcorn: function() {
			if(this.popcorn) {
				this.popcorn.destroy();
				delete this.popcorn;
			}
		},
		play: function(time) {
			// Maybe should use the popcorn commands here
			this.video.currentTime = time;
			this.video.play();
		},
		currentTime: function(time) {
			// Maybe should use the popcorn commands here
			this.video.currentTime = time;
		}
	};

	return Player;
}(jQuery, Popcorn));
