/* Projector
 * Used to play the staged productions
 */

var Projector = (function(window, document, hyperaudio, Popcorn) {

	function Projector(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PROJECTOR', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			// media: {}, // The URL of the video.

			tPadding: 1, // (Seconds) Time added to end word timings.

			players: 1, // Number of Players to use. Mobile: 1, Desktop: 2.

			unit: 0.001, // Unit used if not given in section attr of stage.

			gui: true, // True to add a gui.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.stage = null;
		// this.timeout = {};

		this.player = [];
		this.media = [];
		this.current = {};

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

				var manager = function(event) {
					// Passing the event context to manager
					//  * The YouTube event object is useless.
					//  * The YouTube event context was fixed in the Player class.
					self.manager(this, event);
				};

				for(var i = 0; i < this.options.players; i++ ) {
					var player = document.createElement('div');
					this.player[i] = hyperaudio.Player({
						target: player
					});

					this.player[i].addEventListener('timeupdate', manager);

					this.target.appendChild(player);
				}

				this.addHelpers();

				if(this.options.gui) {

					this.GUI = new hyperaudio.PlayerGUI({
						player: this,

						navigation: false,		// next/prev buttons
						fullscreen: true,		// fullscreen button

						cssClass: this.player[0].options.cssClass
					});
				}
				if(this.options.media) {
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addHelpers: function() {
			var fxHelper = document.createElement('div');
			fxHelper.id = 'fxHelper';
			fxHelper.className = 'video-transition-servo';

			var titleFXHelper = document.createElement('div');
			titleFXHelper.id = 'titleFXHelper';
			titleFXHelper.className = 'title-effect-servo';

			this.target.appendChild(fxHelper);
			this.target.appendChild(titleFXHelper);

		},
		load: function(media) {
			var self = this;
			if(media) {
				this.options.media = media;
			}
			this.media[0] = this.options.media;

			if(this.player[0]) {
				hyperaudio.addClass(this.player[0].videoElem, 'active'); // Think this should affect the Player TARGET
				this.player[0].load(this.media[0]);
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		play: function() {

			// ATM, we always play from the start.

			if(this.stage && this.stage.target) {
				// Get the staged contents wrapper elem
				this.stageArticle = this.stage.target.getElementsByTagName('article')[0];

				// Get the sections
				this.current.sections = this.stageArticle.getElementsByTagName('section');

				this.setCurrent(0);

				this.paused = false;

				this.load(this.current.media);
				this._play(this.current.start);

			} else {
				this.paused = true;
			}
		},
		pause: function() {
			this.paused = true;
			this._pause();
		},
		_play: function(time) {
			this.player[0].play(time);
		},
		_pause: function(time) {
			this.player[0].pause(time);
		},
		currentTime: function(time, play) {
			this.player[0].currentTime(time, play);
		},
		setCurrent: function(index) {
			var weHaveMoreVideo = false,
				effectType;

			this.current.index = index;

			// Get the first section
			this.current.section = this.current.sections[this.current.index];

			effectType = this.current.section.getAttribute('data-effect');
			if(effectType) {

				var ipText = this.current.section.querySelector('input[type="text"]');
				var ipDuration = this.current.section.querySelector('input[type="range"]');

				switch(effectType) {
					case 'title':
						if(ipText && ipDuration) {
							titleFX({
								el: '#titleFXHelper',
								text: ipText.value,
								duration: ipDuration.value * 1000
							});
						}
						break;
					case 'fade':
						break;
					case 'pause':
						break;
				}

				if(++this.current.index < this.current.sections.length) {
					weHaveMoreVideo = this.setCurrent(this.current.index);
				}
				return weHaveMoreVideo;
			}

			// Get the ID
			this.current.id = this.current.section.getAttribute(this.stage.options.idAttr);

			// Get the media
			this.current.media = {
				mp4: this.current.section.getAttribute(this.stage.options.mp4Attr),
				webm: this.current.section.getAttribute(this.stage.options.webmAttr),
				youtube: this.current.section.getAttribute(this.stage.options.ytAttr)
			};

			var unit = 1 * this.current.section.getAttribute(this.stage.options.unitAttr);
			this.current.unit = unit = unit > 0 ? unit : this.options.unit;

			// Still have attributes hard coded in here. Would need to pass from the transcript to stage and then to here.
			var words = this.current.section.getElementsByTagName('a');
			if(words.length) {
				this.current.start = words[0].getAttribute('data-m') * unit;
				this.current.end = words[words.length-1].getAttribute('data-m') * unit;
				weHaveMoreVideo = true;
			} else {
				weHaveMoreVideo = false;
			}
			return weHaveMoreVideo;
		},
		manager: function(videoElem, event) {
			var self = this;

			if(!this.paused) {
				// if(this.player[0].videoElem.currentTime > this.current.end + this.options.tPadding) {
				if(videoElem.currentTime > this.current.end + this.options.tPadding) {
					// Goto the next section

					// Want to refactor the setCurrent() code... Maybe make it more like nextCurrent or something like that.
					if(++this.current.index < this.current.sections.length && this.setCurrent(this.current.index)) {
						this.load(this.current.media);
						this._play(this.current.start);
					} else {
						this.current.index = 0;

						this.paused = true;
						this._pause();
					}
				}
			}

			// Will need to be calculating the currentTime on the fly and the duration calcuated at the start and on changes to stage.
			if(this.options.gui) {
				this.GUI.setStatus({
					paused: this.paused,
					currentTime: 42,
					duration: 69
				});
			}
		}
	};

	return Projector;
}(window, document, hyperaudio, Popcorn));
