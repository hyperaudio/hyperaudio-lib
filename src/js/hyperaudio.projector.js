/* Projector
 * Used to play the staged productions
 */

var Projector = (function(window, document, hyperaudio, Popcorn) {

	function Projector(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PROJECTOR', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			trim: 1, // (Seconds) Time added to end word timings.

			players: 2, // Number of Players to use. Mobile: 1, Desktop: 2.

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

		this.activePlayer = 0;
		this.nextPlayer = this.options.players > 1 ? 1 : 0;

		// State Flags
		this.paused = true;

		if(this.options.DEBUG) {
			this._debug();
		}

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

				var getManager = function(idx) {

					console.log('Create: idx='+idx);

					return function(event) {
						// console.log('activePlayer='+self.activePlayer+' | idx='+idx);
						// Passing the event context to manager
						//  * The YouTube event object is useless.
						//  * The YouTube event context was fixed in the Player class.
						if(self.activePlayer === idx) {
							self.manager(this, event);
						}
					};
				};

				for(var i = 0; i < this.options.players; i++ ) {

					console.log('Create: i='+i);

					var manager = getManager(i);

					var player = document.createElement('div');
					hyperaudio.addClass(player, 'hyperaudio-projector');
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

			var activePlayer = this.which(media);

			console.log('load#1: activePlayer=%d | this.activePlayer=%d',activePlayer,this.activePlayer);

			if(activePlayer !== false) {
				this.activePlayer = activePlayer;
			} else {
				this.player[this.activePlayer].load(media);
			}

			console.log('load#2: activePlayer=%d | this.activePlayer=%d',activePlayer,this.activePlayer);

			for(var i=0; i < this.player.length; i++) {
				hyperaudio.removeClass(this.player[i].target, 'active');
			}
			hyperaudio.addClass(this.player[this.activePlayer].target, 'active');
		},
		OLD_load: function(media) {
			var self = this;

			this.activePlayer = this.activePlayer + 1 < this.player.length ? this.activePlayer + 1 : 0;

			// This is old DNA - refactor
			this.media[this.activePlayer] = media;

			for(var i=0; i < this.player.length; i++) {
				hyperaudio.removeClass(this.player[i].target, 'active');
			}

			if(this.player[this.activePlayer]) {
				hyperaudio.addClass(this.player[this.activePlayer].target, 'active');
				this.player[this.activePlayer].load(this.media[this.activePlayer]);
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		prepare: function(media) {
			// Used when more than 1 player to prepare the next piece of media.

			// 1. Want to be able to call this method and it deal with preparing the other player.
			// 2. So it should check if the media is already available in a player.
			// 3. If it is available, then do nothing.
			// 4. If not, then setup the next player to play the media.

			// 5. In principle this should support 1, 2 or more players.
			// 6. If 1 player, should do nothing here.
			// 7. If 2 or more players, then setup the next one. ie., The last one ever used before.

			// 8. Normally just 1 or 2 players though, so "keep it real mofo!"


			// Ignore if we are only using a single Player
			if(media && this.player.length > 1) {

				// See if a player already has it. NB: Zero is falsey, so strong comparison.
				if(this.which(media) === false) {

					// Get the next free player (Has flaws if more than 2, but still works. Just does not take full advantage of more than 2.)
					this.nextPlayer = this.activePlayer + 1 < this.player.length ? this.activePlayer + 1 : 0;

					if(this.player[this.nextPlayer]) {
						this.player[this.nextPlayer].load(media);
					}
				}
			}
		},
		which: function(media) {
			var index = false;

			if(media) {
				for(var i=0; i < this.player.length; i++) {
					if(!this.player[i].mediaDiff(media)) {
						index = i;
						break;
					}
				}
			}
			return index;
		},
		play: function() {

			// ATM, we always play from the start.

			if(this.stage && this.stage.target) {
				// Get the staged contents wrapper elem
				this.stageArticle = this.stage.target.getElementsByTagName('article')[0];

				// Get the sections
				this.stageSections = this.stageArticle.getElementsByTagName('section');

				this.stageIndex = 0; // [Number] The next section
				this.content = []; // [Array] Holding the sections found with content
				this.firstContent = true; // [Boolean] True the first time
				this.endedContent = false; // [Boolean] True when we have no more content

				this.contentIndex = 0; // [Number] The content that is actually being played.

				// This bit is similar to the manager() code

				this.getContent();

				if(this.content.length) {
					this.paused = false;

					this.load(this.content[this.contentIndex].media);
					if(this.content[this.contentIndex+1]) {
						this.prepare(this.content[this.contentIndex+1].media);
					}
					this.effect(this.content[this.contentIndex].effect);
					this._play(this.content[this.contentIndex].start);

				} else {
					// Nothing to play
					this.paused = true;
				}
			} else {
				this.paused = true;
			}
		},
		OLD_play: function() {

			// ATM, we always play from the start.

			if(this.stage && this.stage.target) {
				// Get the staged contents wrapper elem
				this.stageArticle = this.stage.target.getElementsByTagName('article')[0];

				// Get the sections
				this.current.sections = this.stageArticle.getElementsByTagName('section'); // old way
				this.stageSections = this.stageArticle.getElementsByTagName('section');

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
			// this.player[0].play(time);
			this.player[this.activePlayer].play(time);
		},
		_pause: function(time) {
			// this.player[0].pause(time);
			this.player[this.activePlayer].pause(time);
		},
		currentTime: function(time, play) {
			// this.player[0].currentTime(time, play);
			this.player[this.activePlayer].currentTime(time, play);
		},

		setCurrent: function(index) {
			var weHaveMoreVideo = false;

			this.current = this.getSection(index);

			if(this.current.effect) {

				switch(this.current.effect.type) {
					case 'title':
						if(this.current.effect.text && this.current.effect.duration) {
							titleFX({
								el: '#titleFXHelper',
								text: this.current.effect.text,
								duration: this.current.effect.duration * 1000
							});
						}
						break;
					case 'fade':
						break;
					case 'pause':
						break;
				}

				if(++index < this.stageSections.length) {
					weHaveMoreVideo = this.setCurrent(index);
				}
				// return weHaveMoreVideo;
			} else {
				if(this.current.end) {
					weHaveMoreVideo = true;
				}
			}

			return weHaveMoreVideo;
		},

		OLD_setCurrent: function(index) {
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

		getContent: function() {
			// Need a pointer to the stage section being examined.
			// this.stageIndex;

			// Content is a section with actual video and transcript.

			// Will store the content as we go along...
			// Pros -
			//  1. We have a record of it all
			//  2. and it may follow the structure required later when jumping to a start position
			// Cons -
			//  1. Could we not just use a current content and next content setup?




			// New thought record...
			// 1. We want to find the sections with content
			// 2. Before we find content, we should store the effect (sections) encounted.
			// 3. The section with content becomes "The content", basically a copy of the section.
			// 4. The content then has any effects added to it.
			// Store effects on an Effect Queue.

			// The first time is a special case.

			// Class properties needed:
			this.stageIndex; // [Number] The next section
			this.content; // [Array] Holding the sections found with content
			this.firstContent; // [Boolean] True the first time
			this.endedContent; // [Boolean] True when we have no more content

			// Used elsewhere - noting here
			this.contentIndex; // [Number] The content that is actually being played.

			// We also want a return value...
			// true - (Or truthy?) When we have stuff... Return the content?
			// false - means no more sections.

			var effect = [],
				searching = true,
				section;

			// Search for sections with content and apply sections with effects to that content
			while(searching) {

				section = this.getSection(this.stageIndex);
				// If there is another section
				if(section) {
					// If this section has content
					if(section.media) {

						// Need to add any stored affects here
						section.effect = []; // Init the effect array
						this.effectContent(section, effect);

						// Store the content
						this.content.push(section);

						// The first time we need to get the 1st and 2nd content sections.
						if(this.firstContent) {
							this.firstContent = false;
							effect = []; // reset the effect array
						} else {
							searching = false;
						}
					} else if(section.effect) {
						// Some effects need to be applied to the previous content item
						if(this.isPastEffect(section.effect)) {
							// Have we got a previous section to affect?
							if(this.content.length) {
								this.effectContent(this.content[this.content.length-1], section.effect);
							}
						} else {
							// Effect for the next section, so store it for later.
							effect.push(section.effect);
						}
					} else {
						// Something is wrong with section structure
						searching = false;
					}
				} else {
					this.endedContent = true;
					searching = false;
				}

				// if(searching) {
				// if(!this.endedContent) {
					this.stageIndex++;
				// }
			}

			console.log('getContent: length=%d | content=%o',this.content.length,this.content);

			// What about at the end?

			// Normally we return the content 2 back.
			if(this.content.length > 1 && !this.endedContent) {
				return this.content[this.content.length-2];
			} else if(this.content.length) {
				return this.content[this.content.length-1];
			} else {
				return false;
			}
		},

		getSection: function(index) {

			var stageOptions = this.stage ? this.stage.options : {};
				section = {
					index: index
				};

			if(index < this.stageSections.length) {

				// Get the section
				var el = section.element = this.stageSections[index];

				// Get the ID
				section.id = el.getAttribute(stageOptions.idAttr);

				// Get the media
				var mp4 = el.getAttribute(stageOptions.mp4Attr),
					webm = el.getAttribute(stageOptions.webmAttr),
					youtube = el.getAttribute(stageOptions.ytAttr);

				if(mp4 || webm || youtube) {
					section.media = {
						mp4: mp4,
						webm: webm,
						youtube: youtube
					};
				} else {
					section.media = false;
				}

				var unit = 1 * el.getAttribute(stageOptions.unitAttr);
				section.unit = unit = unit > 0 ? unit : this.options.unit;

				// Still have attributes hard coded in here. Would need to pass from the transcript to stage and then to here.
				var words = el.getElementsByTagName('a');
				if(words.length) {
					section.start = words[0].getAttribute('data-m') * unit;
					section.end = words[words.length-1].getAttribute('data-m') * unit;
					section.trim = this.options.trim;
				}

				// Get the effect details
				var effectType = el.getAttribute('data-effect');
				if(effectType) {
					var effectText = el.querySelector('input[type="text"]');
					var effectDuration = el.querySelector('input[type="range"]');
					section.effect = {
						type: effectType,
						text: effectText.value,
						duration: effectDuration.value * 1 // Convert to number
					};
				} else {
					section.effect = false;
				}

				return section;
			} else {
				return false;
			}
		},

		isPastEffect: function(effect) {

			// List of the effect types. (Separated by a space.)
			var effectTypes = 'trim',
				past = false;

			hyperaudio.each(effectTypes.split(/\s+/g), function() {
				if(effect.type === this) {
					past = true;
					return false; // exit each
				}
			});
			return past;
		},

		effectContent: function(content, effect) {

			// Allow effect to be a single object, or an array of them. Empty effect arrays do nothing.
			if(effect && !effect.length && effect.length !== 0) {
				effect = [effect];
			}

			for(var i=0, l=effect.length; i < l; i++) {
				switch(effect[i].type) {
					case 'title':
						content.effect.push(effect[i]);
						break;
					case 'fade':
						content.effect.push(effect[i]);
						break;
					case 'trim':
						content.trim = effect[i].trim;
						break;
				}
			}

		},

		effect: function(effect) {

			if(effect && effect.length) {

				for(var i=0, l=effect.length; i < l; i++) {

					switch(effect[i].type) {
						case 'title':
							if(effect[i].text && effect[i].duration) {
								titleFX({
									el: '#titleFXHelper',
									text: effect[i].text,
									duration: effect[i].duration * 1000
								});
							}
							break;
						case 'fade':
							break;
					}
				}
			}
		},

		manager: function(videoElem, event) {
			var self = this;

			if(!this.paused) {
				if(videoElem.currentTime > this.content[this.contentIndex].end + this.content[this.contentIndex].trim) {
					// Goto the next piece of content

					this._pause(); // Need to stop, otherwise if we switch player, the hidden one keeps playing.

					// This bit is similar to the play() code

					this.getContent();

					this.contentIndex++;

					if(this.contentIndex < this.content.length) {
						// this.paused = false;

						this.load(this.content[this.contentIndex].media);
						if(this.content[this.contentIndex+1]) {
							this.prepare(this.content[this.contentIndex+1].media);
						}
						this.effect(this.content[this.contentIndex].effect);
						this._play(this.content[this.contentIndex].start);

					} else {
						// Nothing to play
						this.paused = true;
						// this._pause();
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
		},

		OLD_manager: function(videoElem, event) {
			var self = this;

			if(!this.paused) {
				// if(this.player[0].videoElem.currentTime > this.current.end + this.options.trim) {
				if(videoElem.currentTime > this.current.end + this.options.trim) {
					// Goto the next section

					// Want to refactor the setCurrent() code... Maybe make it more like nextCurrent or something like that.
					// if(++this.current.index < this.current.sections.length && this.setCurrent(this.current.index)) {
					if(++this.current.index < this.stageSections.length && this.setCurrent(this.current.index)) {
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
