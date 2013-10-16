/* Player
 *
 */

var Player = (function(document, hyperaudio, Popcorn) {

	function Player(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated
			src: '', // The URL of the video.

			gui: true, // True to add a gui, or flase for native controls.
			cssClassPrefix: 'ha-player-', // Prefix of the class added to the GUI created.
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
				this.videoElem.controls = !this.options.gui;
				// Will want to create some event listeners on the video... For errors and timeupdate in the least.
				this.target.innerHTML = '';
				this.target.appendChild(this.videoElem);
				if(this.options.gui) {
					this.addGUI();
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
					wrapper: document.createElement('div'),
					controls: document.createElement('div'),
					play: document.createElement('a'),
					pause: document.createElement('a')
				};

				// Add a class to each element
				hyperaudio.each(this.gui, function(name) {
					this.className = self.options.cssClassPrefix + name;
				});

				// Add listeners to controls
				this.gui.play.addEventListener('click', function(e) {
					e.preventDefault();
					self.gui.play.style.display = 'none';
					self.gui.pause.style.display = '';
					self.play();
				});
				this.gui.pause.addEventListener('click', function(e) {
					e.preventDefault();
					self.gui.play.style.display = '';
					self.gui.pause.style.display = 'none';
					self.pause();
				});

				// Add listeners to the video element
				this.videoElem.addEventListener('ended', function(e) {
					self.gui.play.style.display = '';
					self.gui.pause.style.display = 'none';
				});
/*
				this.videoElem.addEventListener('play', function(e) {
					self.gui.play.style.display = 'none';
					self.gui.pause.style.display = '';
				});
				this.videoElem.addEventListener('pause', function(e) {
					self.gui.play.style.display = '';
					self.gui.pause.style.display = 'none';
				});
*/

				// Hide the pause button
				this.gui.pause.style.display = 'none';

				// Build the GUI structure
				this.gui.wrapper.appendChild(this.gui.controls);
				this.gui.controls.appendChild(this.gui.play);
				this.gui.controls.appendChild(this.gui.pause);
				this.target.appendChild(this.gui.wrapper);
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
			if(typeof time === 'number') {
				this.videoElem.currentTime = time;
			}
			this.videoElem.play();
		},
		pause: function(time) {
			// Maybe should use the popcorn commands here
			if(typeof time === 'number') {
				this.videoElem.currentTime = time;
			}
			this.videoElem.pause();
		},
		currentTime: function(time) {
			// Maybe should use the popcorn commands here
			this.videoElem.currentTime = time;
		}
	};

	return Player;
}(document, hyperaudio, Popcorn));
