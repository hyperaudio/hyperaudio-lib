/* Projector
 * Used to play the staged productions
 */

var Projector = (function(window, document, hyperaudio, Popcorn) {

	function Projector(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PROJECTOR', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated
			src: '', // The URL of the video.

			tPadding: 1, // (Seconds) Time added to end word timings.

			players: 1, // Number of Players to use. Mobile: 1, Desktop: 2.

			gui: true, // True to add a gui.
			cssClassPrefix: 'hyperaudio-player-', // Prefix of the class added to the GUI created.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.videoElem = null;
		this.stage = null;
		this.timeout = {};
		this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);

		this.player = [];
		this.current = {};
		this.gui = null;

		// State Flags
		this.paused = true;

		if(this.options.DEBUG) {
			this._debug();
		}

		// Probably want a media object, instead of a single SRC

		if(this.target) {
			this.create();
		}
	}

	Projector.prototype = {
		setStage: function(stage) {
			this.stage = stage;
		},
		create: function() {
			var self = this;

			if(this.target) {

				// Making it work with a single player. Will dev 2 later.

				for(var i = 0; i < this.options.players; i++ ) {
					var player = document.createElement('div');
					this.player[i] = hyperaudio.Player({
						target: player
					});

					this.player[i].videoElem.addEventListener('timeupdate', function(event) {
						self.manager(event);
					}, false);

					this.target.appendChild(player);
				}

/*
				this.videoElem = document.createElement('video');
				this.videoElem.controls = !this.options.gui;

				// Add listeners to the video element
				this.videoElem.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						this.commandsIgnored = false;
					}
				}, false);
				this.videoElem.addEventListener('timeupdate', function(e) {
					self.manager(e);
				}, false);

				// Clear the target element and add the video
				this.target.innerHTML = '';
				this.target.appendChild(this.videoElem);
*/
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
		addGUI: Player.prototype.addGUI,
		load: function(src) {
			var self = this;
			if(src) {
				this.options.src = src;
			}

			if(this.player[0]) {
				this.player[0].load(this.options.src);
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
/*
			if(this.videoElem) {
				this.killPopcorn();
				this.videoElem.src = this.options.src;
				this.initPopcorn();
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
*/
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
		play: function() {

			// ATM, we always play fromm the start.

			if(this.stage && this.stage.target) {
				// Get the staged contents wrapper elem
				this.stageArticle = this.stage.target.getElementsByTagName('article')[0];

				// Get the sections
				this.current.sections = this.stageArticle.getElementsByTagName('section');
				this.current.index = 0;

				// Get the first section
				this.current.section = this.current.sections[this.current.index];

				// Get the ID (the src for now)
				this.current.src = this.current.section.getAttribute('data-id');

				var words = this.current.section.getElementsByTagName('a');
				this.current.start = words[0].getAttribute('data-m') * 0.001;
				this.current.end = words[words.length-1].getAttribute('data-m') * 0.001;

				this.paused = false;

				this.load(this.current.src);
				this._play(this.current.start);

			} else {
				this.paused = true;
			}
			console.log('this.current: %o', this.current);
		},
		pause: function() {
			this.paused = true;
			this._pause();
		},
		_play: function(time) {
			if(this.gui) {
				this.gui.play.style.display = 'none';
				this.gui.pause.style.display = '';
			}
			// this.currentTime(time, true);
			this.player[0].play(time);
		},
		_pause: function(time) {
			if(this.gui) {
				this.gui.play.style.display = '';
				this.gui.pause.style.display = 'none';
			}
			// this.videoElem.pause();
			// this.currentTime(time);
			this.player[0].pause(time);
		},
		currentTime: function(time, play) {

			this.player[0].currentTime(time, play);


/*
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
*/
		},
		manager: function(event) {
			var self = this;

			if(!this.paused) {
				// if(this.videoElem.currentTime > this.current.end + this.options.tPadding) {
				if(this.player[0].videoElem.currentTime > this.current.end + this.options.tPadding) {
					// Goto the next section
					this.current.index++;
					this.current.section = this.current.sections[this.current.index];
					if(this.current.section) {
						// duplication here with the play() method... Refactor

						// Get the ID (the src for now)
						this.current.src = this.current.section.getAttribute('data-id');

						var words = this.current.section.getElementsByTagName('a');
						this.current.start = words[0].getAttribute('data-m') * 0.001;
						this.current.end = words[words.length-1].getAttribute('data-m') * 0.001;

						this.paused = false; // redundant here

						this.load(this.current.src);
						this._play(this.current.start);

					} else {
						this.paused = true;
						this._pause();
					}
				}
			}
		}
	};

	return Projector;
}(window, document, hyperaudio, Popcorn));
